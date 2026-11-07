"""p3_semantic.py: the SEMANTIC half of our quality gate. Does the picture show what the prompt asked for?

Follows GenEval's protocol (Ghosh et al., NeurIPS 2023) with lighter, pip-installable models:
  - objects + counts : COCO instance detector (torchvision Mask R-CNN v2) instead of mmdet Mask2Former
  - colours          : CLIP ViT-L/14 zero-shot on each object's masked crop (GenEval's prompts and 10 colours)
  - positions        : GenEval's relative_position() rule on box centres
  - overall match    : CLIP image-text score (same formula as notebook 01)
Our numbers are therefore "GenEval-style", NOT official GenEval scores.

    parse_prompt(text)                 -> checklist in GenEval's metadata format, or None if nothing checkable
    prompt_features(text)              -> cheap numeric clues about prompt difficulty (for the router)
    SemanticChecker(device)
        .clip_scores(images, prompts)  -> CLIP match per image (x100)
        .detect(image)                 -> {class: [{"box", "mask", "score"}, ...]} sorted by confidence
        .check(image, spec)            -> {"passed", "reasons", ...} GenEval-style structured check
        .gate(image, prompt, clip_min) -> the semantic verdict used by the cascade

Only the 80 COCO object types (GenEval's list) can be checked structurally. Other prompts fall back to CLIP.
"""
from __future__ import annotations

import re
import time
from collections import Counter

import numpy as np

# ----------------------------------------------------------------------------- vocabulary (GenEval)
CLASSES = [
    "person", "bicycle", "car", "motorcycle", "airplane", "bus", "train", "truck", "boat", "traffic light",
    "fire hydrant", "stop sign", "parking meter", "bench", "bird", "cat", "dog", "horse", "sheep", "cow",
    "elephant", "bear", "zebra", "giraffe", "backpack", "umbrella", "handbag", "tie", "suitcase", "frisbee",
    "skis", "snowboard", "sports ball", "kite", "baseball bat", "baseball glove", "skateboard", "surfboard",
    "tennis racket", "bottle", "wine glass", "cup", "fork", "knife", "spoon", "bowl", "banana", "apple",
    "sandwich", "orange", "broccoli", "carrot", "hot dog", "pizza", "donut", "cake", "chair", "couch",
    "potted plant", "bed", "dining table", "toilet", "tv", "laptop", "computer mouse", "tv remote",
    "computer keyboard", "cell phone", "microwave", "oven", "toaster", "sink", "refrigerator", "book", "clock",
    "vase", "scissors", "teddy bear", "hair drier", "toothbrush",
]
COLOURS = ["red", "orange", "yellow", "green", "blue", "purple", "pink", "brown", "black", "white"]
NUMBER_WORDS = {"two": 2, "three": 3, "four": 4, "five": 5, "six": 6, "seven": 7, "eight": 8, "nine": 9, "ten": 10}
ONE_WORDS = {"a", "an", "one", "single", "lone"}

# Everyday words -> COCO class. (Deliberately no "mouse": the animal would be mistaken for a computer mouse.)
SYNONYMS = {
    "man": "person", "woman": "person", "boy": "person", "girl": "person", "child": "person", "kid": "person",
    "lady": "person", "guy": "person", "astronaut": "person", "chef": "person",
    "bike": "bicycle", "motorbike": "motorcycle", "scooter": "motorcycle", "plane": "airplane",
    "aeroplane": "airplane", "jet": "airplane", "ship": "boat", "lorry": "truck", "puppy": "dog", "kitten": "cat",
    "sofa": "couch", "television": "tv", "smartphone": "cell phone", "phone": "cell phone",
    "mobile phone": "cell phone", "cellphone": "cell phone", "mug": "cup", "doughnut": "donut",
    "fridge": "refrigerator", "teddy": "teddy bear", "remote": "tv remote", "remote control": "tv remote",
    "keyboard": "computer keyboard", "hair dryer": "hair drier", "hairdryer": "hair drier",
    "table": "dining table", "plant": "potted plant", "ball": "sports ball", "football": "sports ball",
    "basketball": "sports ball", "soccer ball": "sports ball", "tennis ball": "sports ball",
}
IRREGULAR_PLURALS = {"person": ["people", "persons"], "man": ["men"], "woman": ["women"], "child": ["children"],
                     "kid": ["kids"], "knife": ["knives"], "sheep": ["sheep"], "skis": ["skis"],
                     "puppy": ["puppies"], "lady": ["ladies"]}

