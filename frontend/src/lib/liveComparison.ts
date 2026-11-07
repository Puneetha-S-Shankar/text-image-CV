import type { Attempt, GenerateResponse } from "./types";

const STORAGE_KEY = "p3-live-comparison";
export const LIVE_COMPARISON_UPDATED_EVENT = "p3-live-comparison-updated";

export interface LiveComparisonSnapshot {
  prompt: string;
  beforeImage?: string;
  afterImage: string;
  width: number;
  height: number;
  attempts: Attempt[];
  passed: boolean;
  polishApplied: boolean;
  mock?: boolean;
}

export function saveLiveComparison(result: GenerateResponse): void {
  const snapshot: LiveComparisonSnapshot = {
    prompt: result.prompt,
    beforeImage: result.initial_image,
    afterImage: result.image,
    width: result.width,
    height: result.height,
    attempts: result.attempts,
    passed: result.passed,
    polishApplied: result.polish.applied,
    mock: result.mock,
  };
  window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot));
  window.dispatchEvent(new Event(LIVE_COMPARISON_UPDATED_EVENT));
}

export function loadLiveComparison(): LiveComparisonSnapshot | null {
  const stored = window.sessionStorage.getItem(STORAGE_KEY);
  if (!stored) return null;

  const value: unknown = JSON.parse(stored);
  if (!isLiveComparisonSnapshot(value)) {
    throw new Error("Saved comparison data is invalid.");
  }
  return value;
}

function isLiveComparisonSnapshot(value: unknown): value is LiveComparisonSnapshot {
  if (!value || typeof value !== "object") return false;
  const snapshot = value as Record<string, unknown>;
  return (
    typeof snapshot.prompt === "string" &&
    (snapshot.beforeImage === undefined || isImageDataUrl(snapshot.beforeImage)) &&
    isImageDataUrl(snapshot.afterImage) &&
    typeof snapshot.width === "number" &&
    typeof snapshot.height === "number" &&
    Array.isArray(snapshot.attempts) &&
    typeof snapshot.passed === "boolean" &&
    typeof snapshot.polishApplied === "boolean"
  );
}

function isImageDataUrl(value: unknown): value is string {
  return typeof value === "string" && value.startsWith("data:image/");
}
