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
