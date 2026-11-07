# P3: How Our System Works (the Core Idea), v2

> **v2 changes (after review):** quality is now split into **visual** (classical CV) and **semantic** ("does it match the prompt?"); the **quality-gated cascade** is the main contribution; router labels come from **experiments**; fixes are kept **only if they measurably help**; and we're honest that generation runs on a **cloud GPU for mobile users**, not on the phone.

**Problem:** turn a sentence into a good picture **fast and cheaply**, for people using phones.

**Our answer, in one line:** most prompts don't need the expensive setting. So we **start cheap, check the picture (visual + semantic), and spend more compute only when the picture actually fails**. All of this sits on top of a model we made much faster and smaller.

---

## 0. What we are (and aren't) claiming

```
Our system:   Phone ──internet──► GPU server (T4) runs the model ──► small image ──► Phone
Not claimed:  Phone runs the AI model by itself
```

- **What we optimize:** server GPU time per image, server GPU memory, model size (so it fits a cheap GPU), and **download size on the phone**.
- **"Resource requirements for the mobile target":** we report the server numbers per image plus the download size and time on mobile data. We may *estimate* what on-device would need (for example, 4-bit weights ≈ X GB), but we label it **estimate, not tested**.
- **Never say "runs on a phone"** unless we actually test it on one.

---

## 1. The big picture

```
 PROMPT + mode (Fast / Balanced / Quality)
    │
    ▼
 ① ROUTER ── picks the STARTING rung (learned from experiments), capped by the budget
    │
    ▼
 ② GENERATOR ── SANA-Sprint (2 steps; float16, or the low-memory M3 setup) ◄──────────┐
    │                                                                                │
    ▼                                                                                │
 ③ QUALITY GATE                                                                      │
    ③a VISUAL check   (classical CV, a few ms): blank? blurry? dark? noisy? tint? grid?  │
    ③b SEMANTIC check (AI, tens–hundreds of ms): does it match the prompt?           │
         • CLIP image–text match                                                     │
         • for prompts with objects/counts/colours/positions: detector checks        │
    │ pass                                    │ fail → next rung: bigger size        │
    │                                         │ + a NEW seed ────────────────────────┘
    ▼
 ④ SAFE CV POLISH ── fix only what's flagged, keep the fix ONLY if a re-check says it helped
    │
    ▼
 ⑤ PACK FOR PHONE ── resize + smallest WebP that still looks the same (SSIM ≥ 0.95)
    │
    ▼
 PHONE
```

**The rungs (cheapest first).** These come from notebook 01's T4 results:
- Steps barely change speed: 1 step wasn't faster than 2, and 4 steps didn't raise CLIP. Resolution is what costs time.
- 512px is ruled out, because its pictures look broken (section 4.2).

So the rungs change **resolution and seed**:

| Rung | Setting | T4 time | CLIP (baseline 26.98) |
|---|---|---|---|
| 0 | 2 steps, 768px | 0.96 s | 26.61 |
| 1 | 2 steps, 1024px, **new seed** | 1.23 s | 27.06 |
| 2 | 2 steps, 1024px, **another new seed** | 1.23 s | 27.06 |

A failed composition (a missing object, the wrong colour) usually needs a **new sample**, not just more steps on the same one. That's why every rung changes the seed. The baseline (teacher, 20 steps) takes 5.54 s. These times are for the plain float16 pipeline; the memory-saving M3 setup is slower (1.90 s at 1024px).

---

## 2. Two kinds of quality (the key fix from the review)

**Example prompt:** *"a black cat on the left of a sofa and a white cat on the right"*.
**The model draws two black cats.** The picture can be sharp, well lit and glitch-free, yet it is **wrong**.

| Quality type | Question it answers | How we check it | Speed |
|---|---|---|---|
| **Visual** | Is the picture technically OK? | Classical CV: blur, brightness, contrast, noise, colour tint, grid glitches, blank | ~ms, CPU |
| **Semantic** | Does it show what the prompt asked for? | CLIP image–text score, plus a COCO object detector (80 object types) for objects, counts, colours and left/right | tens–hundreds of ms, GPU |

Classical CV **alone can never say "this matches the prompt"**. That's why the gate has both parts.

---

## 3. Stage by stage

### ① Router: where should we start?
- **Labels come from experiments, not guesses.** For every training prompt, we generate it at **every rung**, then check visual + semantic quality and time it.
  - **Label** = the **cheapest rung that passes** the gate.
- **Training prompts:**
  - COCO **train** captions (everyday scenes)
  - our **own GenEval-style prompts**: GenEval's templates (colours, counts, positions, two objects) with new random combinations, none equal to an official GenEval prompt