RELATIONS = [  # (phrase, canonical GenEval relation); longest phrases first when matching
    ("to the left of", "left of"), ("on the left of", "left of"), ("left of", "left of"),
    ("to the right of", "right of"), ("on the right of", "right of"), ("right of", "right of"),
    ("on top of", "above"), ("above", "above"), ("over", "above"),
    ("underneath", "below"), ("beneath", "below"), ("under", "below"), ("below", "below"),
]
SIDE_PHRASES = [("on the left", "left"), ("on the right", "right")]   # absolute: "the black cat on the left"
TEXT_WORDS = r"\b(says|saying|text|written|writing|word|words|letters|lettering|logo|sign that)\b"

# detector category names -> GenEval names
_TV_TO_GENEVAL = {"mouse": "computer mouse", "remote": "tv remote", "keyboard": "computer keyboard"}
_M2F_TO_GENEVAL = {"motorbike": "motorcycle", "aeroplane": "airplane", "sofa": "couch", "pottedplant": "potted plant",
                   "diningtable": "dining table", "tvmonitor": "tv", "mouse": "computer mouse", "remote": "tv remote",
                   "keyboard": "computer keyboard"}
MASK2FORMER = "facebook/mask2former-swin-small-coco-instance"   # the detector family/size official GenEval uses


def _plurals(name: str) -> set[str]:
    out = {name + "es" if name.endswith("s") else name + "s"}           # GenEval's own (sometimes odd) plural
    if re.search(r"(ch|sh|x|s)$", name):
        out.add(name + "es")
    last = name.split()[-1]
    for p in IRREGULAR_PLURALS.get(last, []):
        out.add(" ".join(name.split()[:-1] + [p]))
    return out


def _build_phrases():
    table = {}
    for c in CLASSES:
        table[c] = (c, False)
        for p in _plurals(c):
            table.setdefault(p, (c, True))
    for word, c in SYNONYMS.items():
        table.setdefault(word, (c, False))
        for p in _plurals(word):
            table.setdefault(p, (c, True))
    return {tuple(k.split()): v for k, v in table.items()}


_PHRASES = _build_phrases()
_MAX_LEN = max(len(k) for k in _PHRASES)


def _norm_words(text: str) -> list[str]:
    text = text.lower().replace("-", " ")
    text = re.sub(r"[^a-z0-9, ]+", " ", text).replace(",", " , ")
    return text.split()


def _match_at(words, i, table, max_len):
    for n in range(max_len, 0, -1):
        key = tuple(words[i:i + n])
        if len(key) == n and key in table:
            return key, table[key]
    return None, None


