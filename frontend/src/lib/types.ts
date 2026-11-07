/**
 * The API contract between this app and the T4 backend.
 * Must stay identical to docs/API_CONTRACT.md and to what the backend returns.
 * Change it only together with the backend person, never on one side alone.
 */

export type Mode = "fast" | "balanced" | "quality";

/** POST /api/generate request body. */
export interface GenerateRequest {
  prompt: string;
  mode: Mode;
  /** Optional: same prompt + same seed gives the same first picture. Omit for a random one. */
  seed?: number;
}

/** One try in the cascade: draw at a level, then check the picture. */
export interface Attempt {
  /** 0-based cascade level: 0 is the cheapest. */
  level: number;
  /** Square picture size in pixels at this level, e.g. 768 or 1024. */
  resolution: number;
  seed: number;
  /** Seconds for this try (drawing + checking). */
  time_s: number;
  passed: boolean;
  /** Why it failed, in plain words, e.g. "missing: dog", "too dark". Empty when it passed. */
  reasons: string[];
}

export type CheckKind = "object" | "count" | "colour" | "position";

/** One "does the picture match the prompt?" check, only for things the prompt asked for. */
export interface SemanticCheck {
  kind: CheckKind;
  /** Short human-readable label, e.g. "2 × dog", "red car", "dog left of cat". */
  label: string;
  ok: boolean;
  /** Optional extra detail, e.g. "found 1". */
  detail?: string;
}

export interface Timing {
  /** Server time from request received to response ready. Excludes network time. */
  total_s: number;
  generate_s: number;
  check_s: number;
  polish_s: number;
  encode_s: number;
}

/** POST /api/generate success response (HTTP 200). */
export interface GenerateResponse {
  id: string;
  /** Data URL, ready for <img src>. The real backend sends "data:image/webp;base64,...". */
  image: string;
  width: number;
  height: number;
  prompt: string;
  mode: Mode;
  /** Whether the final picture passed the quality gate. False means the best effort within budget. */
  passed: boolean;
  /** Cascade level that produced the final picture (0-based). */
  level_used: number;
  /** How many levels exist in total (for "level 2 of 3"). */
  levels_total: number;
  /** Every try in order. The last one produced the returned picture. */
  attempts: Attempt[];
  timing: Timing;
  checks: {
    /** CLIP prompt-match score (x100), or null if not computed. */
    clip_score: number | null;
    /** Classical image-quality check (blur, too dark, noise, colour cast...). */
    visual: { ok: boolean; flags: string[] };
    semantic: SemanticCheck[];
  };
  /** The router's choice of starting level (the "AI that decides"). */
  router: { start_level: number; confidence: number | null };
  /** Classical-CV polish applied after the check (accept-or-revert). */
  polish: { applied: boolean; steps: string[] };
  /** Human-readable model/setup name, e.g. "SANA-Sprint 0.6B · 4-bit · 1024px". */
  model: string;
  gpu: string;
  /** True only when the response comes from the mock server. */
  mock?: boolean;
}

export type ErrorCode =
  | "EMPTY_PROMPT"
  | "PROMPT_TOO_LONG"
  | "BAD_MODE"
  | "UNSAFE_PROMPT"
  | "WARMING_UP"
  | "BUSY"
  | "INTERNAL";

/** Body of every non-200 response from the backend. */
export interface ApiErrorBody {
  error: {
    code: ErrorCode;
    /** Safe to show to the user as-is. */
    message: string;
    /** For WARMING_UP and BUSY: suggested wait before retrying. */
    retry_after_s?: number;
  };
}

/** GET /api/health response (always HTTP 200 while the server process is up). */
export interface HealthResponse {
  ready: boolean;
  status: "loading" | "ready";
  model: string;
  gpu: string;
  uptime_s: number;
  /** Requests currently waiting for the GPU. */
  queue: number;
  mock?: boolean;
}
