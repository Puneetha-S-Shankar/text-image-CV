/**
 * Real measured results, used by the "How it works" and "Compare" pages.
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
    what: "4-bit text reader, word table on CPU, 8-bit drawer, tiled decode, 768px",
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
    what: "Same as M2 with a 4-bit drawer, 1024px",
    clip: 26.52,
    fid: 86.24,
    kid1000: 6.88,
    timeS: 1.57,
    peakGb: 2.86,
    sizeMb: 2355,
  },
];

/**
 * Which optimized setup the headline stats describe.
 * TODO(team): decide M2 vs M3 to match the eval file, and keep both in sync.
 */
export const HEADLINE_SETUP_ID = "M2";

export const MEASURED_HOW =
  "Tesla T4 GPU, float16 · 500 MS-COCO prompts · realism (FID/KID) against 5,000 real photos · time = average of 10 single pictures after warm-up";

/**
 * Router + cascade results from notebook 02b (GenEval-style accuracy, ours vs original).
 * TODO(after 02b): fill in. While null, the pages show "coming soon".
 */
export const CASCADE_RESULTS: null | {
  passRateOurs: number;
  passRateOriginal: number;
  avgTimeOursS: number;
  avgTimeOriginalS: number;
  note: string;
} = null;

export function baseline(): SetupResult {
  return SETUPS.find((s) => s.baseline)!;
}

export function headline(): SetupResult {
  return SETUPS.find((s) => s.id === HEADLINE_SETUP_ID)!;
}
