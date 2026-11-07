# Design document: P3 Studio

Team T58 · Problem P3: Resource-Efficient Text-to-Image Generation for Mobile Devices

This document explains **what we built, why each piece exists, and what we rejected**, with the measurement behind
every decision. Result tables: [`../eval_P3_T58.md`](../eval_P3_T58.md). Plain-language walkthrough of each stage:
[`../P3_SYSTEM_EXPLAINED.md`](../P3_SYSTEM_EXPLAINED.md).

---

## 1. Goal and constraints

- **Goal:** text-to-image that feels instant on a phone, with measurable savings in time, memory and model size, and
  quality close to a strong baseline.
- **Judged on:** speed, memory, model size, quality (CLIP, FID), quality vs cost, a working app, and honesty.
- **Compute we actually had:** free Colab and Kaggle T4 GPUs (16 GB), with daily or weekly limits. So every design
  choice had to run and be measured on a **T4**.
- **Time:** a hackathon. We preferred simple, measurable components over complex ones we couldn't validate.

## 2. Cloud-assisted, not on-device

The model (0.6B drawer + a 2B Gemma-2 text reader + an autoencoder) runs on a **GPU server**; the phone opens a web
page. We never claim the model runs on the phone, because we didn't test that.

*Why not on-device:* even after our optimizations the full pipeline needs ~3 GB of GPU memory and a CUDA GPU; phone
NPUs would need a different runtime (and new measurements) that didn't fit the time we had. Being **resource-efficient
on the server** (a third of the memory, 2–4× less time per picture) is what makes serving phones cheap.

## 3. Model: SANA-Sprint 0.6B

- **What it is:** a distilled version of SANA (linear-attention diffusion transformer working in a 32×32-compressed
  latent space, DC-AE autoencoder) that draws in **1–4 steps** instead of ~20.
- **Baseline:** its own **teacher** (same architecture, 20 steps + classifier-free guidance ≈ 40 network passes per
  picture). Same family, so the comparison isolates our optimizations.
- **Why it:** the strongest few-step model that fits a T4 comfortably, with a diffusers pipeline we could quantize.

## 4. Model-level optimizations (notebook 01)

We tried 15 setups and kept what the measurements supported (QUICK = 100 prompts; FULL = 500 prompts + FID on 5,000
real photos).

| Idea | Result | Decision |
|---|---|---|
| Distilled 2 steps instead of 20 | 4.7× faster, CLIP −0.17, FID better (87.2 vs 92.4) | **keep**: the main win |
| 1 step / 4 steps | 1 step not faster on a T4 and slightly worse; 4 steps slower, no better | 2 steps |
| 768px instead of 1024px | 7.8× faster overall (0.78 s) | **keep** as the cheap level R0 |
| 512px | pictures visibly broken (model trained at 1024px), CLIP ~25 | **reject** |
| 4-bit text reader + 4-bit drawer (bitsandbytes) | big memory and size saving, small speed cost | **keep** (M3) |
| Reader's word table (1.18 GB) moved to CPU, keeping Gemma's ×48 scale | −1.2 GB GPU, identical output (max diff 0.000000) | **keep** |
| Tiled decoding | removes the memory spike at the end | **keep** |
| `torch.compile` | 1.50 s vs 1.23 s, within noise on a T4 | reject |
| CPU offload | needs >12.7 GB system RAM, crashes free Colab | reject |

**Chosen model setup, M3:** 2 steps, 4-bit reader with its word table on the CPU, 4-bit drawer, tiled decoding.
**3.9× faster, −67% GPU memory (8.79 → 2.86 GB), 3× smaller, CLIP −0.09, FID better than the original.**

*Lesson:* on a T4 the drawer is no longer the bottleneck after distillation; the text reader and the decoder dominate.
That's why image size is the strongest speed lever, and why the memory tricks cost ~0.5–1 s.

## 5. Quality has two halves: visual and semantic

A picture can look perfect and still be wrong ("two dogs" with one dog), or match the prompt and look broken. So the
quality gate checks **both**:

