"""p3_classical.py: the classical computer-vision layer of our P3 text-to-image system.

No neural networks in here, only image maths (OpenCV + NumPy). This layer judges VISUAL quality only.
Whether the picture matches the prompt (semantic quality) is checked elsewhere (CLIP + detector, notebook 02b).

    assess(img, prompt)        no-reference visual check -> metrics, flags, verdict ("ok" / "fix" / "regenerate")
    safe_enhance(img, prompt)  fix only what was flagged, re-check, and KEEP THE FIX ONLY IF IT HELPED
    quality_maps(img)          per-region detail / noise maps (so fixes touch only the regions that need them)
    upscale(img, size)         classical resizing, incl. an edge-aware upscaler (Lanczos + back-projection)
    pack_for_mobile(img)       resize + smallest WebP/JPEG that keeps SSIM >= target
    psnr(a, b), ssim(a, b)     reference metrics for the experiments

Images are RGB uint8 numpy arrays (H, W, 3). to_rgb() converts PIL images.
"""
from __future__ import annotations

import time

import cv2
import numpy as np

ANALYSIS_SIZE = 512  # checks run on a copy with this longest side, so thresholds don't depend on resolution

# Thresholds, calibrated on real photos + synthetic damage (notebook 02a re-validates them on held-out images).
TH = {
    "blank_std": 4.0,           # brightness spread below this -> blank / broken
    "dark_mean": 90.0,          # too dark: mean brightness below this ...
    "dark_p95": 135.0,          # ... AND even the brightest 5% are dim
    "bright_mean": 170.0,       # too bright / washed out: mean above this ...
    "bright_p5": 110.0,         # ... AND even the darkest 5% are light
    "low_contrast": 0.10,       # RMS contrast (std / 255) below this -> flat
    "blur": 0.04,               # contrast-normalised sharpness below this -> blurry
    "noise_sigma": 3.8,         # noise estimated in flat areas (grey levels) above this -> grainy
    "cast_gray": 13.0,          # colour shift of the near-grey pixels above this -> tint. Deliberately conservative:
                                # warm scenes (brown fur, lamp light) also score high, so only strong tints count
    "periodic": 2.5,            # FFT spike strength above this -> grid / checkerboard glitch
}

# Do-no-harm guard: a fix may not raise the noise estimate by more than this (grey levels), e.g. CLAHE/sharpening on sky.
MAX_ADDED_GRAIN = 1.5   # brightening alone adds ~+0.3 (reveals shadow noise); gamma+CLAHE can reach +2

# Problems a classical fix can't really undo: if they remain, the cascade should generate again with more steps.
UNFIXABLE = {"blank", "blurry", "noisy", "periodic_artifact"}

# Words in the prompt that mean "this look is intended, don't fix it".
INTENT = {
    "too_dark": ["night", "dark", "noir", "silhouette", "midnight", "shadow", "candlelit", "moody", "low light", "starry"],
    "too_bright": ["bright white", "overexposed", "high key", "snow", "foggy white", "minimalist white"],
    "low_contrast": ["fog", "foggy", "mist", "haze", "hazy", "pastel", "soft light", "dreamy", "minimalist"],
    "colour_cast": ["sunset", "sunrise", "golden", "neon", "sepia", "monochrome", "black and white",
                    "underwater", "vintage", "duotone", "red light", "blue light", "candle", "warm", "autumn",
                    "fire", "desert", "lamp", "cozy", "cosy", "tungsten", "night city"],
    "blurry": ["bokeh", "blurry", "blurred", "motion blur", "out of focus", "depth of field", "dreamy",
               "fog", "foggy", "mist", "long exposure", "soft focus"],
    "noisy": ["film grain", "grainy", "noise", "noisy", "vintage photo", "analog"],
}


# ----------------------------------------------------------------------------- helpers
def to_rgb(img) -> np.ndarray:
    """PIL image / array -> RGB uint8 array (H, W, 3)."""
    if hasattr(img, "convert"):
        return np.asarray(img.convert("RGB")).copy()
    a = np.asarray(img)
    if a.ndim == 2:
        a = np.stack([a] * 3, axis=-1)
    if a.dtype != np.uint8:
        a = np.clip(a, 0, 255).astype(np.uint8)
    return np.ascontiguousarray(a[..., :3])


def _analysis_view(rgb: np.ndarray) -> np.ndarray:
    h, w = rgb.shape[:2]
    s = ANALYSIS_SIZE / max(h, w)
    if s < 1:
        rgb = cv2.resize(rgb, (round(w * s), round(h * s)), interpolation=cv2.INTER_AREA)
    return rgb


