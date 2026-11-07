"use client";

import { useRef, useState } from "react";
import { ApiError, generate } from "@/lib/api";
import { DEFAULT_MODE, MODES } from "@/lib/config";
import type { Mode } from "@/lib/types";
import { useHealth } from "@/hooks/useHealth";
import { PromptInspiration } from "@/components/PromptInspiration";
import { HistoryStrip } from "./HistoryStrip";
import { ImageStage } from "./ImageStage";
import { ModeSwitch } from "./ModeSwitch";
import { PromptBar } from "./PromptBar";
import { ResultDetails } from "./ResultDetails";
import { ServerBanner, StatusPill } from "./StatusPill";
import type { HistoryItem, StudioState } from "./types";

/** The main "type a prompt, get a picture" screen. Owns all of its state. */
export function Studio() {
  const health = useHealth();
  const [prompt, setPrompt] = useState("");
  const [mode, setMode] = useState<Mode>(DEFAULT_MODE);
  const [state, setState] = useState<StudioState>({ kind: "idle" });
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const abortRef = useRef<AbortController | null>(null);
  const generationInFlightRef = useRef(false);

  const busy = state.kind === "generating";

  async function run(text: string, runMode: Mode) {
    const p = text.trim();
    if (!p || generationInFlightRef.current) return;

    generationInFlightRef.current = true;
    const controller = new AbortController();
    abortRef.current = controller;
    const startedAt = performance.now();
    setState({ kind: "generating", startedAt, prompt: p, mode: runMode });

    try {
      const result = await generate({ prompt: p, mode: runMode }, controller.signal);
      const item: HistoryItem = { result, clientTotalS: (performance.now() - startedAt) / 1000 };
      setState({ kind: "done", ...item });
      setHistory((h) => [item, ...h].slice(0, 12));
    } catch (err) {
      if (controller.signal.aborted) {
        setState({ kind: "idle" });
        return;
      }
      const error =
        err instanceof ApiError
          ? err
          : new ApiError("INTERNAL", "Something went wrong. Please try again.");
      setState({ kind: "error", error, prompt: p, mode: runMode });
    } finally {
      if (abortRef.current === controller) {
        abortRef.current = null;
        generationInFlightRef.current = false;
      }
    }
  }

  function pickExample(text: string) {
    setPrompt(text);
  }

  return (
    <div className="flex flex-1 flex-col">
      <section className="animate-fade-up pt-7 sm:pt-10">
        <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
          <div className="space-y-2">
            <p className="text-[10px] font-semibold tracking-[0.22em] text-accent-1 uppercase sm:text-[11px]">
              P3 · cloud-assisted creative studio
            </p>
            <h1 className="text-3xl leading-tight font-semibold tracking-tight text-espresso sm:text-4xl">
              Give an idea
              <span className="mt-1 block text-gradient">a life of its own.</span>
            </h1>
          </div>
          <StatusPill health={health} />
        </div>
        <ServerBanner health={health} />
      </section>

      <div className="mt-3 grid gap-5 lg:grid-cols-[minmax(0,1.2fr)_minmax(20rem,0.8fr)] lg:items-start lg:gap-7">
        <div className="min-w-0 space-y-4">
          <ImageStage
            state={state}
            onPickExample={pickExample}
            onRetry={() => state.kind === "error" && run(state.prompt, state.mode)}
          />
          <PromptInspiration onSelect={pickExample} />
          {history.length > 0 && (
            <HistoryStrip
              items={history}
              activeId={state.kind === "done" ? state.result.id : null}
              onSelect={(item) => setState({ kind: "done", ...item })}
            />
          )}
        </div>

        <div className="min-w-0 space-y-4">
          <section aria-label="Generation controls">
            <ModeSwitch value={mode} onChange={setMode} disabled={busy} />
            <PromptBar
              value={prompt}
              onChange={setPrompt}
              onSubmit={() => run(prompt, mode)}
              onCancel={() => abortRef.current?.abort()}
              busy={busy}
            />
          </section>

          {state.kind === "done" ? (
            <ResultDetails
              result={state.result}
              clientTotalS={state.clientTotalS}
              onAgain={() => run(state.result.prompt, state.result.mode)}
            />
          ) : (
            <aside className="rounded-[28px] border border-ink-700 bg-ink-900/90 p-5 shadow-card sm:p-6">
              <p className="text-[10px] font-semibold tracking-[0.2em] text-accent-1 uppercase">
                Thoughtful by design
              </p>
              <h2 className="mt-2 text-xl font-semibold tracking-tight text-espresso">
                {state.kind === "generating"
                  ? "Generating on the GPU server"
                  : state.kind === "error"
                    ? "Need a quick retry"
                    : "Quality without excess"}
              </h2>
              <p className="mt-2 text-sm leading-6 text-mist">
                {state.kind === "generating"
                  ? `Your prompt is being drawn and checked before the system decides whether a retry is needed.`
                  : state.kind === "error"
                    ? "The request did not complete cleanly. Adjust the prompt and try again, or let the app retry automatically when the backend is ready."
                    : "P3 starts with an efficient generation, checks the image against your prompt, and spends more compute only when another try is needed."}
              </p>
              <div className="mt-5 grid gap-2 text-xs sm:grid-cols-2 lg:grid-cols-1">
                <div className="rounded-2xl border border-ink-700 bg-ink-950/70 p-3">
                  <span className="text-mist">Mode</span>
                  <div className="mt-1 font-semibold text-espresso">{MODES[mode].label}</div>
                </div>
                <div className="rounded-2xl border border-ink-700 bg-ink-950/70 p-3">
                  <span className="text-mist">Tradeoff</span>
                  <div className="mt-1 leading-5 font-medium text-espresso">
                    {MODES[mode].blurb}
                  </div>
                </div>
              </div>
            </aside>
          )}
        </div>
      </div>
    </div>
  );
}