# ----------------------------------------------------------------------------- 1. prompt -> checklist
def parse_prompt(text: str) -> dict | None:
    """Turn a prompt into a GenEval-style checklist:
    {"include": [{"class", "count", "color"?, "position": [relation, target_index]?, "ref"?}], "exclude": [...]}.
    Returns None when the prompt mentions none of the 80 checkable object types."""
    words = _norm_words(text)
    rel_table = {tuple(p.split()): r for p, r in RELATIONS}
    side_table = {tuple(p.split()): s for p, s in SIDE_PHRASES}
    mentions, relations, sides = [], [], []
    i = 0
    while i < len(words):
        key, rel = _match_at(words, i, rel_table, 4)
        if key:
            relations.append((i, rel, len(key)))
            i += len(key)
            continue
        key, side = _match_at(words, i, side_table, 3)
        if key and (i + len(key) >= len(words) or words[i + len(key)] != "of"):
            sides.append((i, side))
            i += len(key)
            continue
        key, hit = _match_at(words, i, _PHRASES, _MAX_LEN)
        if key:
            cls, plural = hit
            nxt, _ = _match_at(words, i + len(key), _PHRASES, _MAX_LEN)
            if not (cls == "orange" and len(key) == 1 and nxt):        # "an orange cat": colour, not the fruit
                mentions.append({"class": cls, "plural": plural, "start": i, "end": i + len(key)})
            i += len(key)
            continue
        i += 1
    if not mentions:
        return None

    # modifiers in the few words before each mention: count, colour, "the" (= refers back to an earlier mention)
    prev_end = 0
    for m in mentions:
        lo = max(prev_end, m["start"] - 4)
        window = words[lo:m["start"]]
        if "," in window:
            window = window[len(window) - window[::-1].index(","):]
        m["color"] = next((w for w in reversed(window) if w in COLOURS), None)
        num = next((NUMBER_WORDS[w] for w in reversed(window) if w in NUMBER_WORDS), None)
        if num is None:
            num = next((int(w) for w in reversed(window) if w.isdigit() and 0 < int(w) <= 20), None)
        if num is None and "pair" in window:
            num = 2
        m["number"] = num
        m["the"] = bool(window) and window[-1] == "the" or (len(window) > 1 and window[-2] == "the")
        prev_end = m["end"]

    include, exclude, seen = [], [], Counter()
    for m in mentions:
        ref = m["the"] and seen[m["class"]] > 0 and m["number"] is None and not m["plural"]
        if m["number"] and m["number"] >= 2:
            req = {"class": m["class"], "count": m["number"]}
            exclude.append({"class": m["class"], "count": m["number"] + 1})       # exact count, like GenEval
        elif m["plural"] and not m["number"]:
            req = {"class": m["class"], "count": 2}                                  # "apples" = at least two
        else:
            req = {"class": m["class"], "count": 1}
        if m["color"]:
            req["color"] = m["color"]
        if ref:
            req["ref"] = True
        m["req"] = req
        include.append(req)
        seen[m["class"]] += 1

    # enumerated colours after a group: "three dogs, one black, one white, and one brown"
    extra = []
    for k, m in enumerate(mentions):
        if not (m["plural"] or (m["number"] or 0) >= 2):
            continue
        stop = mentions[k + 1]["start"] if k + 1 < len(mentions) else len(words)
        tail = words[m["end"]:stop]
        cols = [tail[j + 1] for j in range(len(tail) - 1) if tail[j] == "one" and tail[j + 1] in COLOURS]
        if len(cols) >= 2:
            extra += [{"class": m["class"], "count": 1, "color": c, "ref": True} for c in cols]

    # relations between the nearest mention before and after the phrase: "A left of B"
    links = []
    for pos, rel, n in relations:
        before = [m for m in mentions if m["end"] <= pos]
        after = [m for m in mentions if m["start"] >= pos + n]
        if before and after:
            links.append((before[-1], rel, after[0]))
    # absolute sides: "the black cat on the left and the white cat on the right" -> black cat left of white cat
    side_of = {}
    for pos, side in sides:
        before = [m for m in mentions if m["end"] <= pos]
        if before:
            side_of[side] = before[-1]
    if "left" in side_of and "right" in side_of and side_of["left"] is not side_of["right"]:
        links.append((side_of["left"], "left of", side_of["right"]))

    # GenEval convention: the target must come before the subject; subject stores [relation, target_index]
    order = [m["req"] for m in mentions]
    for subj, rel, tgt in links:
        s, t = order.index(subj["req"]), order.index(tgt["req"])
        if s < t:
            order.insert(t, order.pop(s))
    for subj, rel, tgt in links:
        subj["req"]["position"] = [rel, order.index(tgt["req"])]
    spec = {"include": order + extra}
    if exclude:
        spec["exclude"] = exclude
    return spec


def prompt_features(text: str, spec: dict | None = None) -> dict:
    """Cheap numeric clues about how hard a prompt is (inputs for the router)."""
    spec = parse_prompt(text) if spec is None else spec
    inc = spec["include"] if spec else []
    return {
        "n_words": len(text.split()),
        "n_commas": text.count(","),
        "structured": int(spec is not None),
        "n_objects": len(inc),
        "n_classes": len({r["class"] for r in inc}),
        "total_count": sum(r["count"] for r in inc if not r.get("ref")),
        "has_exact_count": int(bool(spec and spec.get("exclude"))),
        "n_colours": sum("color" in r for r in inc),
        "has_position": int(any("position" in r for r in inc)),
        "has_text": int(bool(re.search(TEXT_WORDS, text.lower()))),
    }


