# Notebook 02b results: router + quality-gated cascade

Mode: quick. Test prompts: 200 (120 official GenEval + 80 COCO val). Scores from the independent judge (Mask2Former Swin-S + CLIP ViT-L/14), GenEval-style, not official GenEval.

## Checker validation on real COCO photos

| kind           |   gate |   judge |   n |
|:---------------|-------:|--------:|----:|
| count false    |  1     |   0.926 |  27 |
| count true     |  0.593 |   0.37  |  27 |
| position false |  1     |   1     |  41 |
| position true  |  0.878 |   0.951 |  41 |
| presence false |  0.98  |   0.96  | 100 |
| presence true  |  0.971 |   0.983 | 175 |

## Speed

|                                |   seconds |
|:-------------------------------|----------:|
| generate R0 (2 step, 768px)    |     0.74  |
| generate R1 (2 step, 1024px)   |     1.237 |
| generate R2 (2 step, 1024px)   |     1.261 |
| gate check (visual + semantic) |     0.234 |

## Strategies on held-out test prompts

| strategy                            |   avg_latency_s |   p90_latency_s |   geneval_style_acc |   clip_L_coco |   clip_L_all |   visual_ok |   ends_at_R0 |   ends_at_R1 |   ends_at_R2 |
|:------------------------------------|----------------:|----------------:|--------------------:|--------------:|-------------:|------------:|-------------:|-------------:|-------------:|
| fixed R0 (2 step, 768px)            |           0.74  |           0.74  |               0.658 |        26.23  |       27.573 |       0.905 |        1     |         0    |        0     |
| fixed R1 (2 step, 1024px)           |           1.237 |           1.237 |               0.758 |        26.395 |       27.836 |       0.935 |        0     |         1    |        0     |
| fixed R2 (2 step, 1024px)           |           1.261 |           1.261 |               0.775 |        26.402 |       27.944 |       0.93  |        0     |         0    |        1     |
| cascade from R0                     |           1.995 |           3.939 |               0.767 |        26.696 |       28.016 |       0.96  |        0.58  |         0.15 |        0.27  |
| router only                         |           0.978 |           1.261 |               0.758 |        26.367 |       27.692 |       0.925 |        0.535 |         0.18 |        0.285 |
| router + cascade                    |           1.82  |           3.939 |               0.775 |        26.653 |       27.991 |       0.95  |        0.345 |         0.15 |        0.505 |
| ORIGINAL teacher (20 steps, 1024px) |           6.838 |           6.838 |               0.8   |        26.991 |       28.051 |       0.925 |        0     |         0    |        0     |

## GenEval-style accuracy per task

|                                     |   color_attr |   colors |   counting |   position |   single_object |   two_object |
|:------------------------------------|-------------:|---------:|-----------:|-----------:|----------------:|-------------:|
| fixed R0 (2 step, 768px)            |         0.35 |     0.9  |       0.25 |       0.55 |               1 |         0.9  |
| fixed R1 (2 step, 1024px)           |         0.55 |     0.85 |       0.6  |       0.8  |               1 |         0.75 |
| fixed R2 (2 step, 1024px)           |         0.6  |     0.85 |       0.6  |       0.65 |               1 |         0.95 |
| cascade from R0                     |         0.5  |     0.9  |       0.55 |       0.7  |               1 |         0.95 |
| router only                         |         0.45 |     0.9  |       0.6  |       0.7  |               1 |         0.9  |
| router + cascade                    |         0.55 |     0.9  |       0.55 |       0.7  |               1 |         0.95 |
| ORIGINAL teacher (20 steps, 1024px) |         0.5  |     0.85 |       0.7  |       0.8  |               1 |         0.95 |

Router: CV accuracy on train 47.0%; test accuracy 46.5% (majority baseline 58.0%).

## Gate vs judge agreement

| gate_s     |   judge: fail |   judge: pass |
|:-----------|--------------:|--------------:|
| gate: fail |         0.182 |         0.044 |
| gate: pass |         0.065 |         0.71  |