| Half | Question | How | Built in |
|---|---|---|---|
| **Visual** | Does it look broken? (blank, blurry, too dark/bright, flat, grainy, colour tint, grid artefacts) | classical CV metrics with calibrated thresholds; prompt words like "night" or "foggy" switch off the matching flag | 02a, `src/p3_classical.py` |
| **Semantic** | Does it show what was asked? (objects, exact counts, colours, left/right/above/below) | prompt → checklist parser; COCO instance detector + CLIP colour test on masked crops; GenEval's position rule; plus overall CLIP match | 02b, `src/p3_semantic.py` |

The prompt parser reproduces GenEval's checklist exactly on all structured prompts we tested (553/553 GenEval
prompts during development). Prompts without checkable objects fall back to CLIP + the visual check.

## 6. The core idea: a quality-gated cascade

Most prompts don't need the expensive setting. So the system **starts cheap, checks the picture, and spends more
compute only when it fails**:

```
R0 (2 steps, 768px) → gate → pass? send : R1 (2 steps, 1024px, new seed) → gate → pass? send : R2 (1024px, new seed)
```

- **New seed at every level.** A failed composition (missing object, swapped colours) needs a *new* sample, not a
  sharper copy of the same one. 02b's rescue examples are exactly this: a colour swap at R0, correct at R1.
- **Gate rule** (02b, calibrated on training prompts only): no unfixable visual flag **and** the structured check
  passes (when the prompt has one) **and** gate-CLIP ≥ 29.95 (the 20th percentile of top-level training pictures).
- **Time budget:** never start a try that would end after 6 s (Balanced) or 9 s (Quality).

**Measured (02b, float16, 200 held-out prompts, independent judge):** the cascade reaches **76.7%** GenEval-style
accuracy at **2.00 s** on average (including checks), vs **80.0% at 6.84 s** for the original: **3.4× faster**, and
**96% visually clean** vs 92.5%. 58% of prompts finish at the cheapest level.

## 7. Two checkers: the gate and an independent judge

If the same checker both steered the cascade and scored it, the system would be grading its own homework.

| | Detector | CLIP | Role |
|---|---|---|---|
| **Gate** (fast, ~0.25–0.3 s) | Mask R-CNN v2 (torchvision) | ViT-B/16 | decides pass/fail inside the app |
| **Judge** (measurement only) | Mask2Former Swin-S (the kind GenEval uses) | ViT-L/14 | scores every strategy in the notebooks |

Both were **validated on real COCO photos with ground truth** before use: presence 96–98% correct, positions 88–100%,
but exact counts only 59% (gate) / 37% (judge). The gate agrees with the judge on **89%** of 573 test pictures; it is
too lenient on 6.5% and too strict on 4.4%.

## 8. The router: tried, measured, dropped

**Idea:** predict from the prompt which level will be needed and start there, skipping cheap tries that are likely to
fail. **Labels from experiments, not guesses:** every training prompt was generated at every level, and its label is
the cheapest level that passes the gate. Model: logistic regression on prompt clues (objects, counts, colours,
positions, length) + a PCA of the CLIP text embedding. Training prompts (our own GenEval-style prompts + COCO *train*
captions) never overlap the test prompts (official GenEval + COCO *val*).

**Result:** 46.5% correct on test labels, **below the 58% of always guessing the most common level**. The prompt text
doesn't predict which level a particular seed will need. "Router + cascade" was 77.5% at 1.82 s vs the plain cascade
at 76.7% at 2.00 s in float16, but 75.0% vs 78.3% on the deployed low-memory model. **We don't use it.** It stays in
the tables as an ablation; the code supports it (`"start": "router"`) if a better router appears.

## 9. Classical CV polish: accept or revert

After the final picture, classical fixes run **only for flagged problems** (gamma for dark, CLAHE for flat, bilateral
denoising, white balance, notch filter for grid artefacts, edge-aware sharpening), then the picture is **re-checked**.
A fix is kept only if a flagged problem went away and no new one appeared (including "added grain"); otherwise the
original is returned. On damaged photos this works well (dark SSIM 0.41 → 0.79). On SANA-Sprint's pictures it rarely
triggers and doesn't raise CLIP (26.20 → 26.18): a **safety net, not a quality boost**. Blur can't be fixed this way,
so blurry pictures go to a higher level instead.

## 10. Measured = deployed (notebooks 03a and 03b)

02b measured the cascade on the float16 model, but the app runs the low-memory M3 model. Quantization changes pictures
slightly, so we **re-measured** instead of assuming:

