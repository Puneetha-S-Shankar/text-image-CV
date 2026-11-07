# Overnight results: notebook 01, FULL mode

- **Run:** Colab (puneethasshankar@gmail.com), Tesla T4, float16.
- **Prompts:** 500 MS-COCO 2017 *val* captions (seed 0).
- **Realness reference (FID/KID):** 5,000 real COCO val photos.
- **Latency:** mean of 10 single-image runs after warm-up (GPU time only).
- **Timing:** all 5 setups finished in **102.5 min**. No errors, no black images. Colab marked the run complete at 02:48.
- **Saved to that account's Drive:** `P3_T2I/01_optimization_lab/results_full_n500/` (one JSON per setup), plus `eval_P3_T00.md`, `results_full_n500.csv` and the figures.

## Results (FULL: 500 prompts)

| Setup | What it is | CLIP ↑ | FID ↓ | KID×1000 ↓ | Time (s) ↓ | p90 (s) | Peak GPU (GB) ↓ | Size (MB) ↓ | Speed-up | Memory saved |
|---|---|---|---|---|---|---|---|---|---|---|
| **B0** | Baseline: teacher, 20 steps + guidance, 1024px | 26.60 | 92.39 | 9.04 | 6.08 | 6.32 | 8.79 | 7037 | 1.0× | none |
| S1 | Sprint, 2 steps, 1024px | 26.43 | 87.20 | 8.42 | 1.29 | 1.30 | 8.79 | 7040 | **4.7×** | 0% |
| S8 | Sprint, 2 steps, 768px | 26.25 | 85.59 | 7.58 | **0.78** | 0.79 | 8.03 | 7040 | **7.8×** | 9% |
| **M2** | Low-memory, 768px (4-bit reader, word table on CPU, 8-bit drawer, tiled decode) | 26.27 | **85.52** | **6.47** | 1.21 | 1.28 | **2.99** | 2512 | **5.0×** | **66%** |
| **M3** | Low-memory, 1024px, 4-bit drawer (smallest) | **26.52** | 86.24 | 6.88 | 1.57 | 1.60 | **2.86** | **2355** | **3.9×** | **67.5%** |

## What changed vs the QUICK run (100 prompts)
- **FID roughly halved for every setup** (e.g. baseline 191 → 92). That's purely the bigger sample: FID with 100 images is heavily inflated. These FULL numbers are the ones to report.
- **Latency came out a bit lower on this T4 machine:** S8 0.96 → 0.78 s, M3 1.90 → 1.57 s, M2 1.40 → 1.21 s. GPUs vary between Colab sessions, so quote FULL-run numbers consistently.
- **The ranking stays the same.** Every optimized setup is **more realistic than the baseline** (FID 85.5–87.2 vs 92.4, KID 6.5–8.4 vs 9.0), with CLIP **within 0.1–0.36 points** (≤1.3%).

## Headline candidates (pick one for the write-up)
- **M2 (best all-round):** 5.0× faster, 66% less GPU memory (8.79 → 2.99 GB), 2.8× smaller model (7.04 → 2.51 GB). Also *more* realistic: FID 85.5 vs 92.4, KID −28%. CLIP −0.33 (−1.2%).
- **M3 (closest quality, smallest):** 3.9× faster, 67.5% less memory, 3.0× smaller. CLIP 26.52 vs 26.60 (−0.3%). FID 86.2 vs 92.4.
- **S8 (fastest):** 7.8× faster (0.78 s per image). Memory is unchanged, though.

## Things to fix in the auto-generated eval file
1. It auto-picked **S8** as "optimized", because S8 is the fastest within the CLIP tolerance. If the headline is M2 or M3, change the "Optimized" column.
2. **The Team ID is still `T00`.** Rename the file to `eval_P3_<your team ID>.md`.
3. The first line already has the correct USNs: `1RUA24CSE0335,1RUA24CSE0340,1RUA24CSE0347,1RUA25CSE0553`.
4. The real submission file should also include 02b's results: GenEval-style accuracy, the cascade, and ours vs the original.

## Draft eval text produced by the notebook (headline = S8)

```
1RUA24CSE0335,1RUA24CSE0340,1RUA24CSE0347,1RUA25CSE0553

# Evaluation results: P3 (Resource-Efficient Text-to-Image), Team T00
- Baseline B0_teacher_20step: SANA-Sprint teacher (0.6B), 20 steps + classifier-free guidance, 1024px
- Optimized S8_res768: S1 at 768px
- Prompts: 500 captions from MS-COCO 2017 val (seed 0). FID/KID reference: 5000 real COCO val images (512px centre crop)
- Hardware: Tesla T4, float16. Latency = mean of 10 single-image runs after warm-up (GPU time only, no network)

| # | Metric | Baseline | Optimized | Change |
| 1 | CLIP similarity (ViT-L/14, x100) | 26.60 | 26.25 | -0.36 |
| 2 | FID (KID x1000) | 92.39 (9.04) | 85.59 (7.58) | -6.80 |
| 3 | Image generation latency (s) | 6.076 | 0.776 | 7.8x faster |
| 4 | Peak GPU memory (GB) | 8.79 | 8.03 | 1.10x less |
| 5 | Model size (MB, all weights) | 7037 | 7040 | 1.00x smaller |
| 6 | Quality vs computational cost | 40 network passes per image | 2 passes per image | see table |
```

## Failed setups
None. All 5 setups have status `ok`.

## Not done overnight
- **Notebook 02b** (other Chrome profile/account): I can't see it. Check its tab for `Saved: cascade_config.json` at the end.
- **The Colab runtime on this account is still connected but idle.** Colab will disconnect it automatically; nothing in Drive is lost.
