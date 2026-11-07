/**
 * App-wide settings and copy. Change names and text here, not scattered through components.
 */
import type { Mode } from "./types";

export const APP = {
  /** Placeholder product name: the team picks the final one. */
  name: "P3 Studio",
  tagline: "Text to image in about a second, on one small GPU.",
  description:
    "Resource-efficient text-to-image for phones: an optimized SANA-Sprint model on a single T4 GPU, with a quality check that retries only when a picture fails.",
  /** Shown in the footer. */
  team: "Team T58",
  themeColor: "#07070c",
} as const;

/** Must match the backend's limit (docs/API_CONTRACT.md). */
export const PROMPT_MAX_CHARS = 400;

export interface ModeInfo {
  label: string;
  /** One short line under the mode switch. */
  blurb: string;
  /** Rough expected wait. Placeholders until notebook 03a measures the real numbers. */
  expected: string;
}

/**
 * The three modes. The backend decides what each one really does. These texts only describe it.
 * TODO(after 03a): update `expected` with the measured numbers (03a section 9, "live_avg_s").
 */
export const MODES: Record<Mode, ModeInfo> = {
  fast: {
    label: "Fast",
    blurb: "Cheapest level only, no retries.",
    expected: "~1 s",
  },
  balanced: {
    label: "Balanced",
    blurb: "Starts cheap; if the check fails, it retries at the next level with a new seed.",
    expected: "~1.5–3 s",
  },
  quality: {
    label: "Quality",
    blurb: "Starts at full size; if the check fails, it tries again with a new seed.",
    expected: "~2–5 s",
  },
};

export const DEFAULT_MODE: Mode = "balanced";

/** Example prompts. The first few deliberately exercise the checker: counts, colours, positions. */
export const EXAMPLE_PROMPTS = [
  "two dogs and one cat sitting on a sofa",
  "a red car to the left of a blue bus",
  "three yellow apples on a wooden table",
  "a cozy cabin in a snowy forest at night, warm light in the windows",
  "an astronaut riding a horse on the moon, cinematic",
  "a bowl of ramen with a soft-boiled egg, top-down photo",
];