def _gray(rgb: np.ndarray) -> np.ndarray:
    return cv2.cvtColor(rgb, cv2.COLOR_RGB2GRAY)


def _edge_strength(gray: np.ndarray) -> np.ndarray:
    g = gray.astype(np.float32)
    mag = cv2.magnitude(cv2.Sobel(g, cv2.CV_32F, 1, 0, ksize=3), cv2.Sobel(g, cv2.CV_32F, 0, 1, ksize=3))
    return cv2.GaussianBlur(mag, (0, 0), 1.5)


# ----------------------------------------------------------------------------- metrics
def sharpness(gray: np.ndarray) -> float:
    """Variance of the Laplacian divided by brightness variance: high = crisp edges.
    Dividing by contrast means a dark or flat picture isn't wrongly called blurry."""
    g = gray.astype(np.float64)
    return float(cv2.Laplacian(g, cv2.CV_64F).var() / (g.var() + 1e-6))


def noise_sigma(gray: np.ndarray) -> float:
    """Immerkaer (1996) noise estimate, measured only in the flattest half of the picture
    (so texture and edges are not mistaken for noise). Unit: grey levels."""
    g = gray.astype(np.float64)
    k = np.array([[1, -2, 1], [-2, 4, -2], [1, -2, 1]], np.float64)
    resp = np.abs(cv2.filter2D(g, -1, k, borderType=cv2.BORDER_REFLECT))[1:-1, 1:-1]
    edges = _edge_strength(gray)[1:-1, 1:-1]
    flat = edges <= np.percentile(edges, 50)
    return float(np.sqrt(np.pi / 2) * resp[flat].mean() / 6.0)


def colourfulness(rgb: np.ndarray) -> float:
    """Hasler & Suesstrunk (2003) colourfulness: 0 = grey, ~30 = normal photo, 60+ = very colourful."""
    r, g, b = (rgb[..., i].astype(np.float64) for i in range(3))
    rg, yb = r - g, 0.5 * (r + g) - b
    return float(np.hypot(rg.std(), yb.std()) + 0.3 * np.hypot(rg.mean(), yb.mean()))


def colour_cast(rgb: np.ndarray) -> tuple[float, float]:
    """Tint test in LAB on the NEAR-GREY pixels (the least colourful 15%, ignoring very dark/bright ones).
    In a normal picture those pixels are close to neutral, even if the scene is colourful (a red car, green grass).
    If even they are pushed towards one colour, the whole picture has a tint.
    Returns (shift of near-grey pixels, average shift of all pixels), both in LAB units."""
    lab = cv2.cvtColor(rgb, cv2.COLOR_RGB2LAB).astype(np.float64)
    L, a, b = lab[..., 0], lab[..., 1] - 128.0, lab[..., 2] - 128.0
    chroma = np.hypot(a, b)
    mid = (L > 40) & (L < 235)
    if mid.sum() < 100:
        mid = np.ones_like(L, bool)
    grayish = mid & (chroma <= np.percentile(chroma[mid], 15))
    gray_shift = float(np.hypot(a[grayish].mean(), b[grayish].mean()))
    return gray_shift, float(np.hypot(a.mean(), b.mean()))


