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
| 2. Classical CV (visual check, safe polish, upscaling, packing) | 02a | No | 🟢 built, run it on a CPU runtime |
| 3. Semantic check + router labels from experiments | 02b | Yes | 🟡 built, run after 01 (set `RUNGS` from 01's results) |
| 4. Quality-gated cascade | 02b | Yes | 🟡 built (same notebook) |
| 5. App on Hugging Face | 03 | Yes | ⬜ |
| 6. Final evaluation + paperwork + demo | all | Yes | ⬜ |

---

## How to run the notebooks (final versions)

| Notebook | Colab runtime | QUICK time | Needs |
|---|---|---|---|
| [`P3_01_optimization_lab.ipynb`](notebooks/P3_01_optimization_lab.ipynb) | **T4 GPU** | done (QUICK results are in Drive) | only re-run for FULL mode (`QUICK=False`), several hours |
| [`P3_02a_classical_cv.ipynb`](notebooks/P3_02a_classical_cv.ipynb) | **CPU** | ~5–10 min | nothing (reads 01's hard-prompt pictures from Drive if present) |
| [`P3_02b_router_cascade.ipynb`](notebooks/P3_02b_router_cascade.ipynb) | **T4 GPU** | ~1–1.5 h (incl. the original teacher) | nothing (downloads COCO annotations + GenEval prompts itself) |

**Running at the same time:**
- ✅ **02a (CPU) + 02b (T4) together:** two separate Colab tabs. They save to different Drive folders and don't depend on each other.
- ❌ **01 and 02b together:** both need the GPU, and free Colab gives you **one GPU at a time**. Run 01 FULL afterwards (for example overnight).
- Every notebook is **resumable**. If Colab disconnects, open it again and **Run all**.

In 01, set `TEAM_ID` / `USNS`. Re-running 01 in QUICK mode skips everything already in Drive (including the fixed M1–M3) and just redraws the tables and charts.

---

## Phase 1: Notebook 01, baseline + optimizations ✅ DONE

**Result:** the best setup is **M3** (1024px): **2.9× faster, 67.5% less GPU memory (8.8 → 2.86 GB), 3× smaller model (7.0 → 2.36 GB), same quality** (CLIP 26.96 vs 26.98).
Fast mode: **S8** (768px, 0.96 s, 5.8× faster). Don't use 512px (broken pictures). Full table and lessons: `P3_SYSTEM_EXPLAINED.md`, section 4.1.
Still to do: a FULL-mode run (`QUICK=False`) for the final numbers, and set the real `TEAM_ID` / `USNS`.

File: [`notebooks/P3_01_optimization_lab.ipynb`](notebooks/P3_01_optimization_lab.ipynb) (Colab, **T4 GPU**)

- Tests the slow teacher and 12 faster setups on 100 COCO val prompts.
- Measures speed, memory, size, CLIP and FID/KID.
- Results go to **Google Drive → `P3_T2I/01_optimization_lab`**.
- **When it finishes:** share the results table, the charts, and the "where does the time go" chart.
- **Rungs picked from these results:** 2 steps @ 768px → 1024px → 1024px, with a **new seed at every rung**. No 512px (broken pictures), and no step changes (they don't buy speed or quality on a T4).
- **Rule: only real measurements, no theoretical speed-ups.**

---

## Phase 2: Notebook 02a, classical CV (CPU, can run while 01 uses the GPU)

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

## Phase 3: Notebook 02b, part 1: semantic check + router data

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
