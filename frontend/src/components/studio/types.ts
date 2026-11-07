import type { ApiError } from "@/lib/api";
import type { GenerateResponse, Mode } from "@/lib/types";

/** One finished generation, kept for the history strip (in memory only, never stored). */
export interface HistoryItem {
  result: GenerateResponse;
  /** Seconds the user actually waited, measured in the browser (includes network). */
  clientTotalS: number;
}

export type StudioState =
  | { kind: "idle" }
  | { kind: "generating"; startedAt: number; prompt: string; mode: Mode }
  | ({ kind: "done" } & HistoryItem)
  | { kind: "error"; error: ApiError; prompt: string; mode: Mode };