def describe_checks(spec: dict | None, check: dict | None) -> list[dict]:
    """One row per requirement for the app: {"kind", "label", "ok", "detail"?}.
    kind is "object" | "count" | "colour" | "position"; label reads like "2 × dog", "red car", "dog left of cat"."""
    if not spec:
        return []
    include, exclude = spec.get("include", []), spec.get("exclude", [])
    check = check or {}
    items = check.get("items") or [None] * len(include)
    ex_items = check.get("exclude_items") or [None] * len(exclude)
    counted = {r["class"] for r in exclude}
    too_many = {r["class"]: it["reason"] for r, it in zip(exclude, ex_items) if it and not it["ok"]}
    rows = []
    for req, item in zip(include, items):
        c, n = req["class"], req["count"]
        noun = f"{req['color']} {c}" if "color" in req else c
        is_count = (n > 1 or c in counted) and not req.get("ref")
        label = f"{n} × {noun}" if is_count else noun
        if "position" in req:
            rel, target = req["position"]
            label, kind = f"{label} {rel} {include[target]['class']}", "position"
        elif is_count:
            kind = "count"
        elif "color" in req:
            kind = "colour"
        else:
            kind = "object"
        ok = item["ok"] if item else bool(check.get("passed", True))
        detail = item["reason"] if item and not item["ok"] else None
        if kind == "count" and c in too_many:
            ok, detail = False, detail or too_many[c]
        row = {"kind": kind, "label": label, "ok": bool(ok)}
        if detail:
            row["detail"] = detail
        rows.append(row)
    return rows


# ----------------------------------------------------------------------------- geometry (GenEval)
def relative_position(box_a, box_b, threshold: float = 0.1) -> set[str]:
    """Position of A relative to B (GenEval's rule): centre offset, minus a margin proportional to object size."""
    boxes = np.array([box_a, box_b], dtype=np.float64)[:, :4].reshape(2, 2, 2)
    center_a, center_b = boxes.mean(axis=-2)
    dim_a, dim_b = np.abs(np.diff(boxes, axis=-2))[..., 0, :]
    offset = center_a - center_b
    revised = np.maximum(np.abs(offset) - threshold * (dim_a + dim_b), 0) * np.sign(offset)
    if np.all(np.abs(revised) < 1e-3):
        return set()
    dx, dy = revised / np.linalg.norm(offset)
    rels = set()
    if dx < -0.5:
        rels.add("left of")
    if dx > 0.5:
        rels.add("right of")
    if dy < -0.5:
        rels.add("above")
    if dy > 0.5:
        rels.add("below")
    return rels


