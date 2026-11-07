import type { Metadata } from "next";
import { CASCADE_RESULTS, MEASURED_HOW, SETUPS, baseline, headline } from "@/data/results";

export const metadata: Metadata = { title: "How it works" };

const STEPS = [
  {
    title: "Start cheap",
    text: "Every prompt starts at the cheapest level (768px). We also trained a router to guess the right level from the prompt; it didn't beat simply starting cheap, so the app doesn't use it.",
  },
  {
    title: "Draw",
    text: "An optimized SANA-Sprint model draws the picture in 2 steps on one T4 GPU.",
  },
  {
    title: "Check",
    text: "Visual check (blur, exposure, glitches) and prompt check (objects, counts, colours, left/right).",
  },
  {
    title: "Retry or send",
    text: "If it fails, try again at the next level with a new seed. If it passes, polish, shrink to WebP, and send.",
  },
];

export default function HowItWorksPage() {
  const b = baseline();
  const h = headline();
  const speedup = b.timeS / h.timeS;
  const memSaved = 1 - h.peakGb / b.peakGb;
  const smaller = b.sizeMb / h.sizeMb;

  return (
    <div className="grid animate-fade-up gap-6 pt-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
          Same quality, <span className="text-gradient">a fraction of the cost.</span>
        </h1>
        <p className="mt-2 text-sm text-mist">
          Compared with the original model, our {h.name.toLowerCase()} setup on the same GPU:
        </p>
      </header>

      <section className="grid grid-cols-3 gap-2">
        <Stat value={`${speedup.toFixed(1)}×`} label="faster" />
        <Stat value={`${Math.round(memSaved * 100)}%`} label="less GPU memory" />
        <Stat value={`${smaller.toFixed(1)}×`} label="smaller model" />
      </section>

      <section className="rounded-2xl glass p-4">
        <h2 className="text-sm font-medium">How a picture is made</h2>
        <ol className="mt-3 grid gap-3">
          {STEPS.map((s, i) => (
            <li key={s.title} className="flex gap-3">
              <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-brand text-xs font-semibold text-white">
                {i + 1}
              </span>
              <div>
                <div className="text-sm font-medium">{s.title}</div>
                <p className="text-sm text-mist">{s.text}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      <section className="overflow-hidden rounded-2xl glass">
        <h2 className="px-4 pt-4 text-sm font-medium">Measured results</h2>
        <div className="overflow-x-auto">
          <table className="mt-3 w-full min-w-[34rem] text-left text-xs tabular-nums">
            <thead className="text-mist">
              <tr className="border-b border-white/10">
                <th className="px-4 py-2 font-normal">Setup</th>
                <th className="px-2 py-2 font-normal whitespace-nowrap">Time</th>
                <th className="px-2 py-2 font-normal whitespace-nowrap">GPU mem</th>
                <th className="px-2 py-2 font-normal whitespace-nowrap">Size</th>
                <th className="px-2 py-2 font-normal whitespace-nowrap">CLIP ↑</th>
                <th className="px-2 py-2 font-normal whitespace-nowrap">FID ↓</th>
                <th className="px-4 py-2 font-normal">KID ↓</th>
              </tr>
            </thead>
            <tbody>
              {SETUPS.map((s) => (
                <tr
                  key={s.id}
                  className={`border-b border-white/5 last:border-0 ${s.id === h.id ? "bg-white/5" : ""}`}
                >
                  <td className="px-4 py-2">
                    <div className="font-medium text-white">
                      {s.id} · {s.name}
                    </div>
                    <div className="text-mist">{s.what}</div>
                  </td>
                  <td className="px-2 py-2 whitespace-nowrap">{s.timeS.toFixed(2)} s</td>
                  <td className="px-2 py-2 whitespace-nowrap">{s.peakGb.toFixed(2)} GB</td>
                  <td className="px-2 py-2 whitespace-nowrap">{(s.sizeMb / 1000).toFixed(2)} GB</td>
                  <td className="px-2 py-2 whitespace-nowrap">{s.clip.toFixed(2)}</td>
                  <td className="px-2 py-2 whitespace-nowrap">{s.fid.toFixed(1)}</td>
                  <td className="px-4 py-2">{s.kid1000.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="px-4 py-3 text-[11px] text-mist">{MEASURED_HOW}</p>
      </section>

      <section className="rounded-2xl glass p-4">
        <h2 className="text-sm font-medium">Does the retry system help?</h2>
        {CASCADE_RESULTS ? (
          <p className="mt-2 text-sm text-mist">{CASCADE_RESULTS.note}</p>
        ) : (
          <p className="mt-2 text-sm text-mist">
            Results from our held-out test (official GenEval-style prompts and COCO captions) are
            coming soon.
          </p>
        )}
      </section>

      <section className="rounded-2xl glass p-4">
        <h2 className="text-sm font-medium">Honest limits</h2>
        <ul className="mt-2 grid list-disc gap-1 pl-5 text-sm text-mist">
          <li>Cloud-assisted: pictures are made on a GPU server, not on the phone itself.</li>
          <li>
            Our prompt check is &ldquo;GenEval-style&rdquo;, built from the same rules, not the
            official GenEval benchmark.
          </li>
          <li>
            Exact counting is the weakest check: on real photos it got exact counts right about half
            the time.
          </li>
        </ul>
      </section>
    </div>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div className="rounded-2xl glass p-3 text-center">
      <div className="text-gradient text-2xl font-semibold tabular-nums">{value}</div>
      <div className="text-[11px] leading-tight text-mist">{label}</div>
    </div>
  );
}
