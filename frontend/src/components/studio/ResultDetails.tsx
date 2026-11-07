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
    <section aria-label="Result details" aria-live="polite" className="grid animate-fade-up gap-4">
      <div className="rounded-[28px] border border-ink-700 bg-ink-900 p-4 shadow-card sm:p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-[10px] font-semibold tracking-[0.2em] text-accent-1 uppercase">
              Your creation
            </div>
            <div className="mt-2 text-3xl font-semibold tracking-tight text-espresso tabular-nums">
              {result.timing.total_s.toFixed(2)}
              <span className="ml-1 text-xl text-mist">s</span>
            </div>
            <div className="mt-1 text-xs leading-5 text-mist">
              Server time · {clientTotalS.toFixed(2)} s total wait, including network
            </div>
          </div>
          <span
            className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] font-medium whitespace-nowrap ${
              result.passed ? "bg-ok/15 text-ok" : "bg-warn/15 text-warn"
            }`}
          >
            {result.passed ? (
              <CheckIcon className="h-3.5 w-3.5" />
            ) : (
              <CrossIcon className="h-3.5 w-3.5" />
            )}
            {result.passed ? "Passed" : "Best effort"}
          </span>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-2 text-xs text-espresso">
          <Chip>
            Level {result.level_used + 1} / {result.levels_total}
          </Chip>
          <Chip>
            {result.width} × {result.height}px
          </Chip>
          <Chip>
            {tries} {tries === 1 ? "try" : "tries"}
          </Chip>
          <Chip>{MODES[result.mode].label} mode</Chip>
        </div>

        <div className="mt-3 rounded-xl bg-ink-950/75 px-3 py-2">
          <p className="text-[11px] font-semibold text-espresso">Classical CV enhancement</p>
          {result.polish.applied ? (
            <p className="mt-1 text-xs leading-5 text-mist">
              Kept after re-check
              {result.polish.steps.length > 0 ? `: ${result.polish.steps.join(", ")}` : ""}.
            </p>
          ) : (
            <p className="mt-1 text-xs leading-5 text-mist">
              No correction was retained; the original image was kept.
            </p>
          )}
        </div>

        {!result.passed && (
          <p className="mt-3 rounded-xl bg-warn/10 px-3 py-2 text-xs leading-5 text-warn">
            No try passed every check within this mode&apos;s budget, so this is the strongest
            result available.
          </p>
        )}
      </div>

      <CheckList checks={result.checks} />
      <AttemptsTimeline attempts={result.attempts} routerStart={result.router.start_level} />
      <Actions result={result} onAgain={onAgain} />

      <details className="group rounded-[24px] border border-ink-700 bg-ink-900/80 p-4">
        <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 text-sm font-medium text-espresso marker:hidden">
          <span>Generation insights</span>
          <span className="text-xs text-accent-1 transition-transform group-open:rotate-180">
            Details ↓
          </span>
        </summary>
        <dl className="mt-3 grid grid-cols-2 gap-2 text-xs sm:grid-cols-3">
          <Metric label="Model generation" value={`${result.timing.generate_s.toFixed(2)} s`} />
          <Metric label="Quality checks" value={`${result.timing.check_s.toFixed(2)} s`} />
          <Metric label="Polish" value={`${result.timing.polish_s.toFixed(2)} s`} />
          <Metric label="Image encoding" value={`${result.timing.encode_s.toFixed(2)} s`} />
          <Metric label="Attempts" value={String(tries)} />
          <Metric label="Output size" value={`${result.width} × ${result.height}px`} />
          <Metric
            label="Selected level"
            value={`${result.level_used + 1} of ${result.levels_total}`}
          />
          <Metric label="GPU" value={result.gpu} />
        </dl>
        <p className="mt-3 text-[11px] leading-5 text-mist">
          Server timing is separate from the total wait measured in your browser. The image is
          generated on the cloud GPU, not on your phone.
        </p>
      </details>

      <p className="px-1 text-[11px] text-mist">
        {result.model} · {result.gpu}
        {result.mock && " · mock data, not a real picture"}
      </p>
    </section>
  );
}

function Chip({ children }: { children: ReactNode }) {
  return (
    <span className="rounded-full border border-ink-700 bg-ink-950 px-2.5 py-1.5 text-espresso">
      {children}
    </span>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-ink-700 bg-ink-950/75 p-3">
      <dt className="text-mist">{label}</dt>
      <dd className="mt-1 font-semibold text-espresso tabular-nums">{value}</dd>
    </div>
  );
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
    "inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-2xl border border-ink-700 bg-ink-900 px-3 py-2.5 text-sm font-medium text-espresso transition hover:border-accent-1/35 hover:bg-ink-800";
  return (
    <div className="flex flex-wrap gap-2">
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
