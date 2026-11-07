"""P3 engine: the generator + the quality-gated cascade, in one place.

Used by notebook 03a (to MEASURE the low-memory setup) and by the Space backend (to SERVE it), so the numbers
in the write-up come from exactly the code that runs in the app.

    SETUPS / load_generator()  SANA-Sprint 0.6B in float16, or notebook 01's low-memory setups (M2, M3)
    Router                     02b's prompt -> starting-level model, run from its JSON export (numpy only)
    Engine.verdict()           the gate: visual check (classical CV) + semantic check (detector + CLIP)
    Engine.run()               one request: router -> draw -> check -> retry -> polish -> WebP -> API dict
"""

from __future__ import annotations

import base64
import gc
import os
import random
import time
import types
import zlib
from pathlib import Path

import numpy as np
import torch

import p3_classical as pcv
import p3_semantic as psem

MODEL_REPO = "Efficient-Large-Model/Sana_Sprint_0.6B_1024px_diffusers"

# Notebook 01's setups. "te" = the text reader (Gemma-2 2B), "tr" = the drawer (the diffusion transformer).
SETUPS = {
    "fp16": {},
    "M2": {"te_quant": "4bit", "tr_quant": "8bit", "te_embed_cpu": True, "vae_tiling": True},
    "M3": {"te_quant": "4bit", "tr_quant": "4bit", "te_embed_cpu": True, "vae_tiling": True},
}
SETUP_NAMES = {
    "fp16": "SANA-Sprint 0.6B · float16",
    "M2": "SANA-Sprint 0.6B · low-memory (4-bit reader, 8-bit drawer)",
    "M3": "SANA-Sprint 0.6B · low-memory (4-bit reader, 4-bit drawer)",
}

# What each app mode does. Every mode is one of the strategies replayed in notebooks 02b/03a, so its
# speed and accuracy are measured, not guessed. budget_s: never START another try that would end past this.
# start: a level number, or "router" to let 02b's router pick. 02b found the router no better than always
# starting cheap (46.5% vs 58% majority baseline), so no mode uses it by default; 03a still reports it.
DEFAULT_MODES = {
    "fast": {"start": 0, "cascade": False, "budget_s": None},
    "balanced": {"start": 0, "cascade": True, "budget_s": 6.0},
    "quality": {"start": 1, "cascade": True, "budget_s": 9.0},
}
MODE_STRATEGY = {"fast": "fixed R0", "balanced": "cascade from R0", "quality": "cascade from R1"}

SEED_STRIDE = 100000  # seed of level i = base seed + i * SEED_STRIDE (same rule as notebook 02b)


def free_memory():
    gc.collect()
    if torch.cuda.is_available():
        torch.cuda.empty_cache()
    try:
        import ctypes

        ctypes.CDLL("libc.so.6").malloc_trim(0)
    except Exception:
        pass


# ----------------------------------------------------------------------------- 1. the generator
def _quant_config(setup: dict, dtype):
    """Which parts of the pipeline get quantized, and how (identical to notebook 01)."""
    from diffusers import BitsAndBytesConfig as DiffusersBnbConfig
    from diffusers import PipelineQuantizationConfig
    from transformers import BitsAndBytesConfig as TransformersBnbConfig

    qm = {}
    te, tr = setup.get("te_quant"), setup.get("tr_quant")
    if te == "8bit":
        qm["text_encoder"] = TransformersBnbConfig(load_in_8bit=True)
    elif te == "4bit":
        qm["text_encoder"] = TransformersBnbConfig(load_in_4bit=True, bnb_4bit_quant_type="nf4",
                                                   bnb_4bit_use_double_quant=True, bnb_4bit_compute_dtype=dtype)
    if tr == "8bit":
        qm["transformer"] = DiffusersBnbConfig(load_in_8bit=True)
    elif tr == "4bit":
        qm["transformer"] = DiffusersBnbConfig(load_in_4bit=True, bnb_4bit_quant_type="nf4",
                                               bnb_4bit_compute_dtype=dtype)
    return PipelineQuantizationConfig(quant_mapping=qm) if qm else None