- **Testing:** on **official GenEval prompts** + COCO **val** captions only.
- **Input clues:**
  - the prompt's text embedding
  - simple features: length, number of objects, colour words, position words, numbers
- **The budget rule then caps the choice:**
  - Fast mode or a busy server → lower rungs
  - very little memory → the **low-memory setup M3** (4-bit weights, CPU word table, tiled decoding: 2.86 GB)
- **Honest note:** SANA-Sprint's 1-, 2- and 4-step pictures may differ only a little for many prompts, so the router might not beat a fixed setting. That's fine: we **measure** it. The cascade still works either way, because it reacts to the actual picture.

✅ Covers: *meaningful adaptation*, *train/validation split*, *adaptive generation based on computational budget*, *fallback*.

### ② Generator: SANA-Sprint
| Part | What it is | Job |
|---|---|---|
| Reader (text encoder) | Gemma-2, a small LLM (~2.6B) | Turns the sentence into numbers. It only reads |
| Painter (diffusion transformer) | 0.6B, linear attention | Turns noise into a picture in a tiny 32×32 compressed grid |
| Unzipper (DC-AE decoder) | autoencoder | Turns the 32×32 grid into the real picture |

### ③ Quality gate
**③a Visual (classical CV, notebook 02a):**

| Check | Classical method |
|---|---|
| Blank / broken | brightness spread ≈ 0 |
| Blurry | variance of the Laplacian, normalised by contrast |
| Too dark / too bright | mean brightness + percentiles |
| Flat | RMS contrast |
| Colour tint | colour shift of the near-grey pixels in LAB (a gray-world variant; conservative, because warm scenes look tinted too) |
| Grainy | noise estimate from a high-pass filter, measured in flat areas |
| Grid / checkerboard glitch | spikes in the frequency spectrum (FFT) |

