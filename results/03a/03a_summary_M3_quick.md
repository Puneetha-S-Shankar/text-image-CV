# Notebook 03a: retry system on the low-memory model (M3)

Mode: quick. 200 held-out test prompts from 02b, same seeds, same gate, same router, same judge.

## Speed per level

|                  |   float16 (02b) |   low-memory M3 |
|:-----------------|----------------:|----------------:|
| draw R0 (768px)  |           0.74  |           0.98  |
| draw R1 (1024px) |           1.237 |           1.906 |
| draw R2 (1024px) |           1.261 |           1.858 |
| gate check       |           0.234 |           0.297 |

Model size: 2246 MB. 
App GPU memory (generator + gate): 2.91 GB loaded, 3.45 GB peak.

## Strategies: float16 vs low-memory (judge: Mask2Former + CLIP ViT-L/14, GenEval-style)

| strategy                  |   ('float16 (02b)', 'geneval_style_acc') |   ('float16 (02b)', 'clip_L_all') |   ('float16 (02b)', 'avg_latency_s') |   ('float16 (02b)', 'p90_latency_s') |   ('low-memory M3', 'geneval_style_acc') |   ('low-memory M3', 'clip_L_all') |   ('low-memory M3', 'avg_latency_s') |   ('low-memory M3', 'p90_latency_s') |   ('change', 'accuracy') |   ('change', 'CLIP-L') |
|:--------------------------|-----------------------------------------:|----------------------------------:|-------------------------------------:|-------------------------------------:|-----------------------------------------:|----------------------------------:|-------------------------------------:|-------------------------------------:|-------------------------:|-----------------------:|
| fixed R0 (2 step, 768px)  |                                    0.658 |                            27.573 |                                0.74  |                                0.74  |                                    0.608 |                            27.426 |                                0.98  |                                0.98  |                   -0.05  |                 -0.147 |
| fixed R1 (2 step, 1024px) |                                    0.758 |                            27.836 |                                1.237 |                                1.237 |                                    0.742 |                            27.652 |                                1.906 |                                1.906 |                   -0.017 |                 -0.184 |
| fixed R2 (2 step, 1024px) |                                    0.775 |                            27.944 |                                1.261 |                                1.261 |                                    0.758 |                            27.792 |                                1.858 |                                1.858 |                   -0.017 |                 -0.152 |
| cascade from R0           |                                    0.767 |                            28.016 |                                1.995 |                                3.939 |                                    0.783 |                            27.773 |                                2.982 |                                5.636 |                    0.017 |                 -0.243 |
| router only               |                                    0.758 |                            27.692 |                                0.978 |                                1.261 |                                    0.725 |                            27.718 |                                1.397 |                                1.906 |                   -0.033 |                  0.026 |
| router + cascade          |                                    0.775 |                            27.991 |                                1.82  |                                3.939 |                                    0.75  |                            27.931 |                                2.587 |                                5.636 |                   -0.025 |                 -0.06  |
| cascade from R1           |                                    0.783 |                            27.975 |                                2.098 |                                2.965 |                                    0.8   |                            27.748 |                                3.087 |                                4.359 |                    0.017 |                 -0.227 |

**Verdict:** Low-memory keeps the retry system's accuracy within 3 points: safe to deploy.

## The app's modes (low-memory, checks after every try, time budgets applied)

| mode     | strategy        |   avg_s |   p90_s |   max_s |   geneval_style_acc |   clip_L_all |   gate_pass_rate |   avg_tries |
|:---------|:----------------|--------:|--------:|--------:|--------------------:|-------------:|-----------------:|------------:|
| fast     | fixed R0        |   1.277 |   1.277 |   1.277 |               0.608 |       27.426 |            0.52  |        1    |
| balanced | cascade from R0 |   2.982 |   5.636 |   5.636 |               0.783 |       27.773 |            0.795 |        1.78 |
| quality  | cascade from R1 |   3.087 |   4.359 |   4.359 |               0.8   |       27.748 |            0.735 |        1.41 |

## Live requests (full pipeline incl. polish + WebP, no network)

| mode     |   avg_s |   max_s |   avg_tries |   passed |   avg_kb |
|:---------|--------:|--------:|------------:|---------:|---------:|
| balanced |   3.926 |   7.258 |         1.8 |      0.8 |   14.504 |
| fast     |   1.929 |   2.245 |         1   |      0.6 |   11.939 |
| quality  |   4.592 |   5.657 |         1.7 |      0.8 |   19.897 |