# ----------------------------------------------------------------------------- 2. the checker
class SemanticChecker:
    """Loads a COCO detector + CLIP once; then checks pictures against prompts.

    detector="maskrcnn"    torchvision Mask R-CNN v2: fast, used by the cascade's GATE
    detector="mask2former" Mask2Former Swin-S (what GenEval uses): used as the independent final JUDGE, so the
                           cascade is never scored by the same models that steered it."""

    def __init__(self, device: str = "cuda", clip_name: str = "openai/clip-vit-large-patch14",
                 detector: str = "maskrcnn", det_threshold: float = 0.3, count_threshold: float = 0.9,
                 position_threshold: float = 0.1, max_objects: int = 16, mask2former_size: int = 1024):
        import torch
        from transformers import CLIPModel, CLIPProcessor

        self.torch, self.device, self.backend = torch, device, detector
        self.det_threshold, self.count_threshold = det_threshold, count_threshold
        self.position_threshold, self.max_objects = position_threshold, max_objects
        if detector == "maskrcnn":
            from torchvision.models.detection import MaskRCNN_ResNet50_FPN_V2_Weights, maskrcnn_resnet50_fpn_v2
            weights = MaskRCNN_ResNet50_FPN_V2_Weights.DEFAULT
            self.detector = maskrcnn_resnet50_fpn_v2(weights=weights,
                                                     box_score_thresh=min(det_threshold, count_threshold))
            self.det_names = [_TV_TO_GENEVAL.get(n, n) for n in weights.meta["categories"]]
        elif detector == "mask2former":
            from transformers import AutoImageProcessor, Mask2FormerForUniversalSegmentation
            self.det_proc = AutoImageProcessor.from_pretrained(MASK2FORMER)
            # The checkpoint defaults to a tiny 384x384 input; GenEval's Mask2Former runs at ~1024 (colours and
            # small objects are much better there). Square resize keeps masks aligned with the post-processing.
            self.det_proc.size = {"height": mask2former_size, "width": mask2former_size}
            self.detector = Mask2FormerForUniversalSegmentation.from_pretrained(MASK2FORMER)
            id2label = self.detector.config.id2label
            self.det_names = [_M2F_TO_GENEVAL.get(id2label[i], id2label[i]) for i in range(len(id2label))]
        else:
            raise ValueError(f"unknown detector {detector!r}")
        self.detector.eval().to(device)
        dtype = torch.float16 if str(device).startswith("cuda") else torch.float32
        self.clip = CLIPModel.from_pretrained(clip_name, torch_dtype=dtype).eval().to(device)
        self.proc = CLIPProcessor.from_pretrained(clip_name)
        self.dtype = dtype
        self._colour_text = {}

    # -- CLIP --------------------------------------------------------------------------------------
    def _image_embeds(self, pil_images):
        torch = self.torch
        with torch.no_grad():
            px = self.proc(images=pil_images, return_tensors="pt")["pixel_values"].to(self.device, self.dtype)
            e = self.clip.get_image_features(pixel_values=px)
            e = e if isinstance(e, torch.Tensor) else e.pooler_output
            return e / e.norm(dim=-1, keepdim=True)

    def _text_embeds(self, texts):
        torch = self.torch
        with torch.no_grad():
            tok = self.proc(text=texts, return_tensors="pt", padding=True, truncation=True, max_length=77).to(self.device)
            e = self.clip.get_text_features(**tok)
            e = e if isinstance(e, torch.Tensor) else e.pooler_output
            return e / e.norm(dim=-1, keepdim=True)

    def clip_scores(self, images, prompts) -> list[float]:
        """CLIP image-text match x100 (same formula as notebook 01's CLIP score)."""
        from PIL import Image
        pil = [im if isinstance(im, Image.Image) else Image.fromarray(np.asarray(im)) for im in images]
        sims = (self._image_embeds(pil) * self._text_embeds(list(prompts))).sum(-1)
        return (100 * sims).clamp(min=0).float().cpu().tolist()

    def colours(self, image, objects, classname) -> list[str]:
        """GenEval's colour test: CLIP zero-shot over 10 colours on each object's masked crop (grey background)."""
        from PIL import Image
        if classname not in self._colour_text:
            templates = ["a photo of a {c} {o}", "a photo of a {c}-colored {o}", "a photo of a {c} object"]
            emb = []
            for c in COLOURS:
                e = self._text_embeds([t.format(c=c, o=classname) for t in templates]).mean(0)
                emb.append(e / e.norm())
            self._colour_text[classname] = self.torch.stack(emb)
        rgb = np.asarray(image.convert("RGB") if isinstance(image, Image.Image) else image)
        crops = []
        for obj in objects:
            x1, y1, x2, y2 = [int(round(v)) for v in obj["box"]]
            img = rgb.copy()
            if obj.get("mask") is not None:
                img[~obj["mask"]] = 153                     # GenEval's #999 background
            crop = img[max(y1, 0):max(y2, y1 + 1), max(x1, 0):max(x2, x1 + 1)]
            crops.append(Image.fromarray(crop if crop.size else img))
        logits = self._image_embeds(crops) @ self._colour_text[classname].T
        return [COLOURS[i] for i in logits.argmax(-1).cpu().tolist()]

    # -- detector -----------------------------------------------------------------------------------
    def detect(self, image) -> dict:
        """COCO instance detection. Returns {class: [{"box", "mask", "score"}]}, most confident first."""
        torch = self.torch
        rgb = np.asarray(image.convert("RGB") if hasattr(image, "convert") else image)
        found = {}
        if self.backend == "maskrcnn":
            x = torch.from_numpy(rgb.copy()).permute(2, 0, 1).float().div(255).to(self.device)
            with torch.no_grad():
                out = self.detector([x])[0]
            boxes, labels, scores = out["boxes"].cpu().numpy(), out["labels"].cpu().numpy(), out["scores"].cpu().numpy()
            masks = (out["masks"][:, 0] > 0.5).cpu().numpy()
            items = [(self.det_names[int(lab)], b.tolist(), m, float(s)) for b, lab, s, m in zip(boxes, labels, scores, masks)]
        else:
            from PIL import Image
            inputs = self.det_proc(images=Image.fromarray(rgb), return_tensors="pt").to(self.device)
            with torch.no_grad():
                out = self.detector(**inputs)
            res = self.det_proc.post_process_instance_segmentation(
                out, threshold=min(self.det_threshold, self.count_threshold),
                target_sizes=[rgb.shape[:2]], return_binary_maps=True)[0]
            items = []
            for k, seg in enumerate(res["segments_info"]):
                m = res["segmentation"][k].bool().cpu().numpy()
                ys, xs = np.nonzero(m)
                if len(xs):
                    box = [float(xs.min()), float(ys.min()), float(xs.max() + 1), float(ys.max() + 1)]
                    items.append((self.det_names[seg["label_id"]], box, m, float(seg["score"])))
        for name, box, m, s in items:
            if name in CLASSES:
                found.setdefault(name, []).append({"box": box, "mask": m, "score": s})
        for name in found:
            found[name] = sorted(found[name], key=lambda d: -d["score"])[:self.max_objects]
        return found

    # -- structured check ---------------------------------------------------------------------------
    def check(self, image, spec: dict, detections: dict | None = None) -> dict:
        """GenEval-style: every 'include' must be satisfied (count, colour, position); every 'exclude' must not.
        Extension over GenEval: when one class appears in several requirements ("the black cat ... the white
        cat"), each requirement is matched to a different detected object."""
        t0 = time.perf_counter()
        dets = self.detect(image) if detections is None else detections
        # GenEval uses the strict counting threshold for counted objects; everything else uses the normal one
        counted = {r["class"] for r in spec.get("exclude", [])}
        objs = {c: [d for d in v if d["score"] >= (self.count_threshold if c in counted else self.det_threshold)]
                for c, v in dets.items()}
        include = spec.get("include", [])
        n_reqs = Counter(r["class"] for r in include)
        used, used_ref = {}, {}
        matched, reasons, ok = [], [], True
        items, exclude_items = [], []          # one verdict per requirement (for the app's checklist)
        for req in include:
            n_reasons = len(reasons)
            c, n = req["class"], req["count"]
            pool = objs.get(c, [])
            taken = used_ref.setdefault(c, set()) if req.get("ref") else used.setdefault(c, set())
            cand = [i for i in range(len(pool)) if i not in taken]
            if n_reqs[c] == 1 and not req.get("ref"):
                cand = cand[:n]                                  # GenEval: the n most confident objects
            chosen = None
            if len(cand) < n:
                reasons.append(f"expected {n} {c}, found {len(cand)}")
            elif "color" in req:
                cols = self.colours(image, [pool[i] for i in cand], c)
                hits = [i for i, col in zip(cand, cols) if col == req["color"]]
                if len(hits) >= n:
                    chosen = hits[:n]
                else:
                    reasons.append(f"expected {n} {req['color']} {c}, saw colours {dict(Counter(cols))}")
            else:
                chosen = cand[:n]
            if chosen is not None and "position" in req:
                rel, target = req["position"]
                tgt = matched[target] if target < len(matched) else None
                if tgt is None:
                    reasons.append(f"no {include[target]['class']} to be {rel}")
                    chosen = None
                else:
                    for a in chosen:
                        for b in tgt:
                            rels = relative_position(pool[a]["box"], b["box"], self.position_threshold)
                            if rel not in rels:
                                reasons.append(f"expected {c} {rel} {include[target]['class']}, "
                                               f"found {' and '.join(sorted(rels)) or 'overlapping'}")
                                chosen = None
                                break
                        if chosen is None:
                            break
            if chosen is None:
                ok = False
                matched.append(None)
            else:
                taken.update(chosen)
                matched.append([pool[i] for i in chosen])
            items.append({"ok": chosen is not None, "reason": "; ".join(reasons[n_reasons:]) or None})
        for req in spec.get("exclude", []):
            found = len(objs.get(req["class"], []))
            if found >= req["count"]:
                ok = False
                reasons.append(f"expected fewer than {req['count']} {req['class']}, found {found}")
                exclude_items.append({"ok": False, "reason": reasons[-1]})
            else:
                exclude_items.append({"ok": True, "reason": None})
        return {"passed": ok, "reasons": reasons, "n_detected": sum(len(v) for v in objs.values()),
                "items": items, "exclude_items": exclude_items, "ms": (time.perf_counter() - t0) * 1000}

    # -- the gate used by the cascade ---------------------------------------------------------------
    def gate(self, image, prompt: str, clip_min: float | None = None, spec: dict | None = None) -> dict:
        """Semantic verdict: structured check (if the prompt has checkable objects) AND CLIP >= clip_min."""
        t0 = time.perf_counter()
        spec = parse_prompt(prompt) if spec is None else spec
        clip = self.clip_scores([image], [prompt])[0]
        res = {"clip": clip, "structured": spec is not None, "check": None, "reasons": []}
        passed = True
        if clip_min is not None and clip < clip_min:
            passed = False
            res["reasons"].append(f"CLIP {clip:.1f} < {clip_min:.1f}")
        if spec is not None:
            res["check"] = self.check(image, spec)
            passed = passed and res["check"]["passed"]
            res["reasons"] += res["check"]["reasons"]
        res["passed"] = passed
        res["ms"] = (time.perf_counter() - t0) * 1000
        return res