- **One engine** ([`src/p3_engine.py`](../src/p3_engine.py)) holds the generator loading, the gate, the router and
  the cascade. Notebook 03a measures with it; the server runs it.
- **03a:** 02b's 200 test prompts, same seeds, same gate threshold, same judge, on M3. Self-checks: replaying 02b's
  own results reproduces 02b's table exactly (difference 2e-16), and the router exported to JSON matches sklearn exactly.
  **Verdict:** Balanced 76.7% (float16) → 78.3% (M3), within noise: low memory costs no accuracy.
- **03b:** the real FastAPI server on a T4, tested through its API: response format, error codes, speed per mode,
  6 simultaneous requests, GPU memory.

| App mode | Strategy | Accuracy | Server time (avg / p90) |
|---|---|---|---|
| Fast | fixed R0 | 60.8% | 1.48 / 1.62 s |
| **Balanced** | cascade from R0 | **78.3%** | 3.42 / 5.15 s |
| Quality | cascade from R1 | 80.0% | 3.11 / 4.14 s |

## 11. Serving architecture

- **One server, one address.** A Hugging Face Space (Docker SDK, **T4 small**) runs FastAPI (`space/app.py`), which
  serves both the API and the phone app's static files. No cross-site requests, one link for judges.
- **Model loaded once at start-up**, plus a warm-up picture at every level; `/api/health` reports "loading" until ready.
- **One picture at a time on the GPU** (a lock). Up to 6 requests are accepted at once (1 drawing, 5 waiting); beyond
  that the API answers `BUSY` with a retry hint. Measured: 6 simultaneous requests all succeed; the last waits ~19 s.
- **API contract** ([`frontend/docs/API_CONTRACT.md`](../frontend/docs/API_CONTRACT.md)): every response carries the
  picture (WebP data URL), total and per-stage time, every try with its level and failure reasons, and the per-item
  check results. The phone app shows all of it, so users (and judges) see the cascade working.
- **Phone app:** Next.js 16 static export (no server features), mobile-first, installable to the home screen. A mock
  server that follows the same contract let the frontend be built in parallel without a GPU.
- **Pictures for phones:** the smallest WebP that keeps SSIM ≥ 0.95, about 12–35 KB per picture.
- **Prompt filter:** a basic word list for sexual content, graphic violence and self-harm (see the limitations doc).
  Server logs record only the prompt's length and mode, never its text.

**Hosting alternatives we rejected:** ZeroGPU (shared GPU with per-visitor quotas and queues; our 4-bit setup is
untested there; timings wouldn't match the T4 numbers), Vercel + a separate GPU backend (no speed gain, two places to
manage), a laptop with a tunnel (free, but the link dies when the laptop is off), Colab/Kaggle with a tunnel (against
their terms for hosting).

## 12. How we measured

- **Same hardware class for everything:** Tesla T4 16 GB, float16 (bfloat16 isn't supported on a T4).
- **Latency:** model-level = mean of 10 single pictures after warm-up, GPU time only; system-level = server time per
  request including checks, polish and encoding; no phone network time.
- **Memory:** peak `torch.cuda.max_memory_allocated` during a picture; model size = GPU-resident weights.
- **Quality:** CLIP ViT-L/14 (×100), FID/KID against 5,000 real COCO val photos (512px centre crop),
  GenEval-style accuracy from the independent judge.
- **No leakage:** router and gate threshold are fit on training prompts only; all reported accuracies are on held-out
  test prompts; the original model is scored on the same test prompts by the same judge.
- **Sample sizes:** notebook 01 FULL = 500 prompts; 02b/03a QUICK = 200 test prompts (120 GenEval + 80 COCO). In QUICK
  mode one GenEval prompt is 0.8 points of accuracy, so differences of 1–2 points are noise.

## 13. What we'd do next

1. **Better counting:** a counting-specialised detector in the gate (counting is our weakest task: 55% vs 70%).
2. **Image-side safety:** an NSFW / people classifier on every picture, not just a prompt word list.
3. **Live progress:** stream each try's result to the phone while the cascade runs.
4. **FULL-mode cascade evaluation** (all 553 GenEval prompts) for tighter accuracy numbers.
5. **Skip work on easy prompts:** cache the text reader's output for repeated prompts.