class CPUEmbedding(torch.nn.Module):
    """The reader's word table (256k words, 1.18 GB) kept on the CPU.
    Keeps Gemma's built-in x48 scale: dropping it breaks prompt understanding (CLIP fell from 27 to 9)."""

    def __init__(self, emb):
        super().__init__()
        self.weight_cpu = emb.weight.detach().to("cpu")
        self.num_embeddings, self.embedding_dim = self.weight_cpu.shape
        scale = getattr(emb, "embed_scale", None)
        self.scale = float(scale) if scale is not None else 1.0

    def forward(self, input_ids):
        out = torch.nn.functional.embedding(input_ids.to("cpu"), self.weight_cpu)
        return (out * self.scale).to(input_ids.device)


def move_word_table_to_cpu(pipe, log=print):
    te = pipe.text_encoder
    old = te.embed_tokens
    test_ids = torch.tensor([[2, 651, 4401, 235265]], device=old.weight.device)
    ref = old(test_ids).float().cpu()
    te.embed_tokens = CPUEmbedding(old)
    diff = (ref - te.embed_tokens(test_ids).float().cpu()).abs().max().item()
    log(f"  word table moved to CPU (scale x{te.embed_tokens.scale:.1f}), max difference vs original: {diff:.6f}")
    assert diff < 1e-3, "CPU word table doesn't match the original: stop, the pictures would be wrong"
    del old
    free_memory()


