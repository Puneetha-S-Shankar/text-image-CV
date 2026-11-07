"use client";

import { useEffect, useState } from "react";
import type { ApiError } from "@/lib/api";
import { EXAMPLE_PROMPTS, MODES } from "@/lib/config";
import type { Mode } from "@/lib/types";
import { RefreshIcon, SparkIcon } from "../icons";
import type { StudioState } from "./types";

interface Props {
  state: StudioState;
  onPickExample: (prompt: string) => void;
  onRetry: () => void;
}

/** The big square: examples when idle, a live timer while drawing, the picture, or an error. */
export function ImageStage({ state, onPickExample, onRetry }: Props) {
  return (
    <div className="relative aspect-square min-h-[23rem] w-full overflow-hidden rounded-[28px] border border-ink-700 bg-ink-800 shadow-preview sm:rounded-[32px]">
      {state.kind === "idle" && <EmptyState onPick={onPickExample} />}
      {state.kind === "generating" && (
        <Generating startedAt={state.startedAt} prompt={state.prompt} mode={state.mode} />
      )}
      {state.kind === "done" && (
        <>
          {/* Plain <img>: the picture is a data URL from our API, so next/image adds nothing here. */}
          <img
            key={state.result.id}
            src={state.result.image}
            alt={state.result.prompt}
            width={state.result.width}
            height={state.result.height}
            className="h-full w-full animate-fade-up bg-ink-800 object-contain"
          />
          {state.result.mock && (
            <span className="absolute top-3 left-3 rounded-full border border-ink-700 bg-ink-900/95 px-3 py-1.5 text-[10px] font-semibold tracking-[0.12em] text-accent-1 uppercase shadow-card-soft">
              Mock preview
            </span>
          )}
        </>
      )}
      {state.kind === "error" && <ErrorView error={state.error} onRetry={onRetry} />}
    </div>
  );
}

function EmptyState({ onPick }: { onPick: (prompt: string) => void }) {
  return (
    <div className="flex h-full flex-col justify-between gap-4 bg-ink-950 p-4 sm:p-7">
      <div className="flex flex-1 flex-col items-center justify-center gap-4 text-center">
        <span className="grid h-16 w-16 place-items-center rounded-[22px] border border-ink-700 bg-ink-900 text-accent-1 shadow-card-soft">
          <SparkIcon className="h-7 w-7" />
        </span>
        <div className="space-y-2">
          <p className="text-lg font-semibold tracking-tight text-espresso sm:text-xl">
            A blank canvas, full of possibility.
          </p>
          <p className="mx-auto max-w-[19rem] text-sm leading-6 text-mist">
            Describe a scene below. We’ll create it in the cloud and check the result against your
            prompt.
          </p>
        </div>
      </div>
      <div className="flex flex-wrap justify-center gap-2">
        {EXAMPLE_PROMPTS.slice(0, 3).map((p) => (
          <button
            key={p}
            type="button"
            onClick={() => onPick(p)}
            className="min-h-10 rounded-full border border-ink-700 bg-ink-900/90 px-3 py-2 text-left text-xs text-espresso transition hover:border-accent-1/40 hover:bg-ink-900"
          >
            {p}
          </button>
        ))}
      </div>
    </div>
  );
}

function Generating({
  startedAt,
  prompt,
  mode,
}: {
  startedAt: number;
  prompt: string;
  mode: Mode;
}) {
  return (
    <div
      role="status"
      aria-live="polite"
      className="relative flex h-full flex-col justify-between overflow-hidden bg-ink-800 p-4 sm:p-7"
    >
      <div className="relative z-10 flex items-center justify-between gap-2 text-[10px] font-medium tracking-[0.16em] text-mist uppercase">
        <span className="rounded-full border border-ink-700 bg-ink-900 px-3 py-2 text-accent-1">
          {MODES[mode].label} mode
        </span>
        <span className="text-right tracking-normal normal-case">Live status</span>
      </div>

      <div className="relative z-10 flex flex-1 flex-col items-center justify-center gap-4 text-center">
        <span className="relative grid h-16 w-16 place-items-center rounded-[22px] border border-ink-700 bg-ink-900 text-accent-1 shadow-card-soft">
          <span className="absolute inset-0 animate-ping rounded-[22px] border border-accent-2/50" />
          <SparkIcon className="relative h-7 w-7" />
        </span>
        <div>
          <p className="text-[11px] font-semibold tracking-[0.2em] text-accent-1 uppercase">
            Creating your image
          </p>
          <LiveTimer startedAt={startedAt} />
        </div>
        <p className="max-w-sm text-sm leading-6 text-espresso">Generating on the GPU server…</p>
        <p className="line-clamp-2 max-w-md text-xs leading-5 text-mist">&ldquo;{prompt}&rdquo;</p>
      </div>
    </div>
  );
}

/** Counts up from the moment Generate was pressed. Mounted only while generating. */
function LiveTimer({ startedAt }: { startedAt: number }) {
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    let raf = 0;
    const tick = () => {
      setElapsed((performance.now() - startedAt) / 1000);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [startedAt]);
  return (
    <span className="mt-1 block font-mono text-4xl font-semibold tracking-tight text-espresso tabular-nums">
      {elapsed.toFixed(1)}
      <span className="text-xl text-mist"> s</span>
    </span>
  );
}

const RETRYABLE = new Set(["NETWORK", "TIMEOUT", "BAD_RESPONSE", "INTERNAL", "WARMING_UP", "BUSY"]);

function ErrorView({ error, onRetry }: { error: ApiError; onRetry: () => void }) {
  const canRetry = RETRYABLE.has(error.code);
  return (
    <div
      role="alert"
      className="flex h-full flex-col items-center justify-center gap-4 bg-ink-900 p-6 text-center"
    >
      <span className="rounded-full border border-bad/30 bg-bad/10 px-3 py-1 font-mono text-[11px] font-medium text-bad">
        {error.code}
      </span>
      <div className="space-y-2">
        <p className="max-w-xs text-base font-medium text-espresso">{error.message}</p>
        {error.retryAfterS != null && (
          <p className="text-xs text-mist">Suggested wait: about {error.retryAfterS} s.</p>
        )}
      </div>
      {canRetry ? (
        <button
          type="button"
          onClick={onRetry}
          className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-brand px-4 py-2.5 text-sm font-semibold text-ink-900 shadow-action transition hover:brightness-105"
        >
          <RefreshIcon className="h-4 w-4" /> Try again
        </button>
      ) : (
        <p className="text-xs text-mist">Edit the prompt below and generate again.</p>
      )}
    </div>
  );
}
