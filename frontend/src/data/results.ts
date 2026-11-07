/**
 * Real measured results, used by the Compare page.
 *
 * Source: notebook 01, FULL mode (results_overnight.md in the main project):
 *   Tesla T4, float16, 500 MS-COCO 2017 val prompts (seed 0), FID/KID against 5,000 real COCO photos,
 *   latency = mean of 10 single-image runs after warm-up (GPU time only, no network).
 *
 * Do not edit these numbers by hand. If the notebooks are re-run, copy the new values over.
 */

export interface SetupResult {
  id: string;
  name: string;
  what: string;
  steps: number;
  resolution: number;
  clip: number; // CLIP ViT-L/14 x100, higher is better
  fid: number; // lower is better
  kid1000: number; // KID x1000, lower is better
  timeS: number; // seconds per picture
  peakGb: number; // peak GPU memory
  sizeMb: number; // all weights
  baseline?: boolean;
}

export const SETUPS: SetupResult[] = [
  {
    id: "B0",
    name: "Original",
    what: "SANA-Sprint teacher: 20 steps + guidance, 1024px",
    steps: 20,
    resolution: 1024,
    clip: 26.6,
    fid: 92.39,
    kid1000: 9.04,
    timeS: 6.08,
    peakGb: 8.79,
    sizeMb: 7037,
    baseline: true,
  },
  {
    id: "S1",
    name: "Sprint 2-step",
    what: "Distilled model, 2 steps, 1024px",
    steps: 2,
    resolution: 1024,
    clip: 26.43,
    fid: 87.2,
    kid1000: 8.42,
    timeS: 1.29,
    peakGb: 8.79,
    sizeMb: 7040,
  },
  {
    id: "S8",
    name: "Sprint 768px",
    what: "2 steps at 768px",
    steps: 2,
    resolution: 768,
    clip: 26.25,
    fid: 85.59,
    kid1000: 7.58,
    timeS: 0.78,
    peakGb: 8.03,
    sizeMb: 7040,
  },
  {
    id: "M2",
    name: "Low-memory 768px",
    what: "2 steps; 4-bit text reader, CPU word table, 8-bit drawer, tiled decode",
    steps: 2,
    resolution: 768,
    clip: 26.27,
    fid: 85.52,
    kid1000: 6.47,
    timeS: 1.21,
    peakGb: 2.99,
    sizeMb: 2512,
  },
  {
    id: "M3",
    name: "Low-memory 1024px",
    what: "2 steps; 4-bit text reader, CPU word table, 4-bit drawer, tiled decode",
    steps: 2,
    resolution: 1024,
    clip: 26.52,
    fid: 86.24,
    kid1000: 6.88,
    timeS: 1.57,
    peakGb: 2.86,
    sizeMb: 2355,
  },
];

/** Which optimized setup the headline stats describe. Matches eval_P3_T58.md (main = M3). */
export const HEADLINE_SETUP_ID = "M3";

export const MEASURED_HOW =
  "Tesla T4 GPU, float16 · 500 MS-COCO prompts · realism (FID/KID) against 5,000 real photos · time = average of 10 single pictures after warm-up";

/**
 * Held-out cascade evaluation from eval_P3_T58.md (not the 500-prompt M3 optimization ablation).
 * 200 prompts: 120 GenEval prompts + 80 COCO captions; independently scored with Mask2Former and
 * CLIP ViT-L/14. GenEval-style is our evaluation, not the official GenEval benchmark.
 */
export const CASCADE_RESULTS = {
  promptCount: 200,
  ours: {
    label: "P3 cascade from R0",
    avgTimeS: 2.0,
    p90TimeS: 3.94,
    semanticAccuracy: 76.7,
    clip: 28.02,
    visuallyClean: 96.0,
  },
  original: {
    label: "Original teacher",
    avgTimeS: 6.84,
    p90TimeS: 6.84,
    semanticAccuracy: 80.0,
    clip: 28.05,
    visuallyClean: 92.5,
  },
  router: {
    accuracy: 46.5,
    majorityBaseline: 58.0,
  },
} as const;

export function baseline(): SetupResult {
  return SETUPS.find((s) => s.baseline)!;
}

export function headline(): SetupResult {
  return SETUPS.find((s) => s.id === HEADLINE_SETUP_ID)!;
}
