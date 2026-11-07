# P3 Frontend Problem-Statement Mapping

## Audit scope

This audit covers the current Create page (`/`), Compare page (`/compare`), API contract and
experimental data used by the frontend. The former `/how-it-works` page is not present in the
current app; its user-facing explanation of the generation flow now lives on Compare. The backend
and API contract were inspected for evidence only and were not changed.

“Clearly demonstrated” means the current UI visibly presents the feature or real result.
“Partially demonstrated” means only some of the feature or evidence is visible.
“Backend-dependent” means the UI can show it only when the current backend/configuration returns
or performs it. “Missing” means there is no truthful current UI evidence.

## Requirement coverage

| # | Official requirement | Coverage | Frontend evidence and limits |
|---|---|---|---|
| 1 | Lightweight diffusion-based text-to-image architecture | Partially demonstrated | The model/setup names and measured resource table identify SANA-Sprint 0.6B, but the UI does not explain the diffusion architecture itself. |
| 2 | Meaningful adaptation of a pretrained model | Partially demonstrated | Compare now shows the two-step distilled setup and low-memory variants; adaptation/training methodology is not explained in the frontend. |
| 3 | Inference optimization | Clearly demonstrated | Compare shows the optimization ladder, including two-step inference, 768/1024px output, quantized components, CPU word table, and tiled decode. |
| 4 | Prompt encoding and conditional generation | Partially demonstrated | Create accepts and submits the user’s prompt with the selected mode. Tokenization/encoding and conditioning internals are not exposed in the UI. |
| 5 | Classical CV: resolution optimization, color correction/enhancement, edge-aware post-processing, quality assessment, artifact detection/correction | Partially demonstrated | Create displays actual attempt/output resolutions, visual flags, and whether accepted CV polish steps were kept. The UI does not expose internal CV measurements or every algorithm; it does not claim unsupported steps ran. |
| 6 | At least two optimization strategies | Clearly demonstrated | The benchmark ladder shows distillation to two steps, quantized text/diffusion components, CPU-resident word table, tiled decode, and a lower-resolution setup. |
| 7 | Baseline versus optimized model comparison | Clearly demonstrated | Compare uses the existing B0 original and M3 low-memory benchmark measurements, with setup descriptions and common hardware/prompt context. |
| 8 | Resource requirements for the intended mobile deployment target | Backend-dependent | The UI reports measured server GPU, latency, memory, and GPU-resident weight size and explicitly notes that mobile-device RAM, power, and inference latency have not been measured. The current app is cloud-assisted, not on-device. |
| 9 | Complex prompts with multiple objects, attributes, and spatial relationships | Clearly demonstrated | Create accepts free-form prompts and offers count/color/position examples; returned semantic checks display those requested attributes when available. |
| 10 | Semantic consistency evaluation | Clearly demonstrated | Per-result CLIP and prompt-specific checks are displayed when returned. Compare also shows the held-out GenEval-style score and CLIP result, clearly labeled as the project’s own evaluation. |
| 11 | Reduced latency and memory | Clearly demonstrated | The B0-to-M3 summary and measurement bars are calculated from the existing benchmark data. |
| 12 | Investigate quality degradation caused by optimization | Clearly demonstrated | The quality-cost table shows CLIP, FID, and KID across tested configurations, making trade-offs visible rather than asserting every metric improved. |
| 13 | Adaptive generation based on computational budget | Partially demonstrated | Create exposes Fast/Balanced/Quality policies, their starting resolutions/budgets, actual attempts, and best-effort outcome. The trained prompt router is not used by the active mode configuration; starts are fixed by mode and checks trigger retries. |
| 14 | Resource-aware fallback | Partially demonstrated | The UI shows bounded retry behavior and the best available result when no attempt passes. It does not show a handset/CPU fallback because generation is performed on the cloud GPU. |
| 15 | CLIP, FID or another suitable distribution-level metric, latency, peak memory, model size, and quality-versus-cost comparison | Clearly demonstrated | Compare now shows CLIP, FID, KID, latency, peak GPU memory, GPU-resident weight size, resolution, and steps for the measured optimization ladder, plus a separate held-out cascade scorecard. |

## Frontend improvements made for this mapping

- Added the full five-setup optimization/quality-cost table using the existing experimental records.
- Added held-out cascade evaluation values from `eval_P3_T58.md`; the page distinguishes these from
  the 500-prompt M3 optimization ablation and identifies “GenEval-style” as non-official.
- Added calculated model-size reduction and explicit notes about GPU-resident versus CPU-resident
  memory and the absence of handset measurements.
- Made the mode start/budget and best-effort behavior visible without implying the trained router is
  active.
- Clarified Create-page display of returned visual checks and CV polish decisions.

No API fields, backend behavior, or benchmark values were changed or invented.

## Remaining gaps and backend-dependent evidence

- The live API returns final image data and attempts/checks, but not a separate image for each
  attempt. A true live cascade before/after image comparison cannot be shown.
- Per-image visual measurements and detailed correction decisions are not part of the current
  response. The UI can show only returned flags and accepted polish step names.
- The backend response does not provide live GPU memory or model-size measurements per request;
  those are offline experimental figures on Compare.
- The prompt router was evaluated experimentally but is disabled in the active fixed-start mode
  configuration. The frontend states this rather than visualizing it as an active decision.
- Mobile handset RAM, energy/battery, and on-device inference latency have not been measured; T4
  server numbers cannot be presented as handset resource requirements.
- Prompt encoding/conditioning implementation and detailed pretrained-model adaptation/training
  are not explained in the current frontend.
- The How It Works route is intentionally absent; the relevant concise workflow explanation is on
  Compare instead.

## Validation

Run `npm run verify` from `frontend/` after changing the frontend.