def _spectrum_residual(gray: np.ndarray):
    """Log-magnitude spectrum minus its smooth background. Isolated spikes = periodic patterns."""
    g = gray.astype(np.float32)
    g = g - g.mean()
    h, w = g.shape
    win = np.outer(np.hanning(h), np.hanning(w)).astype(np.float32)
    spec = np.log1p(np.abs(np.fft.fftshift(np.fft.fft2(g * win)))).astype(np.float32)
    bg = cv2.GaussianBlur(spec, (0, 0), 3.0, borderType=cv2.BORDER_REFLECT_101)
    yy, xx = np.ogrid[:h, :w]
    r = np.hypot((yy - h // 2) / (h / 2), (xx - w // 2) / (w / 2))  # 0 = DC, 1 = Nyquist
    return spec - bg, r > 0.25  # ignore low frequencies (normal picture content lives there)


def periodic_score(gray: np.ndarray) -> float:
    resid, mask = _spectrum_residual(gray)
    return float(resid[mask].max())


# ----------------------------------------------------------------------------- 1. assess
def _intended(flag: str, prompt: str | None) -> bool:
    p = (prompt or "").lower()
    return any(word in p for word in INTENT.get(flag, []))


def assess(img, prompt: str | None = None) -> dict:
    """Visual quality check. Returns metrics, flags, ignored (flags the prompt asked for), verdict, qa_score."""
    rgb = _analysis_view(to_rgb(img))
    gray = _gray(rgb)
    g = gray.astype(np.float64)
    cast_gray, cast_all = colour_cast(rgb)
    m = {
        "mean": g.mean(), "p5": np.percentile(g, 5), "p95": np.percentile(g, 95), "std": g.std(),
        "contrast_rms": g.std() / 255.0, "sharpness": sharpness(gray), "noise_sigma": noise_sigma(gray),
        "colourfulness": colourfulness(rgb), "cast_gray": cast_gray, "cast_all": cast_all,
        "periodic": periodic_score(gray),
    }
    raw = []
    if m["std"] < TH["blank_std"]:
        raw.append("blank")
    else:
        if m["mean"] < TH["dark_mean"] and m["p95"] < TH["dark_p95"]:
            raw.append("too_dark")
        if m["mean"] > TH["bright_mean"] and m["p5"] > TH["bright_p5"]:
            raw.append("too_bright")
        if m["contrast_rms"] < TH["low_contrast"]:
            raw.append("low_contrast")
        if m["sharpness"] < TH["blur"]:
            raw.append("blurry")
        if m["noise_sigma"] > TH["noise_sigma"]:
            raw.append("noisy")
        if m["cast_gray"] > TH["cast_gray"]:
            raw.append("colour_cast")
        if m["periodic"] > TH["periodic"]:
            raw.append("periodic_artifact")
    flags = [f for f in raw if f == "blank" or not _intended(f, prompt)]
    ignored = [f for f in raw if f not in flags]
    verdict = "regenerate" if "blank" in flags else ("fix" if flags else "ok")
    return {
        "metrics": {key: float(v) for key, v in m.items()},
        "flags": flags,
        "ignored_by_prompt": ignored,
        "verdict": verdict,
        "qa_score": 0 if "blank" in flags else max(0, 100 - 15 * len(flags)),
    }


# ----------------------------------------------------------------------------- 2. corrections
def guided_filter(guide: np.ndarray, src: np.ndarray, r: int, eps: float) -> np.ndarray:
    """He et al. (2010) guided filter: edge-preserving smoothing in O(N). guide: gray uint8, src: uint8 (H,W[,3]).
    Returns float32 in [0, 1]."""
    I = guide.astype(np.float32) / 255.0
    p = src.astype(np.float32) / 255.0
    if p.ndim == 3:
        I = I[..., None]

    def box(x):
        y = cv2.boxFilter(x, -1, (2 * r + 1, 2 * r + 1), borderType=cv2.BORDER_REFLECT)
        return y[..., None] if (x.ndim == 3 and y.ndim == 2) else y

    mean_I, mean_p = box(I), box(p)
    a = (box(I * p) - mean_I * mean_p) / (box(I * I) - mean_I * mean_I + eps)
    b = mean_p - a * mean_I
    return box(a) * I + box(b)


def remove_periodic(rgb: np.ndarray, thresh: float | None = None) -> tuple[np.ndarray, int]:
    """Notch filter: find spikes in the frequency spectrum and push them down to the background level."""
    thresh = TH["periodic"] if thresh is None else thresh
    resid, mask = _spectrum_residual(_gray(rgb))
    peaks = (resid > thresh) & mask
    n = int(peaks.sum())
    if n == 0:
        return rgb, 0
    peaks = np.fft.ifftshift(cv2.dilate(peaks.astype(np.uint8), np.ones((5, 5), np.uint8)) > 0)
    out = np.empty(rgb.shape, np.float32)
    for c in range(3):
        F = np.fft.fft2(rgb[..., c].astype(np.float32))
        logmag = np.log1p(np.abs(F)).astype(np.float32)
        excess = logmag - cv2.GaussianBlur(logmag, (0, 0), 3.0, borderType=cv2.BORDER_REFLECT_101)
        # each channel's own spike height (measured without the window) is pushed down to its local background
        atten = np.where(peaks, np.exp(-np.clip(excess, 0, None)), 1.0)
        out[..., c] = np.real(np.fft.ifft2(F * atten))
    return np.clip(out, 0, 255).astype(np.uint8), n


def denoise(rgb: np.ndarray) -> tuple[np.ndarray, float]:
    """Edge-preserving bilateral filter, applied mainly in flat regions (textures and edges are kept)."""
    sigma = noise_sigma(_gray(rgb))
    den = cv2.bilateralFilter(rgb, 7, sigmaColor=max(10.0, 3.0 * sigma), sigmaSpace=3)
    den = cv2.bilateralFilter(den, 5, sigmaColor=max(10.0, 2.0 * sigma), sigmaSpace=2)
    e = _edge_strength(_gray(den))   # edges measured on the cleaned picture, so noise isn't mistaken for edges
    flat = 1.0 - np.clip(e / (np.percentile(e, 90) + 1e-6), 0, 1)
    out = flat[..., None] * den.astype(np.float32) + (1 - flat[..., None]) * rgb.astype(np.float32)
    return np.clip(out, 0, 255).astype(np.uint8), sigma


def white_balance(rgb: np.ndarray, strength: float = 0.8) -> np.ndarray:
    """Gray-pixel white balance (a gray-world variant) in LAB: measure the tint on the near-grey pixels only,
    then shift the whole picture back by `strength` of it. Colourful objects don't fool it."""
    lab = cv2.cvtColor(rgb, cv2.COLOR_RGB2LAB).astype(np.float32)
    L, a, b = lab[..., 0], lab[..., 1] - 128.0, lab[..., 2] - 128.0
    chroma = np.hypot(a, b)
    mid = (L > 40) & (L < 235)
    if mid.sum() < 100:
        mid = np.ones_like(L, bool)
    grayish = mid & (chroma <= np.percentile(chroma[mid], 15))
    lab[..., 1] -= strength * a[grayish].mean()
    lab[..., 2] -= strength * b[grayish].mean()
    return cv2.cvtColor(np.clip(lab, 0, 255).astype(np.uint8), cv2.COLOR_LAB2RGB)


def auto_gamma(rgb: np.ndarray, target: float = 0.45) -> tuple[np.ndarray, float]:
    """Gamma on brightness only (LAB L channel) so the average lands near `target`. Colours are kept."""
    lab = cv2.cvtColor(rgb, cv2.COLOR_RGB2LAB)
    mean = max(lab[..., 0].mean() / 255.0, 1e-3)
    gamma = float(np.clip(np.log(target) / np.log(mean), 0.45, 2.2))
    lut = (255.0 * (np.arange(256) / 255.0) ** gamma).clip(0, 255).astype(np.uint8)
    lab[..., 0] = cv2.LUT(lab[..., 0], lut)
    return cv2.cvtColor(lab, cv2.COLOR_LAB2RGB), gamma


def clahe(rgb: np.ndarray, clip: float = 2.0, tiles: int = 8) -> np.ndarray:
    """CLAHE (local contrast) on brightness only."""
    lab = cv2.cvtColor(rgb, cv2.COLOR_RGB2LAB)
    lab[..., 0] = cv2.createCLAHE(clipLimit=clip, tileGridSize=(tiles, tiles)).apply(lab[..., 0])
    return cv2.cvtColor(lab, cv2.COLOR_LAB2RGB)


def edge_aware_sharpen(rgb: np.ndarray, amount: float) -> np.ndarray:
    """Boost detail ONLY around edges: detail = image - guided-filter base, weighted by an edge mask.
    Flat areas (sky, skin) are left alone, so noise isn't amplified and halos stay small."""
    gray = _gray(rgb)
    base = guided_filter(gray, rgb, r=2, eps=1e-3)
    img = rgb.astype(np.float32) / 255.0
    e = _edge_strength(gray)
    mask = np.clip(e / (np.percentile(e, 95) + 1e-6), 0, 1)[..., None]
    return np.clip((img + amount * (img - base) * mask) * 255.0, 0, 255).astype(np.uint8)


def _apply_fixes(rgb: np.ndarray, rep: dict, stages: list | None, prompt: str | None):
    m, flags, actions, out = rep["metrics"], rep["flags"], [], rgb

    def log(name, img):
        actions.append(name)
        if stages is not None:
            stages.append((name, img))

    if "periodic_artifact" in flags:
        out, n = remove_periodic(out)
        log(f"notch filter (removed {n} spectrum spikes)", out)
        rep = assess(out, prompt)          # a grid also looks like noise: re-check before the next fixes
        m, flags = rep["metrics"], rep["flags"]
    if "noisy" in flags:
        out, sigma = denoise(out)
        log(f"edge-preserving denoise (noise sigma {sigma:.1f})", out)
    if "colour_cast" in flags:
        out = white_balance(out, 0.6)
        log(f"gray-pixel white balance (tint {m['cast_gray']:.1f} LAB units)", out)
    if "too_dark" in flags or "too_bright" in flags:
        out, gamma = auto_gamma(out)
        log(f"gamma on brightness (gamma {gamma:.2f})", out)
    # CLAHE for flat pictures. Dark pictures get it only if they're STILL flat after gamma:
    # on dark pictures CLAHE mostly amplifies grain in smooth areas (sky, walls).
    contrast_now = _gray(out).std() / 255.0
    if "low_contrast" in flags or contrast_now < TH["low_contrast"]:
        clip = float(np.clip(1.5 + 15 * (TH["low_contrast"] - contrast_now), 1.5, 3.0))
        out = clahe(out, clip)
        log(f"CLAHE local contrast (clip {clip:.1f})", out)
    if "blurry" in flags:
        amount = float(np.clip(0.6 + 2.0 * (TH["blur"] - m["sharpness"]) / TH["blur"], 0.6, 1.8))
        out = edge_aware_sharpen(out, amount)
        log(f"edge-aware sharpen (amount {amount:.2f})", out)
    return out, actions


def safe_enhance(img, prompt: str | None = None, return_stages: bool = False) -> tuple[np.ndarray, dict]:
    """Fix only what assess() flagged, then RE-CHECK. Keep the fix only if
    (1) at least one flagged problem is gone or clearly better, and (2) no new problem appeared.
    Otherwise return the original picture untouched ("do no harm")."""
    t0 = time.perf_counter()
    rgb = to_rgb(img)
    before = assess(rgb, prompt)
    stages = [("input", rgb)] if return_stages else None
    info = {"before": before, "after": None, "actions": [], "accepted": False, "decision": "",
            "escalate": False, "stages": stages}

    if before["verdict"] == "regenerate":
        info.update(escalate=True, decision="blank/broken: nothing to fix, ask the generator for a new picture")
    elif before["verdict"] == "ok":
        info["decision"] = "no visual problems: original kept"
    else:
        out, actions = _apply_fixes(rgb, before, stages, prompt)
        after = assess(out, prompt)
        fixed = [f for f in before["flags"] if f not in after["flags"]]
        new = [f for f in after["flags"] if f not in before["flags"]]
        grain_added = after["metrics"]["noise_sigma"] - before["metrics"]["noise_sigma"]
        if "noisy" not in before["flags"] and grain_added > MAX_ADDED_GRAIN:
            new.append(f"added_grain(+{grain_added:.1f})")   # a fix must not make smooth areas grainy
        info.update(after=after, actions=actions)
        if fixed and not new:
            info.update(accepted=True, decision=f"fix kept: solved {fixed}")
            rgb = out
            remaining = after["flags"]
        else:
            info["decision"] = f"fix rejected (solved {fixed}, new problems {new}): original kept"
            remaining = before["flags"]
        # Classical CV can't undo real blur, heavy noise or broken structure -> the cascade should spend more steps.
        unfixable = [f for f in remaining if f in UNFIXABLE]
        if unfixable:
            info.update(escalate=True, decision=info["decision"] + f"; still {unfixable}: escalate to a higher rung")
    info["ms"] = (time.perf_counter() - t0) * 1000
    return rgb, info


# ----------------------------------------------------------------------------- 3. region maps (visualisation)
def quality_maps(img, tile: int = 32) -> dict:
    """Per-tile detail (sharpness) and noise maps on the analysis-size picture, for 'where is it bad?' views."""
    gray = _gray(_analysis_view(to_rgb(img)))
    h, w = gray.shape
    rows, cols = h // tile, w // tile
    detail, noise = np.zeros((rows, cols)), np.zeros((rows, cols))
    lap = cv2.Laplacian(gray.astype(np.float64), cv2.CV_64F)
    for i in range(rows):
        for j in range(cols):
            sl = (slice(i * tile, (i + 1) * tile), slice(j * tile, (j + 1) * tile))
            detail[i, j] = lap[sl].var()
            noise[i, j] = noise_sigma(gray[sl])
    return {"detail": detail, "noise": noise}


# ----------------------------------------------------------------------------- 4. resizing
_INTERP = {"nearest": cv2.INTER_NEAREST, "bilinear": cv2.INTER_LINEAR,
           "bicubic": cv2.INTER_CUBIC, "lanczos": cv2.INTER_LANCZOS4}


def upscale(img, size: tuple[int, int], method: str = "edge_aware", iters: int = 4) -> np.ndarray:
    """Resize to size=(width, height). 'edge_aware' = Lanczos + iterative back-projection
    (Irani & Peleg 1991): repeatedly fix the big picture so that shrinking it gives back the small one."""
    rgb = to_rgb(img)
    W, H = size
    if method in _INTERP:
        return cv2.resize(rgb, (W, H), interpolation=_INTERP[method])
    if method != "edge_aware":
        raise ValueError(f"unknown method {method!r}")
    h, w = rgb.shape[:2]
    lr = rgb.astype(np.float32)
    x = cv2.resize(lr, (W, H), interpolation=cv2.INTER_LANCZOS4)
    for _ in range(iters):
        err = lr - cv2.resize(x, (w, h), interpolation=cv2.INTER_AREA)
        x += cv2.resize(err, (W, H), interpolation=cv2.INTER_CUBIC)
    return np.clip(x, 0, 255).astype(np.uint8)


# ----------------------------------------------------------------------------- 5. reference metrics
def psnr(a, b) -> float:
    mse = np.mean((to_rgb(a).astype(np.float64) - to_rgb(b).astype(np.float64)) ** 2)
    return float("inf") if mse == 0 else float(10 * np.log10(255.0 ** 2 / mse))


def ssim(a, b) -> float:
    """Standard SSIM (Wang et al. 2004) on brightness, 11x11 Gaussian window."""
    x, y = (_gray(to_rgb(i)).astype(np.float64) for i in (a, b))
    c1, c2 = (0.01 * 255) ** 2, (0.03 * 255) ** 2

    def blur(z):
        return cv2.GaussianBlur(z, (11, 11), 1.5)

    mx, my = blur(x), blur(y)
    vx, vy, cxy = blur(x * x) - mx * mx, blur(y * y) - my * my, blur(x * y) - mx * my
    return float((((2 * mx * my + c1) * (2 * cxy + c2)) / ((mx * mx + my * my + c1) * (vx + vy + c2))).mean())


# ----------------------------------------------------------------------------- 6. packing for phones
def encode(img, fmt: str = "webp", quality: int = 85) -> bytes:
    bgr = cv2.cvtColor(to_rgb(img), cv2.COLOR_RGB2BGR)
    fmt = fmt.lower()
    if fmt == "png":
        ok, buf = cv2.imencode(".png", bgr, [cv2.IMWRITE_PNG_COMPRESSION, 6])
    elif fmt in ("jpg", "jpeg"):
        ok, buf = cv2.imencode(".jpg", bgr, [cv2.IMWRITE_JPEG_QUALITY, int(quality)])
    elif fmt == "webp":
        ok, buf = cv2.imencode(".webp", bgr, [cv2.IMWRITE_WEBP_QUALITY, int(quality)])
    else:
        raise ValueError(f"unknown format {fmt!r}")
    if not ok:
        raise RuntimeError(f"encoding to {fmt} failed")
    return buf.tobytes()


def decode(data: bytes) -> np.ndarray:
    return cv2.cvtColor(cv2.imdecode(np.frombuffer(data, np.uint8), cv2.IMREAD_COLOR), cv2.COLOR_BGR2RGB)


def pack_for_mobile(img, max_side: int = 1024, fmt: str = "webp", min_ssim: float = 0.95,
                    q_lo: int = 30, q_hi: int = 95) -> tuple[bytes, dict]:
    """Shrink to the phone's size, then binary-search the SMALLEST quality whose SSIM >= min_ssim.
    SSIM is measured on a <=512px copy to keep the search fast (~5 encodes)."""
    t0 = time.perf_counter()
    rgb = to_rgb(img)
    h, w = rgb.shape[:2]
    if max(h, w) > max_side:
        s = max_side / max(h, w)
        rgb = cv2.resize(rgb, (round(w * s), round(h * s)), interpolation=cv2.INTER_AREA)
    # Search the quality on a <=512px copy (fast), then encode the full-size picture once.
    ref = _analysis_view(rgb)
    best_q = q_hi
    lo, hi = q_lo, q_hi
    while lo <= hi:
        q = (lo + hi) // 2
        if ssim(ref, decode(encode(ref, fmt, q))) >= min_ssim:
            best_q, hi = q, q - 2
        else:
            lo = q + 2
    q = best_q
    data = encode(rgb, fmt, q)
    s_val = ssim(ref, _analysis_view(decode(data)))
    return data, {"format": fmt, "quality": q, "kb": len(data) / 1024, "ssim": s_val,
                  "size": rgb.shape[1::-1], "ms": (time.perf_counter() - t0) * 1000}
