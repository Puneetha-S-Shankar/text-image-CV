# P3: Next Steps (Simple Version), v2

**Project:** P3: Resource-Efficient Text-to-Image Generation for Mobile Devices
**What we build:** cloud-assisted generation for phone users. The model runs on a T4 GPU server, and the phone opens a web link.
**Main model:** SANA-Sprint 0.6B. **Baseline:** SANA-Sprint teacher (20 steps).
**Main idea:** start cheap → check the picture (visual + semantic) → spend more compute only if it fails. See [P3_SYSTEM_EXPLAINED.md](P3_SYSTEM_EXPLAINED.md).

---

## The order, in one line

**01 measure → 02a classical CV → 02b router + semantic check + cascade → 03 app → final evaluation → paperwork → demo**

| Phase | Notebook | GPU? | Status |
|---|---|---|---|
| 1. Baseline + optimizations | 01 | Yes | ✅ done (QUICK mode) |
| 2. Classical CV (visual check, safe polish, upscaling, packing) | 02a | No | ✅ done (QUICK) |
| 3. Semantic check + router labels from experiments | 02b | Yes | ✅ done (QUICK). Router did **not** help |
| 4. Quality-gated cascade | 02b | Yes | ✅ done (QUICK): 3.4× faster than the original, near-same quality |
| 5a. Low-memory check of the retry system | 03a | Yes | ✅ done (Kaggle T4): low memory costs no accuracy (Balanced 76.7% → 78.3%), safe to deploy |
| 5b. Backend test on a T4 | 03b | Yes | ✅ done (Kaggle T4): contract 9/9, errors 6/6, Balanced 3.4 s avg |
| 5d. Deploy to the HF Space (Docker, T4 small) | `space/` | Yes | ⏳ waiting for billing on the HF account |
| 5c. Phone app (frontend) | `frontend/` | No | 🟡 starter done, friend continues |
| 6. Final evaluation + paperwork + demo | all | Yes | 🟡 eval file, README, architecture diagram, design doc, limitations/ethics/failure cases ✅; demo ⬜ |

---

## How to run the notebooks (final versions)

