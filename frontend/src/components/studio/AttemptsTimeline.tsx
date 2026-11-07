import type { Attempt } from "@/lib/types";

/**
 * The cascade, made visible: each try, its level and size, its time, and why it failed.
 * This is the project's main idea, so make it look great.
 */
export function AttemptsTimeline({
  attempts,
  routerStart,
}: {
  attempts: Attempt[];
  routerStart: number;
}) {
  return (
    <div className="rounded-[26px] border border-ink-700 bg-ink-900 p-4 shadow-card-soft">
      <div className="mb-3 flex items-center justify-between gap-2">
        <div>
          <p className="text-[10px] font-semibold tracking-[0.16em] text-accent-1 uppercase">
            Generation journey
          </p>
          <h2 className="mt-1 text-sm font-semibold text-espresso">Quality-gated cascade</h2>
        </div>
        <span className="text-right text-[11px] text-mist">
          Actual first level {routerStart + 1}
          <span className="block text-[10px]">Mode-selected · trained router not active</span>
        </span>
      </div>
      {attempts.length === 0 ? (
        <p className="rounded-2xl bg-ink-950 p-3 text-xs leading-5 text-mist">
          The server did not return attempt details for this result.
        </p>
      ) : (
        <ol className="grid gap-3" aria-label="Generation attempts and quality checks">
          {attempts.map((a, i) => {
            const last = i === attempts.length - 1;
            return (
              <li key={`${a.level}-${a.seed}`} className="relative flex gap-3 pl-1">
                {!last && (
                  <span
                    aria-hidden
                    className="absolute top-7 left-[11px] h-[calc(100%-0.9rem)] w-px bg-ink-700"
                  />
                )}
                <span
                  className={`relative z-10 mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full text-[11px] font-semibold ${
                    a.passed ? "bg-ok/15 text-ok" : "bg-warn/15 text-warn"
                  }`}
                >
                  {a.level + 1}
                </span>
                <div className="min-w-0 flex-1 rounded-2xl border border-ink-700 bg-ink-950/75 px-3 py-2.5">
                  <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1">
                    <div>
                      <span className="block text-[10px] font-semibold tracking-[0.12em] text-accent-1 uppercase">
                        {i === 0 ? "Initial generation" : `Retry ${i}`}
                      </span>
                      <span className="mt-0.5 block text-sm font-semibold text-espresso">
                        Level {a.level + 1} · {a.resolution}px
                      </span>
                    </div>
                    <span className="text-[11px] text-mist tabular-nums">
                      {a.time_s.toFixed(2)} s
                    </span>
                  </div>
                  <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[10px] font-medium">
                    <span className="rounded-full bg-ink-800 px-2 py-1 text-mist">Generation</span>
                    <span className="text-mist" aria-hidden="true">
                      →
                    </span>
                    <span
                      className={`rounded-full px-2 py-1 ${
                        a.passed ? "bg-ok/10 text-ok" : "bg-warn/10 text-warn"
                      }`}
                    >
                      Quality check · {a.passed ? "passed" : "needs refinement"}
                    </span>
                  </div>
                  {!a.passed && a.reasons.length > 0 && (
                    <p className="mt-2 text-xs leading-5 text-mist">{a.reasons.join(", ")}</p>
                  )}
                  {!a.passed && !last && (
                    <p className="mt-1 text-[11px] leading-5 text-mist">
                      Another attempt follows at the next level returned by the server.
                    </p>
                  )}
                  {last && (
                    <p className="mt-2 text-xs font-semibold text-accent-1">
                      Final output · {a.passed ? "quality check passed" : "best effort"}
                    </p>
                  )}
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}