**③b Semantic (notebook 02b):**
- **CLIP score:** does the picture match the sentence overall?
- **For prompts with structure** ("two cats", "a red apple", "on the left"):
  1. Our prompt reader turns the prompt into a checklist. It reads **553/553 GenEval prompts exactly right**.
  2. A COCO detector finds the objects.
  3. We check **count**, **colour** (CLIP on each object's masked crop) and **left/right/above** (box positions), using GenEval's rules.
  4. This is **GenEval-style**, built by us. We call it that, never "official GenEval".
- **Two separate checkers, so the cascade never grades its own homework:**
  - **Gate** (decides during the cascade): Mask R-CNN + CLIP ViT-B/16, fast.
  - **Judge** (scores the results): Mask2Former Swin-S, the kind of detector GenEval uses, + CLIP ViT-L/14.
- **How trustworthy the checkers are,** measured on real COCO photos against their ground truth:
  - object present / absent: 96–98% correct
  - left/right/above/below: 100% correct
  - colours: correct
  - **exact counts: only ~50% of true counts confirmed**, the weakest check
- The time spent checking is **counted in the latency**.

**On a fail:** go one rung up. The cascade stops at the top rung, or when the time budget runs out.

### ④ Safe CV polish ("do no harm")
1. **Only fix what was flagged.** Most pictures get **no changes at all**.
2. **Prompt-aware exceptions:** don't "fix" what the prompt asked for.

   | Prompt says | Don't fix |
   |---|---|
   | night, dark, noir, silhouette | darkness |
   | black and white, monochrome, sepia | colour |
   | sunset, golden hour, neon | colour tint |
   | bokeh, fog, motion blur, dreamy | blur |
3. **Accept-or-revert:** after fixing, re-check the picture. Keep the fix only if:
   - the flagged problem got better,
   - no new problem appeared, and
   - (in the app) the CLIP match didn't drop.

   Otherwise, **return the original**.
4. **Notebook 02a proves it:**
   - It damages good pictures on purpose and measures detection and repair (PSNR/SSIM against the undamaged original).
   - It checks that clean pictures stay untouched.
   - It uses **independent** quality scores, not our own checks, to confirm the fixes helped.

✅ Covers: *colour correction and enhancement*, *edge-aware post-processing*, *image quality assessment*, *artifact detection and correction*.

### ⑤ Pack for the phone
- If we drew at 768px (Fast mode) but the phone needs more: **edge-aware classical upscaling** to 1024px (Lanczos + back-projection). It beats bicubic in notebook 02a.
- Resize to the phone screen.
- Pick the **smallest WebP quality that keeps SSIM ≥ 0.95**. Smaller files mean less waiting on mobile data.

✅ Covers: *image resizing and resolution optimization*.

---

## 4. Model-level optimizations (notebook 01)

**Baseline:** the SANA-Sprint *teacher*: same size, 20 steps + guidance ≈ 40 painter runs per picture.

| # | Technique | What it saves | Brief's name |
|---|---|---|---|
| 1 | Fewer steps (distilled SANA-Sprint) | 40 painter runs → 1–2 | Reduced sampling steps / distillation |
| 2 | 8-bit / 4-bit weights | memory + model size | Quantization / reduced precision |
| 3 | 32×32 compressed drawing space | work per step | Latent-space optimization |
| 4 | Small 0.6B painter, linear attention | speed + memory | Lightweight architecture |
| 5 | Smaller output size | pixels to compute | Resolution optimization |
| 6 | `torch.compile` | speed | Inference-pipeline optimization |
| 7 | Shorter hidden instruction | reader time | Prompt-encoding optimization |
| 8 | Fallback modes (4-bit + 512px, CPU offload) | runs on small GPUs | Resource-aware fallback |

| 9 | Reader's word table (256k words, 1.18 GB) kept on the CPU, with Gemma's ×48 scale preserved | ~1.2 GB GPU memory, identical outputs (max difference 0.000000) | Memory optimization |
| 10 | Tiled decoding (DC-AE `enable_tiling`) | the memory spike at the end | Memory optimization |

### 4.1 Measured results (notebook 01, Tesla T4, float16, 100 COCO val prompts, QUICK mode)

| Setup | What it is | Time (s) | Speed-up | Peak GPU (GB) | Memory saved | Size (GB) | CLIP ↑ | FID ↓ |
|---|---|---|---|---|---|---|---|---|
| **B0** | Baseline: teacher, 20 steps + CFG | 5.54 | 1.0× | 8.80 | none | 7.04 | 26.98 | 191.3 |
| S1 | Sprint, 2 steps | 1.23 | 4.5× | 8.79 | 0% | 7.04 | 27.06 | 180.6 |
| S2 | Sprint, 1 step | 1.33 | 4.2× | 8.79 | 0% | 7.04 | 26.75 | 184.4 |
| S3 | Sprint, 4 steps | 1.98 | 2.8× | 8.79 | 0% | 7.04 | 26.83 | 181.7 |
| S4 | S1 + 8-bit reader | 1.67 | 3.3× | 6.77 | 23% | 5.02 | 26.97 | 180.6 |
| S5 | S1 + 4-bit reader | 1.61 | 3.4× | 5.80 | 34% | 4.00 | 27.07 | 179.7 |
| S6 | S5 + 8-bit drawer | 1.84 | 3.0× | 5.48 | 38% | 3.69 | 27.14 | 180.5 |
| S7 | S1 + `torch.compile` | 1.50 | 3.7× | 8.79 | 0% | 7.04 | 27.04 | 180.7 |
| S8 | S1 at 768px | 0.96 | 5.8× | 8.03 | 9% | 7.04 | 26.61 | 180.5 |
| S9 | S1 at 512px | 0.58 | 9.5× | 7.48 | 15% | 7.04 | 25.04 | 186.0 |
| S10 | S1 without hidden instruction | 1.48 | 3.7× | 8.79 | 0% | 7.04 | 27.09 | 182.3 |
| F1 | 1 step, 512px, 4-bit reader + 8-bit drawer | 0.66 | 8.4× | 4.17 | 53% | 3.69 | 24.68 | 196.8 |
| F2 | CPU offload | n/a | n/a | n/a | n/a | n/a | n/a | n/a |
| **M1** | 4-bit reader (word table on CPU) + 8-bit drawer + tiled decode, 1024px | 2.43 | 2.3× | **3.00** | **66%** | 2.51 | **27.13** | **180.6** |
| **M2** | M1 at 768px | 1.40 | 3.9× | **3.00** | **66%** | 2.51 | 26.51 | 183.0 |
| **M3** | M1 with a 4-bit drawer, 1024px | 1.90 | 2.9× | **2.86** | **67.5%** | **2.36** | 26.96 | 182.6 |

Size = GPU-resident weights. For M1–M3, another **1.18 GB** (the word table) sits in system RAM, not on the GPU. FID uses only 100 images, so it's inflated: compare it between rows, not as an absolute number.

### 4.2 What we learned
1. **Distillation is the main win.** 20 steps → 2 steps is **4.5× faster with no quality loss**: CLIP 27.06 vs 26.98, and FID actually improves, 180.6 vs 191.3.
2. **2 steps is the sweet spot.** 1 step loses a little quality; 4 steps is slower and no better.
3. **On a T4, drawing is no longer the bottleneck.** 1, 2 and 4 steps take nearly the same time; the **text reader and the decoder** dominate. That's why image size is the strongest speed lever.
4. **Memory: 8.8 GB → 2.86 GB (−67.5%) with the same quality.** We got there by stacking 4-bit/8-bit weights, the CPU word table and tiled decoding. **75% (~2 GB) isn't reachable without lowering resolution**, which costs quality.
5. **Memory tricks cost some speed.** Tiled decoding and the CPU lookup add ~0.5–1 s.
6. **512px breaks the model.** It was trained only at 1024px, so 512px images look cartoonish and distorted (CLIP ~25). **Don't use 512px**; use 768px + classical upscaling instead.
7. **CPU offload (F2) can't run on free Colab.** It needs more than ~12.7 GB of system RAM, so it's ruled out as a fallback on this hardware.
8. **`torch.compile` gives little on a T4** (1.50 s vs 1.23 s, within noise). The T4 is too small for its best tuning mode.
9. **Bug we found and fixed:** the newer `transformers` scales Gemma's embeddings **inside** the word table (×48). Our first CPU copy dropped that scale, and CLIP collapsed to 9. With the scale restored, the output matches the original exactly (difference 0.000000).

### 4.3 Chosen settings for the app

| Mode | Setup | Time | Peak GPU | Quality |
|---|---|---|---|---|
| **Fast** | S8 (768px, 2 steps) | ~0.96 s | 8.0 GB | CLIP 26.6 |
| **Balanced / main** | **M3** (1024px, 4-bit reader + 4-bit drawer, CPU word table, tiled decode) | ~1.90 s | **2.86 GB** | CLIP 26.96 (same as baseline) |
| **Low-memory fallback** | M3 (or M2 at 768px, 1.40 s) | 1.4–1.9 s | ~3.0 GB | same as baseline |

F1 (512px) is **not** used as the fallback: its pictures are visibly broken.

### 4.4 Failure cases already visible (hard-prompt grid)
| Prompt | Failure | Baseline better? |
|---|---|---|
| "red cube **on top of a blue sphere**, next to a cat" | Sprint drops the blue sphere | Yes: **a real cost of distillation** |
| "**exactly five** apples" | draws 10–15 apples | No: counting |
| "a sign that says **OPEN**" | "OPPEN", "OREN" | No: text rendering |
| dog left / umbrella **right of** the bicycle | umbrella placed above the bike | No: spatial relations |

**Still to decide (no guessing):**
- **Caching:** keep models loaded, and cache the reader's output for repeated prompts.
- **Batching:** only for throughput, not for single users.

---

## 5. Final evaluation: what we'll prove

Every system is compared on the **same held-out prompts** (COCO val + compositional val):

| System | What it shows |
|---|---|
| Original baseline (teacher, 20 steps) | Reference |
| Optimized SANA-Sprint (fixed setting) | Inference speed-ups |
| + Router | Smart starting point |
| + Quality-gated cascade | Spends compute only when needed |
| Complete system (+ safe CV polish + packing) | Everything together |

**Metrics:**
- CLIP, KID/FID (realism), GenEval-style pass rate (counts / colours / positions)
- average **and** worst-case latency, including check time
- peak GPU memory, model size, download size

**The 7 questions the judges care about, and where we answer them:**

| # | Question | Answered in |
|---|---|---|
| 1 | How much faster? | notebook 01 + final table |
| 2 | How much memory saved? | notebook 01 |
| 3 | Is quality still acceptable? | CLIP / KID / GenEval-style, baseline vs ours |
| 4 | Does adaptive routing actually help? | router vs fixed settings on val |
| 5 | Does classical CV really improve images? | notebook 02a's damage-and-repair + do-no-harm tests |
| 6 | Does the app run reliably? | live URL, error states, timings |
| 7 | What happens when it fails? | 3 failure cases + what the gate did |

---

## 6. Which notebook does what

| Notebook | Builds | GPU? | Status |
|---|---|---|---|
| **01: optimization lab** | Stage ② + section 4 + measurements | Yes | ✅ done (results in 4.1) |
| **02a: classical CV** | Stage ③a + ④ + ⑤, with proof tests | No (CPU) | 🟢 built; ran on a laptop CPU, not yet in Colab |
| **02b: router + semantic check + cascade** | Stages ①, ③b, cascade + router labels from experiments | Yes | 🟡 built; tested only with a stand-in generator, ready to run on the T4 |
| **03: app** | One Hugging Face Space on a paid T4 that serves our custom mobile web page and the generation API (one link): modes, timer, quality comparison | Yes (server) | after 02b |
| **Final evaluation** | Section 5 table + `eval_P3_<TeamID>.md` | Yes | last |

---

## 7. One-line pitch for the judges

> "Most prompts don't need the expensive setting. We start with the cheapest one, let a fast visual + semantic quality gate decide, and spend more compute only when the picture actually fails. All of this runs on a model we made much faster and smaller, and every claim is measured."
