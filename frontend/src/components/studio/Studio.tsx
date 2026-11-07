"use client";

import { useRef, useState } from "react";
import { ApiError, generate } from "@/lib/api";
import { DEFAULT_MODE } from "@/lib/config";
import type { Mode } from "@/lib/types";
import { useHealth } from "@/hooks/useHealth";
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

  const busy = state.kind === "generating";

  async function run(text: string, runMode: Mode) {
    const p = text.trim();
    if (!p || busy) return;

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
    }
  }

  function pickExample(text: string) {
    setPrompt(text);
    run(text, mode);
  }

  return (
    <div className="flex flex-1 flex-col">
      <section className="animate-fade-up pt-6">
        <div className="flex items-start justify-between gap-3">
          <h1 className="text-2xl leading-tight font-semibold tracking-tight sm:text-3xl">
            Describe it.
            <br />
            <span className="text-gradient">See it in about a second.</span>
          </h1>
          <StatusPill health={health} />
        </div>
        <ServerBanner health={health} />
      </section>

      <ImageStage
        state={state}
        onPickExample={pickExample}
        onRetry={() => state.kind === "error" && run(state.prompt, state.mode)}
      />

      {state.kind === "done" && (
        <ResultDetails
          result={state.result}
          clientTotalS={state.clientTotalS}
          onAgain={() => run(state.result.prompt, state.result.mode)}
        />
      )}

      {history.length > 1 && (
        <HistoryStrip
          items={history}
          activeId={state.kind === "done" ? state.result.id : null}
          onSelect={(item) => setState({ kind: "done", ...item })}
        />
      )}

      {/* Prompt dock: stays at the bottom of the screen like a chat app's input bar. */}
      <div className="sticky bottom-0 z-10 -mx-4 mt-auto border-t border-white/5 bg-ink-950/90 px-4 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] backdrop-blur-xl before:pointer-events-none before:absolute before:inset-x-0 before:-top-8 before:h-8 before:bg-linear-to-t before:from-ink-950/80 before:to-transparent">
        <ModeSwitch value={mode} onChange={setMode} disabled={busy} />
        <PromptBar
          value={prompt}
          onChange={setPrompt}
          onSubmit={() => run(prompt, mode)}
          onCancel={() => abortRef.current?.abort()}
          busy={busy}
        />
      </div>
    </div>
  );
}