| Notebook | Colab runtime | QUICK time | Needs |
|---|---|---|---|
| [`P3_01_optimization_lab.ipynb`](notebooks/P3_01_optimization_lab.ipynb) | **T4 GPU** | done (QUICK results are in Drive) | only re-run for FULL mode (`QUICK=False`), several hours |
| [`P3_02a_classical_cv.ipynb`](notebooks/P3_02a_classical_cv.ipynb) | **CPU** | ~5–10 min | nothing (reads 01's hard-prompt pictures from Drive if present) |
| [`P3_02b_router_cascade.ipynb`](notebooks/P3_02b_router_cascade.ipynb) | **T4 GPU** | ~1–1.5 h (incl. the original teacher) | nothing (downloads COCO annotations + GenEval prompts itself) |
| [`P3_03a_lowmem_check.ipynb`](notebooks/P3_03a_lowmem_check.ipynb) | **T4 GPU** | ~30–45 min | 02b's results in Drive (`P3_T2I/02b_router_cascade`, `P3_T2I/shared/cascade_config.json`) |
| [`P3_03b_backend.ipynb`](notebooks/P3_03b_backend.ipynb) | **T4 GPU** | ~15–20 min | 03a's `cascade_config_lowmem.json` in Drive; the GitHub repo (public, or a `GITHUB_TOKEN` Colab secret) |

**Running at the same time:**
- ✅ **02a (CPU) + 02b (T4) together:** two separate Colab tabs. They save to different Drive folders and don't depend on each other.
- ❌ **01 and 02b together:** both need the GPU, and free Colab gives you **one GPU at a time**. Run 01 FULL afterwards (for example overnight).
- Every notebook is **resumable**. If Colab disconnects, open it again and **Run all**.

In 01, set `TEAM_ID` / `USNS`. Re-running 01 in QUICK mode skips everything already in Drive (including the fixed M1–M3) and just redraws the tables and charts.

---

## Phase 1: Notebook 01, baseline + optimizations ✅ DONE

**FULL-mode results (final numbers):** 500 COCO val prompts, FID against 5,000 real images, T4, float16. Notebook: [`P3_01_optimization_lab_FULL_results.ipynb`](notebooks/P3_01_optimization_lab_FULL_results.ipynb).

| Setup | Time | Speed-up | Peak GPU | Model size | CLIP-L ↑ | FID ↓ | KID×1000 ↓ |
|---|---|---|---|---|---|---|---|
| B0 original teacher (20 steps, 1024px) | 6.08 s | 1× | 8.79 GB | 7.04 GB | 26.60 | 92.4 | 9.04 |
| S1 Sprint, 2 steps, 1024px | 1.29 s | 4.7× | 8.79 GB | 7.04 GB | 26.43 | 87.2 | 8.42 |
| S8 Sprint, 768px (fastest) | **0.78 s** | **7.8×** | 8.03 GB | 7.04 GB | 26.25 | 85.6 | 7.58 |
| M2 low-memory, 768px | 1.21 s | 5.0× | 2.99 GB | 2.51 GB | 26.27 | **85.5** | **6.47** |
| **M3 low-memory, 1024px, 4-bit drawer (best balance)** | 1.57 s | 3.9× | **2.86 GB (−67%)** | **2.36 GB (3× smaller)** | **26.52** | 86.2 | 6.88 |

- **M3 is the headline:** 3.9× faster, 67% less GPU memory, 3× smaller model, CLIP within 0.09 of the original, and **better FID/KID than the original**.
- **Every fast setup beats the original on FID/KID.** The distilled model's pictures look closer to real photos.
- **S8 is the speed record** (7.8×) but saves no memory. **M2** is the middle option (5×, 3 GB).
- Don't use 512px (broken pictures). Full lessons: `P3_SYSTEM_EXPLAINED.md`, section 4.1.
- **Still to do:**
  - The auto-written `eval_P3_T00.md` picks S8 as "optimized" and still says team `T00`. For the final file, set the real `TEAM_ID` and report **M3** (or both M3 and S8).
  - M5 / Q1 / Q2 weren't in this run.

File: [`notebooks/P3_01_optimization_lab.ipynb`](notebooks/P3_01_optimization_lab.ipynb) (Colab, **T4 GPU**)

- Tests the slow teacher and 12 faster setups on 100 COCO val prompts.
- Measures speed, memory, size, CLIP and FID/KID.
- Results go to **Google Drive → `P3_T2I/01_optimization_lab`**.
- **When it finishes:** share the results table, the charts, and the "where does the time go" chart.
- **Rungs picked from these results:** 2 steps @ 768px → 1024px → 1024px, with a **new seed at every rung**. No 512px (broken pictures), and no step changes (they don't buy speed or quality on a T4).
- **Rule: only real measurements, no theoretical speed-ups.**

---

## Phase 2: Notebook 02a, classical CV ✅ DONE (QUICK)

**Results:**
- **Catches damage:** 90–100% for dark, bright, noise, blank and grid glitches. **Fixes help:** dark SSIM 0.41 → 0.79, checkerboard 0.74 → 0.97.
- **Blur can't be fixed.** It's correctly sent to a higher rung (100% escalated).
- **Independent check:** BRISQUE 45.5 → 18.5, improved in 84% of kept fixes.
- **False alarms:** 15% on clean photos, but keep-or-revert leaves 90% of them untouched.
- **Edge-aware upscaling beats bicubic:** PSNR 32.8 vs 32.2 at ×2.
- **Smart WebP:** 37 KB vs 954 KB PNG (26× smaller), **0.2 s on slow 3G**.
- **Weak spot:** mild colour casts are caught only 15% of the time.


**Builds:**
- **Visual quality check:** blank, blurry, too dark or bright, flat, grainy, colour tint, grid glitches.
- **Safe polish:**
  - fixes only what's flagged
  - skips things the prompt asked for (for example "night", "black and white", "bokeh")
  - **keeps a fix only if a re-check shows it helped**; otherwise returns the original
- **Edge-aware upscaling** (draw small, upscale clean), compared with bicubic.
- **Mobile packing:** the smallest WebP that keeps SSIM ≥ 0.95.

**Proves, with numbers:**
- Damages good pictures on purpose → are the problems **caught**? Are they **fixed**? (PSNR/SSIM)
- Leaves good pictures alone → **no false alarms**, no harm done.
- Independent quality scores confirm the fixes help.
- Everything is timed in milliseconds.

**Note:** this is **visual** quality only. "Does it match the prompt?" is Phase 3.

---

## Phase 3 + 4: Notebook 02b results ✅ DONE (QUICK)

Results are in [`results/02b`](results/02b) (including `shared/cascade_config.json` for the app).

| Strategy | Avg time | p90 time | GenEval-style acc | CLIP-L (all) | Looks clean |
|---|---|---|---|---|---|
| Fixed R0 (768px) | 0.74 s | 0.74 s | 65.8% | 27.57 | 90.5% |
| Fixed R2 (1024px) | 1.26 s | 1.26 s | 77.5% | 27.94 | 93.0% |
| **Cascade from R0** | **2.00 s** | 3.94 s | **76.7%** | **28.02** | **96.0%** |
| Router + cascade | 1.82 s | 3.94 s | 77.5% | 27.99 | 95.0% |
| **Original teacher (20 steps)** | 6.84 s | 6.84 s | 80.0% | 28.05 | 92.5% |

- **Headline:** the cascade is **3.4× faster** than the original (including checks), with almost the same quality and **fewer broken-looking pictures**.
- **The gate is trustworthy:** it agrees with the independent judge on **89%** of 573 test pictures (too lenient on 6.5%).
- **The router failed:** 46.5% correct vs 58% for always guessing the most common answer. **Use the cascade without the router.** Prompt text doesn't predict which level is needed.
- **Counting is the weak spot:** checkers confirm a correct count only 59% (gate) and 37% (judge) of the time. Counting accuracy: 55% for ours vs 70% for the original.
- **Polish doesn't raise CLIP** (26.20 → 26.18). It's a safety net, not a quality boost.
- **Hindsight best (oracle):** 86.7% accuracy at 0.91 s, so a better gate still has room to help.
- **Head-to-head on 120 GenEval prompts:** ours right / original wrong = 9; original right / ours wrong = 12.

### What 02b does (for reference)


File: [`notebooks/P3_02b_router_cascade.ipynb`](notebooks/P3_02b_router_cascade.ipynb) (Colab, **T4 GPU**, QUICK ≈ 45–60 min, resumable)

- **Semantic check:**
  - **CLIP** score (overall match)
  - **GenEval-style detector checks** for objects, counts, colours and left/right, used only when the prompt has them
  - **two checkers:** a fast **gate** (Mask R-CNN + CLIP-B/16) decides; an independent **judge** (Mask2Former + CLIP-L/14) scores
  - both are validated first on real COCO photos with ground truth
- **Router training data from experiments:**
  1. Take training prompts: COCO **train** + our own GenEval-style prompts (none equal to an official GenEval prompt).
  2. Generate each one at **every rung**.
  3. Record visual check, semantic check and time.
  4. **Label = the cheapest rung that passes.**
- **Train the router** on the train split, and **test it only on official GenEval prompts + COCO val captions**.
- Compare it against "always rung 0 / 1 / 2". **If it doesn't help, we say so.**

---

- **The original teacher (20 steps) is tested on the same test prompts with the same judge.** That's the only fair basis for "better than / as good as the original".

## Phase 4: Notebook 02b, part 2: quality-gated cascade (our main contribution)

```
start at the router's rung → generate → visual + semantic check
   pass → polish, pack and send
   fail → next rung (more steps / bigger / new seed) → check again … until pass, top rung, or time budget
```

**Measure on held-out prompts:**
- average **and** worst-case time, **including check time**
- quality (CLIP, KID, GenEval-style pass rate)
- the share of prompts finished at each rung

---

## Phase 5: Notebook 03, the app

- **Hosting (decided):** a single **Hugging Face Space on a paid T4** (~$0.40/hour, only while it's switched on).
  - It serves **our own custom web page** (app-like mobile design, not the default Gradio look) **and** the generation API.
  - **Next.js is fine** with static export (`output: 'export'`, `images.unoptimized: true`): React, Tailwind and animations all work.
  - No Next.js server features (API routes, server actions, SSR); the backend on the T4 does that job.
  - Everything comes from the same server: **one link**, and no cross-site permission checks.
  - The T4 matches the GPU used for every number in our report, so the app's timer agrees with the write-up.
  - **Downside we accept:** when the T4 is switched off to save money, the page is down too. Keep it on for testing and judging.
- **Speed rules:**
  - load the model **once at startup** (never per request), plus one warm-up picture
  - don't let the Space sleep on judging day
  - send **WebP** (~40 KB), not PNG
- **Fast / Balanced / Quality** modes; the budget rule caps the cascade.
- A **generation timer**, which rung was used, and the quality check results.
- **Loading spinner + clear error messages**; bad prompts handled.
- **Demo extras:** old slow model vs ours side by side, and the speed-vs-quality chart.

### What's built (Phase 5)

**One engine, measured = deployed.** [`src/p3_engine.py`](src/p3_engine.py) holds the generator loading (float16 / M2 / M3), the gate, the router and the cascade. Notebook 03a measures with it; the server runs it.

| Mode | What it does | Same as 02b/03a strategy |
|---|---|---|
| Fast | cheapest level (768px), no retry | fixed R0 |
| Balanced (default) | start at 768px; if the check fails, next level with a new seed (budget 6 s) | cascade from R0 |
| Quality | start at 1024px; if the check fails, retry with a new seed (budget 9 s) | cascade from R1 |

No mode uses the router (02b: it didn't beat always starting cheap). 03a still reports it for the ablation.

- **Notebook 03a** ([`P3_03a_lowmem_check.ipynb`](notebooks/P3_03a_lowmem_check.ipynb)): re-runs 02b's 200 test prompts on the **low-memory M3 model** (same seeds, gate, judge), compares float16 vs low-memory per strategy, measures the three modes + live requests, and saves `cascade_config_lowmem.json` to Drive. It also self-checks that replaying 02b's own results reproduces 02b's table exactly.
- **Backend** ([`space/`](space)): `app.py` (FastAPI, follows `frontend/docs/API_CONTRACT.md`), `safety.py` (basic prompt word filter), `Dockerfile` (builds the phone app on Linux, then the GPU server), `assemble.py` (puts the Space folder together).
- **Notebook 03b** ([`P3_03b_backend.ipynb`](notebooks/P3_03b_backend.ipynb)): runs that exact server on Colab's T4; contract test, error test, speed per mode vs 03a, several judges at once, GPU memory; saves the tested library versions; with `DEPLOY = True` uploads to the Space (hardware stays your choice in the Space settings).
- **Tested offline (no GPU):** both notebooks run end to end with stand-in pictures; the real server served the real frontend and answered every contract and error test.

**Run order:** 03a (~30–45 min) → 03b with `DEPLOY = False` (~15–20 min) → set up the Space + `HF_TOKEN` secret → 03b with `DEPLOY = True` → Space settings: **T4 small**.

---

## Phase 6: Final evaluation, paperwork, demo

**Final comparison**, all on the same held-out prompts:
1. Original baseline
2. Optimized SANA-Sprint
3. \+ router
4. \+ cascade
5. Complete system

**Paperwork checklist:**
- [ ] **Live hosted URL**
- [ ] **GitHub repo** with all the code
- [ ] **README** that reproduces the numbers
- [ ] **Architecture diagram** that matches the code
- [ ] **Design document**
- [ ] **`eval_P3_<TeamID>.md`**: first line is all USNs, comma separated; metrics in the brief's order
- [ ] **Ablation study** (notebook 01 ladder + cascade/router comparisons)
- [ ] **3 failure cases** with reasons, plus what the quality gate did about them
- [ ] **Limitations and ethics:** bias, misuse, unsafe prompts, **cloud vs on-device (honest)**
- [ ] **Dockerfile or one-command run**; **no passwords or keys in the repo**

**Demo (3 minutes, live link, on a phone):**
- A judge types an unseen prompt, and it must answer within about 10 seconds.
- Show the rung used and the quality check.
- Every member can explain:
  - their own part
  - why SANA-Sprint
  - visual vs semantic quality
  - the metrics
  - one failure case

**The 7 questions judges care about** (answer each with a number):
1. How much faster?
2. How much memory saved?
3. Is quality still acceptable?
4. Does routing help?
5. Does classical CV really improve images?
6. Does the app run reliably?
7. What happens when it fails?

---

## Decisions made

- ✅ **Cloud-assisted, not on-device.** Never claim "runs on a phone" unless we test it on one.
- ✅ **Hosting: one HF Space on a paid T4 serving both our custom page and the API.**
  - **Rejected:** Vercel + HF (no speed gain, two places to manage) and ZeroGPU (visitor GPU quotas and queues, the 4/8-bit tricks are untested there, and timings wouldn't match the T4).
  - Also rejected: the laptop and Modal.
- ✅ **Quality = visual (classical CV) + semantic (CLIP + detector).** Classical CV alone can't judge prompt match.
- ✅ **Router labels come from experiments**, not from prompt length.
- ✅ **Fixes are accept-or-revert**: keep a fix only if it measurably helps.
- ✅ **"GenEval-style", never "GenEval"**, unless we run the official benchmark.

## Still open

- **Are we allowed to build before hackathon day?** Ask the organisers.
  - **If yes:** finish Phases 1–5 early.
  - **If no:** treat this as practice and rebuild fast on the day.
