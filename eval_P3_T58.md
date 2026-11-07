1RUA24CSE0335,1RUA24CSE0340,1RUA24CSE0347,1RUA25CSE0553

# Evaluation results: P3 (Resource-Efficient Text-to-Image Generation for Mobile Devices), Team T58

- **Baseline** `B0_teacher_20step`: SANA-Sprint teacher (0.6B), 20 steps + classifier-free guidance, 1024px, float16
- **Optimized (main)** `M3_lowmem_1024_tr4bit`: SANA-Sprint 0.6B distilled, 2 steps, 1024px. It uses a 4-bit text reader with its word table in system RAM, a 4-bit drawer, and tiled decoding.
- **Optimized (fast mode)** `S8_res768`: SANA-Sprint 0.6B, 2 steps, 768px, float16
- **Prompts:** 500 captions from MS-COCO 2017 *val* (seed 0). FID/KID reference: 5,000 real COCO val images (512px centre crop)
- **Hardware:** Tesla T4 (16 GB), float16. Latency = mean of 10 single-image runs after warm-up (GPU time only, no network)
- **Source:** `notebooks/P3_01_optimization_lab_FULL_results.ipynb` (FULL mode)

| # | Metric | Baseline | Optimized (M3) | Change | Fast mode (S8) |
|---|---|---|---|---|---|
| 1 | CLIP similarity (ViT-L/14, ×100), higher is better | 26.60 | 26.52 | −0.09 | 26.25 |
| 2 | FID, lower is better (KID ×1000 in brackets) | 92.39 (9.04) | 86.24 (6.88) | −6.15 (better) | 85.59 (7.58) |
| 3 | Image generation latency (s) | 6.076 | 1.567 | 3.9× faster | 0.776 (7.8× faster) |
| 4 | Peak GPU memory (GB) | 8.79 | 2.86 | 3.1× less (−67%) | 8.03 |
| 5 | Model size (MB, GPU-resident weights) | 7037 | 2355 | 3.0× smaller | 7040 |
| 6 | Quality vs computational cost | 40 network passes per image | 2 passes per image | 20× fewer passes; see the tables below | 2 passes |

