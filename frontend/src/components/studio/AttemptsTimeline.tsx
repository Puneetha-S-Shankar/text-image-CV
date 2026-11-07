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
    <div className="rounded-2xl glass p-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-medium">How it was made</h2>
        <span className="text-xs text-mist">Router started at level {routerStart + 1}</span>
      </div>
      <ol className="mt-3 grid gap-0">
        {attempts.map((a, i) => {
          const last = i === attempts.length - 1;
          return (
            <li key={`${a.level}-${a.seed}`} className="relative flex gap-3 pb-3 last:pb-0">
              {!last && (
                <span
                  aria-hidden
                  className="absolute top-6 left-[11px] h-[calc(100%-1rem)] w-px bg-white/15"
                />
              )}
              <span
                className={`relative z-10 mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full text-[11px] font-semibold ${
                  a.passed ? "bg-ok/20 text-ok" : "bg-bad/20 text-bad"
                }`}
              >
                {a.level + 1}
              </span>
              <div className="flex-1 text-sm">
                <div className="flex flex-wrap items-baseline justify-between gap-x-2">
                  <span>
                    Level {a.level + 1} · {a.resolution}px
                  </span>
                  <span className="text-xs text-mist tabular-nums">{a.time_s.toFixed(2)} s</span>
                </div>
                <div className={`text-xs ${a.passed ? "text-ok" : "text-bad/90"}`}>
                  {a.passed ? "Passed the check" : `Failed: ${a.reasons.join(", ") || "check"}`}
                  {!a.passed && !last && " → trying the next level with a new seed"}
                </div>
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
