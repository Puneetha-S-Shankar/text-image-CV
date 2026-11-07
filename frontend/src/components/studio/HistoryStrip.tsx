import type { HistoryItem } from "./types";

/** Earlier pictures from this visit (kept in memory only, gone on reload). */
export function HistoryStrip({
  items,
  activeId,
  onSelect,
}: {
  items: HistoryItem[];
  activeId: string | null;
  onSelect: (item: HistoryItem) => void;
}) {
  return (
    <section
      aria-label="Recent generations from this session"
      className="rounded-[26px] border border-ink-700 bg-ink-900 p-3 shadow-card-soft"
    >
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-[10px] font-semibold tracking-[0.16em] text-accent-1 uppercase">
          Recent creations
        </h2>
        <span className="text-[11px] text-mist">This visit · {items.length}</span>
      </div>
      <ul className="-mx-1 flex snap-x gap-2 overflow-x-auto px-1 pb-1">
        {items.map((item) => (
          <li key={item.result.id} className="shrink-0 snap-start">
            <button
              type="button"
              onClick={() => onSelect(item)}
              aria-label={`View ${item.result.mode} generation: ${item.result.prompt}. ${item.result.passed ? "Passed quality checks." : "Best effort result."}`}
              aria-current={item.result.id === activeId ? "true" : undefined}
              className={`flex min-h-[92px] w-[min(82vw,260px)] items-center gap-3 rounded-2xl border p-2 text-left transition ${
                item.result.id === activeId
                  ? "border-accent-1/55 bg-ink-800"
                  : "border-ink-700 bg-ink-950/70 hover:bg-ink-800/70"
              }`}
            >
              <img
                src={item.result.image}
                alt=""
                className="h-[72px] w-[72px] shrink-0 rounded-xl bg-ink-800 object-cover"
              />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-xs font-medium text-espresso">
                  {item.result.prompt}
                </span>
                <span className="mt-1 block text-[10px] text-mist">
                  {item.result.mode} · {item.result.timing.total_s.toFixed(2)} s
                </span>
                <span
                  className={`mt-1 block text-[10px] font-medium ${
                    item.result.passed ? "text-ok" : "text-warn"
                  }`}
                >
                  {item.result.passed ? "Quality passed" : "Best effort"}
                </span>
              </span>
            </button>
          </li>
        ))}
      </ul>
      <p className="mt-2 text-[10px] leading-4 text-mist">
        Stored in this page session only; refreshing clears this gallery.
      </p>
    </section>
  );
}
