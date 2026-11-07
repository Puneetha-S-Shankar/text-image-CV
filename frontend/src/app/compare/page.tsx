import type { Metadata } from "next";
import { COMPARE_PAIRS } from "@/data/compare";
import { CASCADE_RESULTS, MEASURED_HOW, SETUPS, baseline, headline } from "@/data/results";
import { MODES } from "@/lib/config";
import type { Mode } from "@/lib/types";

export const metadata: Metadata = { title: "Compare" };

export default function ComparePage() {
  const original = baseline();
  const p3 = headline();
  const speedup = original.timeS / p3.timeS;
  const memorySaved = ((original.peakGb - p3.peakGb) / original.peakGb) * 100;
  const modelSizeReduction = original.sizeMb / p3.sizeMb;

  return (
    <div className="grid min-w-0 animate-fade-up grid-cols-[minmax(0,1fr)] gap-5 pt-7 sm:gap-6 sm:pt-10">
      <header>
        <p className="text-[10px] font-semibold tracking-[0.2em] text-accent-1 uppercase">
          Measured, not imagined
        </p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-espresso sm:text-4xl">
          Less compute. More creativity.
        </h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-mist">
          A measured comparison of the original model and P3’s low-memory setup on the same GPU and
          benchmark prompts.
        </p>
      </header>

      <section aria-label="Benchmark highlights" className="grid gap-3 sm:grid-cols-3">
        <SummaryCard
          value={`${speedup.toFixed(1)}×`}
          label="faster generation"
          detail={`${original.timeS.toFixed(2)} s → ${p3.timeS.toFixed(2)} s per image`}
        />
        <SummaryCard
          value={`${Math.round(memorySaved)}%`}
          label="less peak GPU memory"
          detail={`${original.peakGb.toFixed(2)} GB → ${p3.peakGb.toFixed(2)} GB`}
        />
        <SummaryCard
          value={`${modelSizeReduction.toFixed(1)}×`}
          label="smaller GPU-resident weights"
          detail={`${(original.sizeMb / 1000).toFixed(2)} GB → ${(p3.sizeMb / 1000).toFixed(2)} GB`}
        />
      </section>

      <section aria-label="Benchmark measurements" className="grid gap-3 md:grid-cols-2">
        <MetricComparison
          title="Time per picture"
          description="Average GPU generation time after warm-up. Lower is faster."
          unit="s"
          original={original.timeS}
          p3={p3.timeS}
          originalId={original.id}
          p3Id={p3.id}
        />
        <MetricComparison
          title="Peak GPU memory"
          description="Maximum GPU memory used during generation. Lower leaves more room for other work."
          unit="GB"
          original={original.peakGb}
          p3={p3.peakGb}
          originalId={original.id}
          p3Id={p3.id}
        />
      </section>

      <p className="text-xs leading-5 text-mist">
        {original.name}: {original.what}. P3 ({p3.id}): {p3.what}. Both measured on a Tesla T4 with
        500 benchmark prompts. These are benchmark results, not a comparison of a live generation
        with a stored dataset image.
      </p>

      <SetupTable />
      <CascadeScorecard />
      <ModePolicies />

      <section className="grid gap-4 rounded-[28px] border border-ink-700 bg-ink-900 p-4 shadow-card-soft sm:p-5">
        <div className="max-w-2xl">
          <p className="text-[10px] font-semibold tracking-[0.16em] text-accent-1 uppercase">
            How P3 works
          </p>
          <h2 className="mt-1 text-lg font-semibold text-espresso">
            Spend extra compute only when needed
          </h2>
          <p className="mt-1 text-sm leading-6 text-mist">
            A prompt becomes an image, gets checked, and only moves to another generation attempt
            when the selected mode allows it and the quality check calls for one.
          </p>
        </div>
        <ol className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          <FlowStep number="01" title="Prompt" detail="Describe the image you want." />
          <FlowStep
            number="02"
            title="Choose a starting level"
            detail="Your selected mode sets the starting generation level. The trained router is not active in the current mode configuration."
          />
          <FlowStep
            number="03"
            title="Generate"
            detail="The model creates a new image from patterns learned during training."
          />
          <FlowStep
            number="04"
            title="Quality gate"
            detail="Checks general image quality and prompt details such as requested objects, colors, counts, or positions."
          />
          <FlowStep
            number="05"
            title="Selective retry"
            detail="If needed, retry at the next level within the selected mode and generation budget."
          />
          <FlowStep
            number="06"
            title="Final image"
            detail="Return the passing result—or the best attempt available when the budget is used."
          />
        </ol>
      </section>

      <section className="grid gap-4 rounded-[28px] border border-ink-700 bg-ink-900 p-4 shadow-card-soft sm:p-5">
        <div>
          <p className="text-[10px] font-semibold tracking-[0.16em] text-accent-1 uppercase">
            Cascade comparison
          </p>
          <h2 className="mt-1 text-lg font-semibold text-espresso">Before and after refinement</h2>
        </div>
        <div className="rounded-2xl border border-dashed border-ink-700 bg-ink-950/70 px-4 py-6 text-center">
          <span
            aria-hidden="true"
            className="mx-auto grid h-10 w-10 place-items-center rounded-full bg-ink-800 text-accent-1"
          >
            ✦
          </span>
          <h3 className="mt-3 text-sm font-semibold text-espresso">Real image pairs coming soon</h3>
          <p className="mx-auto mt-1 max-w-lg text-xs leading-5 text-mist">
            The current API returns the final image and attempt checks, not a separate image for
            every attempt. We’ll show a true initial-and-refined pair when actual comparison images
            are available.
          </p>
        </div>
      </section>

      {COMPARE_PAIRS.length > 0 && (
        <section className="grid gap-4 rounded-[28px] border border-ink-700 bg-ink-900 p-4 shadow-card-soft sm:p-5">
          <div>
            <p className="text-[10px] font-semibold tracking-[0.16em] text-accent-1 uppercase">
              Same-prompt examples
            </p>
            <h2 className="mt-1 text-lg font-semibold text-espresso">Original model vs P3</h2>
            <p className="mt-1 text-xs leading-5 text-mist">
              These benchmark examples are separate from the live cascade’s initial and refined
              attempts.
            </p>
          </div>
          {COMPARE_PAIRS.map((pair) => (
            <div key={pair.prompt} className="rounded-2xl border border-ink-700 bg-ink-950/60 p-3">
              <p className="text-sm text-espresso">&ldquo;{pair.prompt}&rdquo;</p>
              <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Figure
                  src={pair.original}
                  label={`Original · ${pair.originalTimeS.toFixed(1)} s`}
                />
                <Figure src={pair.ours} label={`P3 · ${pair.oursTimeS.toFixed(1)} s`} />
              </div>
              {pair.note && <p className="mt-2 text-xs text-mist">{pair.note}</p>}
            </div>
          ))}
        </section>
      )}

      <section className="rounded-[28px] glass p-4 sm:p-5">
        <h2 className="text-sm font-semibold text-espresso">What happens with your prompt?</h2>
        <p className="mt-2 text-sm leading-6 text-mist">
          The model does not look up an exact matching picture. It creates a new image from patterns
          learned during training, so new or unusual prompts can still be submitted, though results
          may vary. The quality gate checks the generated image against your prompt and general
          image quality—not against a reference image from a dataset.
        </p>
      </section>
    </div>
  );
}

