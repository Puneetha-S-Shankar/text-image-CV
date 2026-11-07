"use client";

import { useEffect, useState, type ReactNode } from "react";
import {
  LIVE_COMPARISON_UPDATED_EVENT,
  loadLiveComparison,
  type LiveComparisonSnapshot,
} from "@/lib/liveComparison";

type ViewState =
  | { kind: "loading" }
  | { kind: "empty" }
  | { kind: "error" }
  | { kind: "ready"; comparison: LiveComparisonSnapshot };

export function LiveComparison() {
  const [state, setState] = useState<ViewState>({ kind: "loading" });

  useEffect(() => {
    function refreshComparison() {
      try {
        const comparison = loadLiveComparison();
        setState(comparison ? { kind: "ready", comparison } : { kind: "empty" });
      } catch {
        setState({ kind: "error" });
      }
    }

    refreshComparison();
    window.addEventListener(LIVE_COMPARISON_UPDATED_EVENT, refreshComparison);
    window.addEventListener("pageshow", refreshComparison);

    return () => {
      window.removeEventListener(LIVE_COMPARISON_UPDATED_EVENT, refreshComparison);
      window.removeEventListener("pageshow", refreshComparison);
    };
  }, []);

  return (
    <section
      aria-label="Before and after refinement"
      className="grid gap-4 rounded-[28px] border border-ink-700 bg-ink-900 p-4 shadow-card-soft sm:p-5"
    >
      <div>
        <p className="text-[10px] font-semibold tracking-[0.16em] text-accent-1 uppercase">
          Cascade comparison
        </p>
        <h2 className="mt-1 text-lg font-semibold text-espresso">Before and after refinement</h2>
      </div>

      {state.kind === "loading" ? (
        <ComparisonMessage>Loading your latest generation…</ComparisonMessage>
      ) : state.kind === "error" ? (
        <ComparisonMessage role="alert">
          This browser could not read the saved comparison. Generate another image and try again.
        </ComparisonMessage>
      ) : state.kind === "empty" ? (
        <ComparisonMessage>
          Generate an image in Create to see its initial attempt and final result here. The
          comparison stays available in this browser session.
        </ComparisonMessage>
      ) : (
        <ComparisonImages comparison={state.comparison} />
      )}
    </section>
  );
}

function ComparisonMessage({ children, role }: { children: ReactNode; role?: "alert" }) {
  return (
    <div
      role={role}
      className="rounded-2xl border border-dashed border-ink-700 bg-ink-950/70 px-4 py-8 text-center text-sm leading-6 text-mist"
    >
      {children}
    </div>
  );
}

function ComparisonImages({ comparison }: { comparison: LiveComparisonSnapshot }) {
  const firstAttempt = comparison.attempts[0];
  const finalAttempt = comparison.attempts[comparison.attempts.length - 1];
  return (
    <div className="grid gap-3">
      <p className="text-sm leading-6 text-mist">&ldquo;{comparison.prompt}&rdquo;</p>
      {comparison.beforeImage ? (
        <div className="grid gap-3 sm:grid-cols-2">
          <ComparisonFigure
            image={comparison.beforeImage}
            title="Before refinement"
            subtitle={
              firstAttempt ? `Initial attempt · level ${firstAttempt.level + 1}` : "Initial attempt"
            }
            width={comparison.width}
            height={comparison.height}
          />
          <ComparisonFigure
            image={comparison.afterImage}
            title="After refinement"
            subtitle={
              finalAttempt ? `Final result · level ${finalAttempt.level + 1}` : "Final result"
            }
            width={comparison.width}
            height={comparison.height}
          />
        </div>
      ) : (
        <ComparisonFigure
          image={comparison.afterImage}
          title="Final result"
          subtitle="The backend did not include the initial attempt image."
          width={comparison.width}
          height={comparison.height}
        />
      )}
      <p className="text-xs leading-5 text-mist">
        {comparison.attempts.length}{" "}
        {comparison.attempts.length === 1 ? "generation attempt" : "generation attempts"} ·{" "}
        {comparison.passed ? "quality checks passed" : "best effort"} ·{" "}
        {comparison.polishApplied ? "image polish kept" : "original final image kept"}
        {comparison.mock ? " · mock preview" : ""}
      </p>
    </div>
  );
}

function ComparisonFigure({
  image,
  title,
  subtitle,
  width,
  height,
}: {
  image: string;
  title: string;
  subtitle: string;
  width: number;
  height: number;
}) {
  return (
    <figure className="overflow-hidden rounded-2xl border border-ink-700 bg-ink-950">
      <div className="aspect-square bg-ink-800">
        <img
          src={image}
          alt={title}
          width={width}
          height={height}
          className="h-full w-full object-contain"
        />
      </div>
      <figcaption className="p-3">
        <span className="block text-sm font-semibold text-espresso">{title}</span>
        <span className="mt-1 block text-xs text-mist">{subtitle}</span>
      </figcaption>
    </figure>
  );
}