For M3, another 1.18 GB (the reader's word table) sits in system RAM, not on the GPU. Its output matches the GPU version exactly (max difference 0.000000).

## Quality vs cost: all setups (ablation, FULL mode)

| Setup | Steps | Res | CLIP ↑ | FID ↓ | KID×1000 ↓ | Latency (s) | p90 (s) | Peak GPU (GB) | Size (MB) | Speed-up | Memory saving |
|---|---|---|---|---|---|---|---|---|---|---|---|
| B0 teacher, 20 steps + CFG | 20 | 1024 | 26.60 | 92.39 | 9.04 | 6.076 | 6.316 | 8.79 | 7037 | 1.0× | 1.0× |
| S1 Sprint, 2 steps | 2 | 1024 | 26.43 | 87.20 | 8.42 | 1.285 | 1.303 | 8.79 | 7040 | 4.7× | 1.0× |
| S8 Sprint, 768px | 2 | 768 | 26.25 | 85.59 | 7.58 | 0.776 | 0.788 | 8.03 | 7040 | 7.8× | 1.1× |
| M2 low-memory, 768px | 2 | 768 | 26.27 | 85.52 | 6.47 | 1.210 | 1.283 | 2.99 | 2512 | 5.0× | 2.9× |
| **M3 low-memory, 1024px** | 2 | 1024 | **26.52** | 86.24 | 6.88 | 1.567 | 1.601 | **2.86** | **2355** | 3.9× | **3.1×** |

The full 15-setup ladder (8-bit/4-bit variants, 1/2/4 steps, 512px, `torch.compile`, CPU offload) is in `P3_SYSTEM_EXPLAINED.md`, section 4.1 (QUICK mode, 100 prompts).

## Quality-gated cascade vs the original (notebook 02b)

Both use the same 200 held-out test prompts: 120 official GenEval prompts and 80 COCO val captions. Both are scored by the same independent judge (Mask2Former + CLIP ViT-L/14). Our times **include** the quality checks.

| Strategy | Avg latency (s) | p90 latency (s) | GenEval-style accuracy | CLIP ViT-L/14 | Visually clean |
|---|---|---|---|---|---|
| Fixed R0 (2 steps, 768px) | 0.74 | 0.74 | 65.8% | 27.57 | 90.5% |
| Fixed R2 (2 steps, 1024px) | 1.26 | 1.26 | 77.5% | 27.94 | 93.0% |
| **Cascade from R0 (ours)** | **2.00** | 3.94 | **76.7%** | **28.02** | **96.0%** |
| Router + cascade | 1.82 | 3.94 | 77.5% | 27.99 | 95.0% |
| Original teacher (20 steps) | 6.84 | 6.84 | 80.0% | 28.05 | 92.5% |

- The cascade is **3.4× faster** than the original with nearly the same quality. 58% of prompts finish at the cheapest level.
- The fast gate agrees with the independent judge on **89%** of 573 test pictures.
- **The router did not help.** It was right 46.5% of the time, below the 58% majority baseline, so the deployed system uses the cascade without it.
- **Weak spot:** counting, at 55% for ours vs 70% for the original.

"GenEval-style" means our own detector-based checks on the official GenEval prompts. It is not the official GenEval benchmark.

## The deployed system: low-memory model + quality-gated cascade (notebooks 03a and 03b)

The app runs the **M3 low-memory model** with the cascade. Notebook 03a re-ran 02b's 200 held-out test prompts on M3 with the **same seeds, gate and independent judge**, so the comparison with 02b's float16 results is like for like. Notebook 03b then ran the **actual server** (`space/app.py`) on a T4 and measured every app mode through its API.

### Same strategies, float16 vs the low-memory model (GenEval-style accuracy on the 120 GenEval prompts; CLIP on all 200)

| Strategy | Float16: accuracy | Float16: CLIP-L | Float16: avg time | **Low-memory M3: accuracy** | **M3: CLIP-L** | **M3: avg time** |
|---|---|---|---|---|---|---|
| Fixed R0 (768px) | 65.8% | 27.57 | 0.74 s | 60.8% | 27.43 | 0.98 s |
| Fixed R2 (1024px) | 77.5% | 27.94 | 1.26 s | 75.8% | 27.79 | 1.86 s |
| **Cascade from R0 (app: Balanced)** | 76.7% | 28.02 | 2.00 s | **78.3%** | 27.77 | 2.98 s |
| **Cascade from R1 (app: Quality)** | 78.3% | 27.98 | 2.10 s | **80.0%** | 27.75 | 3.09 s |
| Router + cascade (not used) | 77.5% | 27.99 | 1.82 s | 75.0% | 27.93 | 2.59 s |
| Original teacher, 20 steps (float16 only) | 80.0% | 28.05 | 6.84 s | | | |

Times include the quality check after every try (fixed rows: generation only, as in 02b).

- **Low memory costs no accuracy.** Balanced mode scores 78.3% on M3 vs 76.7% on float16 (+1.7 points; one prompt = 0.8 points, so this is within noise).
- **It costs some speed.** 4-bit weights are dequantized on the fly on a T4: +0.24 s per 768px picture and +0.6–0.7 s per 1024px picture.
- **Timing caveat:** float16 was timed on a Colab T4 (02b) and M3 on a Kaggle T4 (03a/03b). Treat speed differences between them as approximate. Accuracy comparisons are exact (same prompts, seeds and judge).

### The app as deployed (server on a T4, measured through its API by 03b; accuracy from 03a)

| App mode | Strategy | GenEval-style accuracy | CLIP-L | Server time: avg / p90 / worst | Tries (avg) | Picture sent |
|---|---|---|---|---|---|---|
| Fast | fixed R0 | 60.8% | 27.43 | 1.48 / 1.62 / 1.69 s | 1.0 | 18 KB WebP |
| **Balanced (default)** | cascade from R0 | **78.3%** | 27.77 | **3.42** / 5.15 / 5.24 s | 2.1 | 30 KB WebP |
| Quality | cascade from R1 | **80.0%** | 27.75 | 3.11 / 4.14 / 4.20 s | 1.5 | 34 KB WebP |
| Original teacher | 20 steps | 80.0% | 28.05 | 6.84 s (generation only) | 1 | |

Server time covers everything the user waits for except the phone's network: drawing, checking after every try, polish, and WebP encoding. 20 held-out prompts per mode.

| Resource (deployed app) | Value | Source |
|---|---|---|
| GPU memory, generator + gate loaded | **2.91 GB** | 03a |
| GPU memory, peak during a full 1024px request | **3.45 GB** | 03a |
| GPU memory of the running server (incl. PyTorch's cache) | 4.13 GB | 03b (nvidia-smi) |
| Original teacher alone, peak | 8.79 GB | 01 |
| API contract test (9 requests, 3 modes) | 9/9 match | 03b |
| Error handling (6 bad requests) | 6/6 correct codes | 03b |
| 6 simultaneous requests | 6/6 succeeded; the last waited 19.1 s (one GPU, queued) | 03b |

**Headline (system level):** Balanced mode gives **78.3% vs 80.0%** GenEval-style accuracy against the original, **2.3× faster** (2.98 s incl. checks vs 6.84 s), using **2.9–3.5 GB instead of 8.79 GB** of GPU memory. Quality mode matches the original's 80.0% on these 120 prompts in 3.1 s.

## Classical computer vision (notebook 02a, CPU)

Tested on held-out COCO photos with damage added on purpose (`notebooks/P3_02a_classical_cv_results.ipynb`):

- **Detection:** 90–100% for too dark, too bright, noise, blank and grid glitches. Mild colour casts are caught only 15% of the time.
- **Accept-or-revert fixes help:** SSIM on darkened photos 0.41 → 0.79; checkerboard artefacts 0.74 → 0.97. An independent no-reference score (BRISQUE) improves 45.5 → 18.5, better in 84% of kept fixes.
- **Blur can't be fixed** by classical means, so it is escalated to a higher level (100%).
- **False alarms:** 15% on clean photos, but the re-check leaves 90% of those untouched.
- **Mobile packing:** smallest WebP with SSIM ≥ 0.95: 37 KB vs 954 KB PNG (26× smaller).
- **In the cascade** (02b), polish doesn't raise CLIP (26.20 → 26.18). It is a safety net, not a quality boost.

More detail: `README.md`, `docs/DESIGN.md`, and `docs/LIMITATIONS_AND_ETHICS.md` (including failure cases).
