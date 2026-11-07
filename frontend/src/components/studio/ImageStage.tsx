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
    <div className="relative mt-5 aspect-square w-full overflow-hidden rounded-3xl glass">
      {state.kind === "idle" && <EmptyState onPick={onPickExample} />}
      {state.kind === "generating" && (
        <Generating startedAt={state.startedAt} prompt={state.prompt} mode={state.mode} />
      )}
      {state.kind === "done" && (
        // Plain <img>: the picture is a data URL from our API, so next/image adds nothing here.
        <img
          key={state.result.id}
          src={state.result.image}
          alt={state.result.prompt}
          width={state.result.width}
          height={state.result.height}
          className="h-full w-full animate-fade-up object-cover"
        />
      )}
      {state.kind === "error" && <ErrorView error={state.error} onRetry={onRetry} />}
    </div>
  );
}

function EmptyState({ onPick }: { onPick: (prompt: string) => void }) {
  return (
    <div className="flex h-full flex-col justify-end gap-3 p-4">
      <div className="flex flex-1 flex-col items-center justify-center gap-3 text-center text-mist">
        <span className="grid h-14 w-14 animate-float place-items-center rounded-2xl bg-brand shadow-xl shadow-fuchsia-500/20">
          <SparkIcon className="h-7 w-7 text-white" />
        </span>
        <p className="max-w-[16rem] text-sm">
          Type a prompt below, or try one of these. Counts, colours and positions get checked.
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        {EXAMPLE_PROMPTS.slice(0, 4).map((p) => (
          <button
            key={p}
            type="button"
            onClick={() => onPick(p)}
            className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-left text-xs text-white/85 transition hover:border-white/25 hover:bg-white/10"
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
    <div className="flex h-full shimmer flex-col items-center justify-center gap-4 p-6 text-center">
      <span className="grid h-14 w-14 animate-spin place-items-center rounded-2xl bg-brand [animation-duration:2.4s]">
        <SparkIcon className="h-7 w-7 text-white" />
      </span>
      <LiveTimer startedAt={startedAt} />
      <p className="text-sm text-mist">Drawing and checking your picture…</p>
      <p className="line-clamp-2 max-w-xs text-xs text-white/60">&ldquo;{prompt}&rdquo;</p>
      <p className="text-xs text-mist/80">
        {MODES[mode].label} mode · usually {MODES[mode].expected}
      </p>
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
    <span className="font-mono text-4xl font-semibold text-white tabular-nums">
      {elapsed.toFixed(1)}
      <span className="text-xl text-mist"> s</span>
    </span>
  );
}

const RETRYABLE = new Set(["NETWORK", "TIMEOUT", "BAD_RESPONSE", "INTERNAL", "WARMING_UP", "BUSY"]);

function ErrorView({ error, onRetry }: { error: ApiError; onRetry: () => void }) {
  const canRetry = RETRYABLE.has(error.code);
  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 p-6 text-center">
      <span className="rounded-full bg-bad/15 px-3 py-1 font-mono text-xs text-bad">
        {error.code}
      </span>
      <p className="max-w-xs text-base text-white">{error.message}</p>
      {error.retryAfterS != null && (
        <p className="text-xs text-mist">Suggested wait: about {error.retryAfterS} s.</p>
      )}
      {canRetry ? (
        <button
          type="button"
          onClick={onRetry}
          className="mt-1 inline-flex items-center gap-2 rounded-xl bg-white/10 px-4 py-2 text-sm hover:bg-white/15"
        >
          <RefreshIcon className="h-4 w-4" /> Try again
        </button>
      ) : (
        <p className="text-xs text-mist">Edit the prompt below and generate again.</p>
      )}
    </div>
  );
}