function SummaryCard({ value, label, detail }: { value: string; label: string; detail: string }) {
  return (
    <article className="flex items-center gap-4 rounded-[26px] border border-ink-700 bg-ink-900 p-4 shadow-card-soft sm:p-5">
      <span className="text-4xl leading-none font-semibold tracking-tight text-accent-strong tabular-nums sm:text-5xl">
        {value}
      </span>
      <span className="min-w-0">
        <span className="block text-sm font-semibold text-espresso">{label}</span>
        <span className="mt-1 block text-xs text-mist tabular-nums">{detail}</span>
      </span>
    </article>
  );
}

function SetupTable() {
  return (
    <section className="overflow-hidden rounded-[28px] border border-ink-700 bg-ink-900 shadow-card-soft">
      <div className="p-4 sm:p-5">
        <p className="text-[10px] font-semibold tracking-[0.16em] text-accent-1 uppercase">
          Quality vs computational cost
        </p>
        <h2 className="mt-1 text-lg font-semibold text-espresso">Optimization ladder</h2>
        <p className="mt-1 text-xs leading-5 text-mist">
          The M3 setup cuts GPU weight size and memory while preserving 1024px output. CLIP is
          slightly lower than the baseline, while FID and KID are lower (better) in this evaluation.
        </p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[790px] border-collapse text-left text-xs">
          <caption className="sr-only">
            Model setup quality and resource measurements across the optimization ladder
          </caption>
          <thead>
            <tr className="border-y border-ink-700 bg-ink-950/70 text-mist">
              <th scope="col" className="px-4 py-3 font-medium">
                Setup
              </th>
              <th scope="col" className="px-3 py-3 font-medium whitespace-nowrap">
                Output
              </th>
              <th scope="col" className="px-3 py-3 font-medium whitespace-nowrap">
                CLIP ↑
              </th>
              <th scope="col" className="px-3 py-3 font-medium whitespace-nowrap">
                FID ↓
              </th>
              <th scope="col" className="px-3 py-3 font-medium whitespace-nowrap">
                KID ×1000 ↓
              </th>
              <th scope="col" className="px-3 py-3 font-medium whitespace-nowrap">
                GPU time
              </th>
              <th scope="col" className="px-3 py-3 font-medium whitespace-nowrap">
                Peak GPU
              </th>
              <th scope="col" className="px-4 py-3 font-medium whitespace-nowrap">
                GPU weights
              </th>
            </tr>
          </thead>
          <tbody>
            {SETUPS.map((setup) => (
              <tr
                key={setup.id}
                className={`border-b border-ink-700 last:border-0 ${
                  setup.id === "M3" ? "bg-accent-3/10" : ""
                }`}
              >
                <th scope="row" className="px-4 py-3 text-left font-medium text-espresso">
                  <span className="block">
                    {setup.id} · {setup.name}
                  </span>
                  <span className="mt-0.5 block max-w-xs leading-5 font-normal text-mist">
                    {setup.what}
                  </span>
                </th>
                <td className="px-3 py-3 whitespace-nowrap text-espresso tabular-nums">
                  {setup.resolution}px · {setup.steps} steps
                </td>
                <td className="px-3 py-3 text-espresso tabular-nums">{setup.clip.toFixed(2)}</td>
                <td className="px-3 py-3 text-espresso tabular-nums">{setup.fid.toFixed(2)}</td>
                <td className="px-3 py-3 text-espresso tabular-nums">{setup.kid1000.toFixed(2)}</td>
                <td className="px-3 py-3 text-espresso tabular-nums">{setup.timeS.toFixed(2)} s</td>
                <td className="px-3 py-3 text-espresso tabular-nums">
                  {setup.peakGb.toFixed(2)} GB
                </td>
                <td className="px-4 py-3 text-espresso tabular-nums">{setup.sizeMb} MB</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="grid gap-1 border-t border-ink-700 px-4 py-3 text-[11px] leading-5 text-mist sm:px-5">
        <p>
          {MEASURED_HOW}. CLIP is prompt-image similarity (higher is better); FID and KID compare
          distributions (lower is better), not an individual generation against a reference.
        </p>
        <p>
          GPU weight size excludes M3’s 1.18 GB CPU-resident word table. These are server-GPU
          measurements, not measurements on a mobile phone; on-device latency, memory, and power
          have not been established.
        </p>
      </div>
    </section>
  );
}

function CascadeScorecard() {
  const rows = [
    {
      label: "Average latency · checks included",
      ours: `${CASCADE_RESULTS.ours.avgTimeS.toFixed(2)} s`,
      original: `${CASCADE_RESULTS.original.avgTimeS.toFixed(2)} s`,
    },
    {
      label: "P90 latency",
      ours: `${CASCADE_RESULTS.ours.p90TimeS.toFixed(2)} s`,
      original: `${CASCADE_RESULTS.original.p90TimeS.toFixed(2)} s`,
    },
    {
      label: "GenEval-style semantic accuracy",
      ours: `${CASCADE_RESULTS.ours.semanticAccuracy.toFixed(1)}%`,
      original: `${CASCADE_RESULTS.original.semanticAccuracy.toFixed(1)}%`,
    },
    {
      label: "CLIP ViT-L/14 ×100",
      ours: CASCADE_RESULTS.ours.clip.toFixed(2),
      original: CASCADE_RESULTS.original.clip.toFixed(2),
    },
    {
      label: "Visually clean",
      ours: `${CASCADE_RESULTS.ours.visuallyClean.toFixed(1)}%`,
      original: `${CASCADE_RESULTS.original.visuallyClean.toFixed(1)}%`,
    },
  ];

  return (
    <section className="rounded-[28px] border border-ink-700 bg-ink-900 p-4 shadow-card-soft sm:p-5">
      <div>
        <p className="text-[10px] font-semibold tracking-[0.16em] text-accent-1 uppercase">
          Held-out cascade evaluation
        </p>
        <h2 className="mt-1 text-lg font-semibold text-espresso">Prompt consistency and quality</h2>
        <p className="mt-1 text-xs leading-5 text-mist">
          Independent evaluation on {CASCADE_RESULTS.promptCount} held-out prompts, scored by
          Mask2Former and CLIP ViT-L/14. “GenEval-style” is our own evaluation, not the official
          GenEval benchmark.
        </p>
      </div>
      <div className="mt-4 overflow-x-auto">
        <table className="w-full min-w-[440px] text-left text-xs">
          <caption className="sr-only">
            P3 cascade and original teacher held-out evaluation results
          </caption>
          <thead>
            <tr className="border-b border-ink-700 text-mist">
              <th scope="col" className="py-2 pr-3 font-medium">
                Measure
              </th>
              <th scope="col" className="px-3 py-2 font-medium">
                P3 cascade
              </th>
              <th scope="col" className="px-3 py-2 font-medium">
                Original teacher
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.label} className="border-b border-ink-700 last:border-0">
                <th scope="row" className="py-2.5 pr-3 font-medium text-espresso">
                  {row.label}
                </th>
                <td className="px-3 py-2.5 text-espresso tabular-nums">{row.ours}</td>
                <td className="px-3 py-2.5 text-mist tabular-nums">{row.original}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-3 text-[11px] leading-5 text-mist">
        The router was evaluated but is not used in the active app policy: it selected the correct
        starting level 46.5% of the time versus a 58.0% majority baseline. Current modes use fixed
        starting levels, then let checks trigger retries.
      </p>
    </section>
  );
}

function ModePolicies() {
  const modes: Mode[] = ["fast", "balanced", "quality"];
  return (
    <section className="rounded-[28px] glass p-4 sm:p-5">
      <h2 className="text-sm font-semibold text-espresso">Budget-aware generation and fallback</h2>
      <p className="mt-1 text-xs leading-5 text-mist">
        Modes select the starting resolution and retry budget. Every attempt is checked; if no
        attempt passes before the mode stops, the API returns its best available result.
      </p>
      <ul className="mt-3 grid gap-2 sm:grid-cols-3">
        {modes.map((mode) => (
          <li key={mode} className="rounded-2xl border border-ink-700 bg-ink-950/70 p-3">
            <span className="text-sm font-semibold text-espresso">{MODES[mode].label}</span>
            <span className="mt-1 block text-xs leading-5 text-mist">{MODES[mode].blurb}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

function MetricComparison({
  title,
  description,
  unit,
  original,
  p3,
  originalId,
  p3Id,
}: {
  title: string;
  description: string;
  unit: string;
  original: number;
  p3: number;
  originalId: string;
  p3Id: string;
}) {
  const max = Math.max(original, p3);
  const rows = [
    { label: `Original · ${originalId}`, value: original, variant: "original" },
    { label: `P3 · ${p3Id}`, value: p3, variant: "p3" },
  ];

  return (
    <figure className="rounded-[26px] border border-ink-700 bg-ink-900 p-4 shadow-card-soft sm:p-5">
      <figcaption>
        <h2 className="text-sm font-semibold text-espresso">{title}</h2>
        <p className="mt-1 min-h-10 text-xs leading-5 text-mist">{description}</p>
      </figcaption>
      <div className="mt-4 grid gap-4">
        {rows.map(({ label, value, variant }) => (
          <div key={label}>
            <div className="mb-1.5 flex items-center justify-between gap-3 text-xs">
              <span className="font-medium text-espresso">{label}</span>
              <span className="shrink-0 font-semibold text-espresso tabular-nums">
                {value.toFixed(2)} {unit}
              </span>
            </div>
            <div
              role="meter"
              aria-label={`${label}: ${value.toFixed(2)} ${unit}`}
              aria-valuemin={0}
              aria-valuemax={max}
              aria-valuenow={value}
              className="h-3 overflow-hidden rounded-full bg-ink-800"
            >
              <div
                aria-hidden="true"
                className={`h-full rounded-full ${variant === "p3" ? "bg-brand" : "bg-accent-3"}`}
                style={{ width: `${(value / max) * 100}%` }}
              />
            </div>
          </div>
        ))}
      </div>
      <p className="mt-4 border-t border-ink-700 pt-3 text-[11px] leading-5 text-mist">
        Same scale within this metric; shorter bars mean lower resource use.
      </p>
    </figure>
  );
}

function FlowStep({ number, title, detail }: { number: string; title: string; detail: string }) {
  return (
    <li className="flex gap-3 rounded-2xl border border-ink-700 bg-ink-950/70 p-3">
      <span className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-ink-800 text-[10px] font-semibold text-accent-strong tabular-nums">
        {number}
      </span>
      <span>
        <span className="block text-sm font-semibold text-espresso">{title}</span>
        <span className="mt-1 block text-xs leading-5 text-mist">{detail}</span>
      </span>
    </li>
  );
}

function Figure({ src, label }: { src: string; label: string }) {
  return (
    <figure>
      <img
        src={src}
        alt={label}
        className="aspect-square w-full rounded-2xl border border-ink-700 object-cover"
      />
      <figcaption className="mt-2 text-center text-[11px] text-mist">{label}</figcaption>
    </figure>
  );
}
