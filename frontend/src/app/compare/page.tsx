import type { Metadata } from "next";
import { COMPARE_PAIRS } from "@/data/compare";
import { baseline, headline } from "@/data/results";

export const metadata: Metadata = { title: "Compare" };

export default function ComparePage() {
  const b = baseline();
  const h = headline();
  const max = Math.max(b.timeS, h.timeS);

  return (
    <div className="grid animate-fade-up gap-6 pt-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
          Original vs <span className="text-gradient">ours</span>
        </h1>
        <p className="mt-2 text-sm text-mist">Same GPU, same prompts, measured the same way.</p>
      </header>

      <section className="grid gap-4 rounded-2xl glass p-4">
        <h2 className="text-sm font-medium">Time per picture</h2>
        <Bar label={`Original (${b.id})`} value={b.timeS} max={max} muted />
        <Bar label={`Ours (${h.id})`} value={h.timeS} max={max} />
        <h2 className="mt-2 text-sm font-medium">Peak GPU memory</h2>
        <Bar label={`Original (${b.id})`} value={b.peakGb} max={b.peakGb} unit="GB" muted />
        <Bar label={`Ours (${h.id})`} value={h.peakGb} max={b.peakGb} unit="GB" />
      </section>

      {COMPARE_PAIRS.length === 0 ? (
        <section className="rounded-2xl glass p-4">
          <h2 className="text-sm font-medium">Side-by-side pictures</h2>
          <p className="mt-2 text-sm text-mist">
            Example pairs from our held-out test are coming soon.
          </p>
        </section>
      ) : (
        COMPARE_PAIRS.map((pair) => (
          <section key={pair.prompt} className="rounded-2xl glass p-3">
            <p className="px-1 text-sm">&ldquo;{pair.prompt}&rdquo;</p>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <Figure src={pair.original} label={`Original · ${pair.originalTimeS.toFixed(1)} s`} />
              <Figure src={pair.ours} label={`Ours · ${pair.oursTimeS.toFixed(1)} s`} />
            </div>
            {pair.note && <p className="mt-2 px-1 text-xs text-mist">{pair.note}</p>}
          </section>
        ))
      )}
    </div>
  );
}

function Bar({
  label,
  value,
  max,
  unit = "s",
  muted,
}: {
  label: string;
  value: number;
  max: number;
  unit?: string;
  muted?: boolean;
}) {
  return (
    <div>
      <div className="mb-1 flex justify-between text-xs">
        <span className={muted ? "text-mist" : "text-white"}>{label}</span>
        <span className="tabular-nums">
          {value.toFixed(2)} {unit}
        </span>
      </div>
      <div className="h-3 overflow-hidden rounded-full bg-white/5">
        <div
          className={`h-full rounded-full ${muted ? "bg-white/25" : "bg-brand"}`}
          style={{ width: `${Math.max(3, (value / max) * 100)}%` }}
        />
      </div>
    </div>
  );
}

function Figure({ src, label }: { src: string; label: string }) {
  return (
    <figure>
      <img src={src} alt={label} className="aspect-square w-full rounded-xl object-cover" />
      <figcaption className="mt-1 text-center text-[11px] text-mist">{label}</figcaption>
    </figure>
  );
}
