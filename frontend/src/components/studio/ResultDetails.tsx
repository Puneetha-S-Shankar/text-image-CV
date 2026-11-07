"use client";

import { useState, type ReactNode } from "react";
import { MODES } from "@/lib/config";
import { dataUrlToFile, downloadDataUrl } from "@/lib/image";
import type { GenerateResponse } from "@/lib/types";
import { useCanShare } from "@/hooks/useBrowserSupport";
import { CheckIcon, CopyIcon, CrossIcon, DownloadIcon, RefreshIcon, ShareIcon } from "../icons";
import { AttemptsTimeline } from "./AttemptsTimeline";
import { CheckList } from "./CheckList";

interface Props {
  result: GenerateResponse;
  clientTotalS: number;
  onAgain: () => void;
}

/** Everything under the picture: time, level, checks, the cascade's tries, and actions. */
export function ResultDetails({ result, clientTotalS, onAgain }: Props) {
  const tries = result.attempts.length;
  return (
    <section aria-label="Result details" className="mt-4 grid animate-fade-up gap-3">
      <div className="rounded-2xl glass p-4">
        <div className="flex items-end justify-between gap-3">
          <div>
            <div className="text-xs tracking-wider text-mist uppercase">Generated in</div>
            <div className="text-4xl font-semibold tabular-nums">
              {result.timing.total_s.toFixed(2)}
              <span className="text-xl text-mist"> s</span>
            </div>
            <div className="text-xs text-mist">
              on the GPU · {clientTotalS.toFixed(2)} s including network
            </div>
          </div>
          <span
            className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium whitespace-nowrap ${
              result.passed ? "bg-ok/15 text-ok" : "bg-warn/15 text-warn"
            }`}
          >
            {result.passed ? (
              <CheckIcon className="h-3.5 w-3.5" />
            ) : (
              <CrossIcon className="h-3.5 w-3.5" />
            )}
            {result.passed ? "Passed check" : "Best effort"}
          </span>
        </div>
        <div className="mt-3 flex flex-wrap gap-2 text-xs">
          <Chip>
            Level {result.level_used + 1} of {result.levels_total}
          </Chip>
          <Chip>{result.width}px</Chip>
          <Chip>
            {tries} {tries === 1 ? "try" : "tries"}
          </Chip>
          <Chip>{MODES[result.mode].label}</Chip>
          {result.polish.applied && <Chip>Polished: {result.polish.steps.join(", ")}</Chip>}
        </div>
        {!result.passed && (
          <p className="mt-3 text-xs text-warn/90">
            No try passed every check within this mode&apos;s time budget, so this is the best one.
            Quality mode tries harder.
          </p>
        )}
      </div>

      <CheckList checks={result.checks} />
      <AttemptsTimeline attempts={result.attempts} routerStart={result.router.start_level} />
      <Actions result={result} onAgain={onAgain} />

      <p className="px-1 text-[11px] text-mist/80">
        {result.model} · {result.gpu}
        {result.mock && " · mock data, not a real picture"}
      </p>
    </section>
  );
}

function Chip({ children }: { children: ReactNode }) {
  return <span className="rounded-full bg-white/8 px-2.5 py-1 text-white/85">{children}</span>;
}

function Actions({ result, onAgain }: { result: GenerateResponse; onAgain: () => void }) {
  const canShare = useCanShare();
  const [copied, setCopied] = useState(false);
  const baseName = `p3-${result.id}`;

  async function share() {
    try {
      const file = await dataUrlToFile(result.image, baseName);
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], text: result.prompt });
      } else {
        await navigator.share({ text: result.prompt });
      }
    } catch {
      // The user closed the share sheet: nothing to do.
    }
  }

  async function copyPrompt() {
    try {
      await navigator.clipboard.writeText(result.prompt);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard blocked (e.g. not HTTPS): ignore.
    }
  }

  const btn =
    "inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-white/8 px-3 py-2.5 text-sm hover:bg-white/12";
  return (
    <div className="flex gap-2">
      <button type="button" className={btn} onClick={() => downloadDataUrl(result.image, baseName)}>
        <DownloadIcon className="h-4 w-4" /> Save
      </button>
      {canShare && (
        <button type="button" className={btn} onClick={share}>
          <ShareIcon className="h-4 w-4" /> Share
        </button>
      )}
      <button type="button" className={btn} onClick={copyPrompt}>
        <CopyIcon className="h-4 w-4" /> {copied ? "Copied" : "Prompt"}
      </button>
      <button type="button" className={btn} onClick={onAgain}>
        <RefreshIcon className="h-4 w-4" /> Again
      </button>
    </div>
  );
}
