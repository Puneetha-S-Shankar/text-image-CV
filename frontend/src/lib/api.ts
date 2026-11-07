/**
 * The ONLY place that talks to the backend. Components call these functions, never fetch() directly.
 * See docs/API_CONTRACT.md.
 */
import type {
  ApiErrorBody,
  ErrorCode,
  GenerateRequest,
  GenerateResponse,
  HealthResponse,
} from "./types";

/** Error codes the client itself can produce, on top of the backend's. */
export type ClientErrorCode = ErrorCode | "NETWORK" | "TIMEOUT" | "BAD_RESPONSE";

export class ApiError extends Error {
  constructor(
    public readonly code: ClientErrorCode,
    message: string,
    public readonly status: number | null = null,
    public readonly retryAfterS: number | null = null,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

/** Client-side timeout for one generation. The backend's own budget is far lower (seconds). */
const GENERATE_TIMEOUT_MS = 60_000;
const HEALTH_TIMEOUT_MS = 8_000;

/**
 * Where the backend lives.
 * - Production build: "" (same address as the page, because the T4 Space serves both).
 * - `npm run dev`: the mock server on port 8787 of the address you opened the page from.
 * - NEXT_PUBLIC_API_BASE overrides both, e.g. to try the dev app against the real Space.
 */
export function apiBase(): string {
  const configured = process.env.NEXT_PUBLIC_API_BASE;
  if (configured) return configured.replace(/\/+$/, "");
  if (process.env.NODE_ENV === "development" && typeof window !== "undefined") {
    const port = process.env.NEXT_PUBLIC_MOCK_PORT || "8787";
    return `${window.location.protocol}//${window.location.hostname}:${port}`;
  }
  return "";
}

async function request<T>(path: string, init: RequestInit, timeoutMs: number): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort("timeout"), timeoutMs);
  // Let a caller's own AbortSignal (e.g. a Cancel button) abort the request too.
  init.signal?.addEventListener("abort", () => controller.abort(init.signal?.reason), {
    once: true,
  });

  let res: Response;
  try {
    res = await fetch(`${apiBase()}${path}`, { ...init, signal: controller.signal });
  } catch (err) {
    if (controller.signal.aborted && controller.signal.reason === "timeout") {
      throw new ApiError("TIMEOUT", "The server took too long to answer. Please try again.");
    }
    if (controller.signal.aborted) throw err; // cancelled by the caller: let them handle it
    throw new ApiError("NETWORK", "Can't reach the server. Check your connection and try again.");
  } finally {
    clearTimeout(timer);
  }

  let body: unknown;
  try {
    body = await res.json();
  } catch {
    throw new ApiError("BAD_RESPONSE", "The server sent an unexpected reply.", res.status);
  }

  if (!res.ok) {
    const e = (body as Partial<ApiErrorBody>)?.error;
    throw new ApiError(
      e?.code ?? "INTERNAL",
      e?.message ?? `Something went wrong (HTTP ${res.status}).`,
      res.status,
      e?.retry_after_s ?? null,
    );
  }
  return body as T;
}

export function generate(req: GenerateRequest, signal?: AbortSignal): Promise<GenerateResponse> {
  return request<GenerateResponse>(
    "/api/generate",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(req),
      signal,
    },
    GENERATE_TIMEOUT_MS,
  );
}

export function getHealth(signal?: AbortSignal): Promise<HealthResponse> {
  return request<HealthResponse>("/api/health", { method: "GET", signal }, HEALTH_TIMEOUT_MS);
}
