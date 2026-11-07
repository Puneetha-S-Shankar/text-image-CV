/**
 * App-wide settings and copy. Change names and text here, not scattered through components.
 */
import type { Mode } from "./types";

export const APP = {
  /** Placeholder product name: the team picks the final one. */
  name: "P3 Studio",
  tagline: "A thoughtful studio for text-to-image creation.",
  description:
    "Resource-efficient text-to-image for phones: an optimized SANA-Sprint model on a single T4 GPU, with a quality check that retries only when a picture fails.",
  /** Shown in the footer. */
  team: "Team T58",
  themeColor: "#f5f1eb",
} as const;

/** Must match the backend's limit (docs/API_CONTRACT.md). */
export const PROMPT_MAX_CHARS = 400;

export interface ModeInfo {
  label: string;
  /** Describes the generation tradeoff without promising a specific duration. */
  blurb: string;
}

/**
 * The three modes. The backend decides the implementation details; these descriptions explain the
 * current API contract without promising generation times.
 */
export const MODES: Record<Mode, ModeInfo> = {
  fast: {
    label: "Fast",
    blurb: "One 768px attempt; quality checked, with no retry.",
  },
  balanced: {
    label: "Balanced",
    blurb: "Starts at 768px; retries when checks fail, within a 6 s generation budget.",
  },
  quality: {
    label: "Quality",
    blurb: "Starts at 1024px; retries with fresh samples within a 9 s generation budget.",
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

export const PROMPT_INSPIRATION = [
  {
    category: "Architecture",
    prompt: "A sunlit modern courtyard with olive trees and limestone walls",
  },
  {
    category: "Nature",
    prompt: "A misty pine forest surrounding an alpine lake at dawn",
  },
  {
    category: "Fantasy",
    prompt: "A tiny observatory floating above a quiet sea of clouds",
  },
  {
    category: "Product photography",
    prompt: "An amber glass perfume bottle on travertine in soft studio light",
  },
  {
    category: "Illustration",
    prompt: "A hand-painted botanical illustration of wildflowers and moths",
  },
] as const;