class MockPipe:
    """Offline testing only (no GPU, no model download). With P3_MOCK_IMAGES set: returns those photos
    (the cheapest level is sometimes blurred, like notebook 02b's mock). Otherwise: random sharp shapes."""

    def __init__(self, image_dir: str | None = None):
        self.files = sorted(Path(image_dir).glob("*.jpg")) if image_dir else []

    def __call__(self, prompt, generator, height, width, num_inference_steps, **kw):
        from PIL import Image, ImageDraw, ImageFilter

        images = []
        for p, g in zip(prompt, generator):
            k = zlib.crc32(p.encode()) + int(g.initial_seed())
            if self.files:
                im = Image.open(self.files[k % len(self.files)]).convert("RGB").resize((width, height))
                if width < 1024 and k % 3 == 0:
                    im = im.filter(ImageFilter.GaussianBlur(3))
            else:
                r = random.Random(k)
                im = Image.new("RGB", (width, height), tuple(r.randrange(40, 200) for _ in range(3)))
                d = ImageDraw.Draw(im)
                for _ in range(40):
                    x, y = r.randrange(width), r.randrange(height)
                    s = r.randrange(width // 20, width // 4)
                    shape = d.ellipse if r.random() < 0.5 else d.rectangle
                    shape([x, y, x + s, y + s], fill=tuple(r.randrange(256) for _ in range(3)))
            images.append(im)
        return types.SimpleNamespace(images=images)

    def set_progress_bar_config(self, **kw):
        pass


def load_generator(setup: str = "M3", device: str = "cuda", dtype=torch.float16, repo: str = MODEL_REPO,
                   mock: bool = False, log=print):
    """Load SANA-Sprint once. setup = "fp16" | "M2" | "M3" (see SETUPS)."""
    if mock:
        return MockPipe(os.environ.get("P3_MOCK_IMAGES"))
    from diffusers import SanaSprintPipeline

    cfg = SETUPS[setup]
    kwargs = {"torch_dtype": dtype}
    qc = _quant_config(cfg, dtype)
    if qc is not None:
        kwargs["quantization_config"] = qc
    try:
        pipe = SanaSprintPipeline.from_pretrained(repo, device_map=device, **kwargs)  # straight to GPU, saves RAM
    except Exception as e:
        log("device_map not supported here, loading the normal way:", str(e)[:120])
        free_memory()
        pipe = SanaSprintPipeline.from_pretrained(repo, **kwargs)
        pipe.to(device)
    if cfg.get("te_embed_cpu"):
        move_word_table_to_cpu(pipe, log)
    if cfg.get("vae_tiling"):
        pipe.vae.enable_tiling()  # decode in tiles: removes the memory spike at the end
    pipe.set_progress_bar_config(disable=True)
    return pipe


def model_size_mb(pipe) -> float | None:
    """All weights, like notebook 01's 'model size' (None for the mock)."""
    total = 0
    for name in ("text_encoder", "transformer", "vae"):
        m = getattr(pipe, name, None)
        if m is None:
            return None
        total += m.get_memory_footprint() if hasattr(m, "get_memory_footprint") else sum(
            p.numel() * p.element_size() for p in m.parameters())
    return total / 2**20


def call_kwargs(level: dict) -> dict:
    kw = {"height": level["res"], "width": level["res"], "num_inference_steps": level["steps"],
          "intermediate_timesteps": 1.3 if level["steps"] == 2 else None}
    if level["res"] != 1024:
        kw["use_resolution_binning"] = False  # otherwise it secretly renders 1024px and shrinks it
    return kw


@torch.inference_mode()
def generate_images(pipe, level: dict, prompts: list[str], seeds: list[int]):
    gens = [torch.Generator("cpu").manual_seed(int(s)) for s in seeds]
    return pipe(prompt=list(prompts), generator=gens, **call_kwargs(level)).images


def level_seed(base_seed: int, level: int) -> int:
    return int(base_seed + SEED_STRIDE * level) % 2**31


# ----------------------------------------------------------------------------- 2. the router
class Router:
    """Notebook 02b's logistic regression (prompt clues + PCA of the CLIP text embedding), from its JSON."""

    def __init__(self, export: dict | None):
        self.j = export or {}
        self.classes = [int(c) for c in self.j.get("classes", [])]
        if self.j.get("coef") is not None:
            self.mean = np.asarray(self.j["scaler_mean"], float)
            self.scale = np.asarray(self.j["scaler_scale"], float)
            self.pca_mean = np.asarray(self.j["pca_mean"], float)
            self.pca = np.asarray(self.j["pca_components"], float)
            self.coef = np.asarray(self.j["coef"], float)
            self.intercept = np.asarray(self.j["intercept"], float)

    @property
    def text_encoder(self) -> str | None:
        return self.j.get("text_encoder")

    def predict(self, prompt: str, spec: dict | None, embed_fn) -> tuple[int, float | None]:
        """-> (starting level, confidence 0-1 or None). embed_fn(list[str]) -> array (n, d)."""
        if not self.classes:
            return 0, None
        if self.j.get("coef") is None:  # every training label was the same: nothing was learned
            return self.classes[0], None
        feats = psem.prompt_features(prompt, spec)
        x_hand = (np.array([feats[f] for f in self.j["features"]], float) - self.mean) / self.scale
        e = np.asarray(embed_fn([prompt]), dtype=np.float64).reshape(-1)
        x = np.concatenate([x_hand, (e - self.pca_mean) @ self.pca.T])
        z = self.coef @ x + self.intercept
        if self.coef.shape[0] == 1:  # binary: sklearn predicts classes[1] when the decision value > 0
            p1 = 1.0 / (1.0 + np.exp(-z[0]))
            return self.classes[int(p1 > 0.5)], float(max(p1, 1 - p1))
        p = np.exp(z - z.max())
        p /= p.sum()
        i = int(p.argmax())
        return self.classes[i], float(p[i])


# ----------------------------------------------------------------------------- 3. the engine
class Engine:
    """Everything loaded once; then run() serves one request."""

    def __init__(self, config: dict, setup: str | None = None, device: str | None = None, mock: bool = False,
                 log=print):
        self.cfg, self.log, self.mock = config, log, mock
        self.device = device or ("cuda" if torch.cuda.is_available() else "cpu")
        on_gpu = str(self.device).startswith("cuda")
        if on_gpu:
            self.dtype = torch.bfloat16 if torch.cuda.get_device_capability(0)[0] >= 8 else torch.float16
        else:
            self.dtype = torch.float32
        self.levels = config["rungs"]
        self.top = len(self.levels) - 1
        gen = config.get("generator") or {}
        self.setup = setup or gen.get("setup") or "fp16"
        self.modes = {m: {**v, **{k: config.get("modes", {}).get(m, {}).get(k, v[k]) for k in v}}
                      for m, v in DEFAULT_MODES.items()}
        g = config["gate"]
        self.clip_min = float(g["clip_min"])
        self.unfixable = set(g.get("visual_unfixable_flags", pcv.UNFIXABLE))
        lat = config.get("rung_latency_s", {})
        gate_s = float(config.get("gate_latency_s", 0.3))
        self.expected_s = [float(lat.get(lv["name"], 1.5)) + gate_s for lv in self.levels]

        clip_name = os.environ.get("P3_GATE_CLIP", g["clip_model"])
        log(f"Loading the checker (detector {g.get('detector', 'maskrcnn')}, CLIP {clip_name})...")
        self.gate = psem.SemanticChecker(device=self.device, clip_name=clip_name,
                                         detector=g.get("detector", "maskrcnn"),
                                         det_threshold=g.get("det_threshold", 0.3),
                                         count_threshold=g.get("count_threshold", 0.9))
        self.router = Router(config.get("router"))
        if self.router.text_encoder and self.router.text_encoder != g["clip_model"]:
            log(f"WARNING: router was trained on {self.router.text_encoder} text features, gate uses {g['clip_model']}")
        log(f"Loading the generator ({'mock' if mock else self.setup})...")
        self.pipe = load_generator(self.setup, self.device, self.dtype, config.get("model", MODEL_REPO),
                                   mock=mock, log=log)
        free_memory()
        self.model_name = ("MOCK · " if mock else "") + SETUP_NAMES.get(self.setup, self.setup)
        self.gpu_name = torch.cuda.get_device_name(0) if on_gpu else "CPU"

    # -- pieces ----------------------------------------------------------------------------------
    def embed(self, texts):
        return self.gate._text_embeds(list(texts)).float().cpu().numpy()

    def draw(self, level: int, prompts: list[str], seeds: list[int]):
        return generate_images(self.pipe, self.levels[level], prompts, seeds)

    def verdict(self, image, prompt: str, spec: dict | None) -> dict:
        """The gate (same rule as notebook 02b): visual check has no unfixable flag AND the structured check
        passes (when the prompt has one) AND gate-CLIP >= clip_min."""
        t0 = time.perf_counter()
        vis = pcv.assess(np.asarray(image), prompt)
        bad = [f for f in vis["flags"] if f in self.unfixable]
        g = self.gate.gate(image, prompt, spec=spec)
        struct_ok = g["check"] is None or g["check"]["passed"]
        clip_ok = g["clip"] >= self.clip_min
        reasons = [f"picture looks {f.replace('_', ' ')}" for f in bad]
        if not clip_ok:
            reasons.append(f"weak match with the prompt (CLIP {g['clip']:.1f} < {self.clip_min:.1f})")
        if g["check"] is not None:
            reasons += g["check"]["reasons"]
        return {"passed": not bad and struct_ok and clip_ok, "vis": vis, "vis_ok": not bad, "gate": g,
                "struct_ok": struct_ok, "clip": float(g["clip"]), "reasons": reasons,
                "seconds": time.perf_counter() - t0}

    def start_level(self, mode: str, prompt: str, spec: dict | None) -> tuple[int, float | None]:
        start = self.modes[mode]["start"]
        if start == "router":
            level, conf = self.router.predict(prompt, spec, self.embed)
        else:
            level, conf = int(start), None
        return min(max(int(level), 0), self.top), conf

    def warm_up(self):
        """First GPU calls are slow (kernel set-up): run every level once before real users arrive."""
        for i in range(len(self.levels)):
            im = self.draw(i, ["a photo of a cat"], [0])[0]
        self.verdict(im, "a photo of a cat", psem.parse_prompt("a photo of a cat"))

    # -- one request ---------------------------------------------------------------------------------
    def run(self, prompt: str, mode: str = "balanced", seed: int | None = None) -> dict:
        """Router -> draw -> check -> (retry at the next level with a new seed) -> polish -> WebP.
        Returns the API response (docs/API_CONTRACT.md in the frontend)."""
        t0 = time.perf_counter()
        policy = self.modes[mode]
        spec = psem.parse_prompt(prompt)
        start, conf = self.start_level(mode, prompt, spec)
        base_seed = int(seed) if seed is not None else random.randrange(2**31)
        attempts, gen_s, check_s = [], 0.0, 0.0
        initial_image = None
        level = start
        while True:
            s = level_seed(base_seed, level)
            tg = time.perf_counter()
            image = self.draw(level, [prompt], [s])[0]
            if initial_image is None:
                initial_image = image.copy()
            if self.device.startswith("cuda"):
                torch.cuda.synchronize()
            g_time = time.perf_counter() - tg
            v = self.verdict(image, prompt, spec)
            gen_s += g_time
            check_s += v["seconds"]
            attempts.append({"level": level, "resolution": self.levels[level]["res"], "seed": s,
                             "time_s": round(g_time + v["seconds"], 3), "passed": bool(v["passed"]),
                             "reasons": [] if v["passed"] else (v["reasons"] or ["did not pass the check"])})
            if v["passed"] or not policy["cascade"] or level >= self.top:
                break
            budget = policy.get("budget_s")
            if budget and (time.perf_counter() - t0) + self.expected_s[level + 1] > budget:
                break
            level += 1

        if initial_image is None:
            raise RuntimeError("The cascade did not produce an initial image.")

        tp = time.perf_counter()
        polished, pinfo = pcv.safe_enhance(np.asarray(image), prompt)
        polish_s = time.perf_counter() - tp
        te = time.perf_counter()
        data, pk = pcv.pack_for_mobile(polished, max_side=1024)
        initial_data, _ = pcv.pack_for_mobile(np.asarray(initial_image), max_side=1024)
        encode_s = time.perf_counter() - te
        h, w = np.asarray(polished).shape[:2]
        return {
            "image": "data:image/webp;base64," + base64.b64encode(data).decode("ascii"),
            "initial_image": "data:image/webp;base64," + base64.b64encode(initial_data).decode("ascii"),
            "width": int(w),
            "height": int(h),
            "prompt": prompt,
            "mode": mode,
            "passed": bool(v["passed"]),
            "level_used": level,
            "levels_total": len(self.levels),
            "attempts": attempts,
            "timing": {"total_s": round(time.perf_counter() - t0, 3), "generate_s": round(gen_s, 3),
                       "check_s": round(check_s, 3), "polish_s": round(polish_s, 3), "encode_s": round(encode_s, 3)},
            "checks": {
                "clip_score": round(v["clip"], 1),
                "visual": {"ok": bool(v["vis_ok"]), "flags": list(v["vis"]["flags"])},
                "semantic": psem.describe_checks(spec, v["gate"]["check"]),
            },
            "router": {"start_level": start, "confidence": None if conf is None else round(conf, 3)},
            "polish": {"applied": bool(pinfo["accepted"]), "steps": list(pinfo["actions"]) if pinfo["accepted"] else []},
            "model": self.model_name,
            "gpu": self.gpu_name,
            **({"mock": True} if self.mock else {}),
        }
