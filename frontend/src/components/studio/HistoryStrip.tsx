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
    <section aria-label="Earlier pictures" className="mt-4">
      <h2 className="mb-2 px-1 text-xs tracking-wider text-mist uppercase">This session</h2>
      <div className="-mx-4 flex snap-x gap-2 overflow-x-auto px-4 pb-1">
        {items.map((item) => (
          <button
            key={item.result.id}
            type="button"
            onClick={() => onSelect(item)}
            aria-label={item.result.prompt}
            className={`h-20 w-20 shrink-0 snap-start overflow-hidden rounded-xl border transition ${
              item.result.id === activeId
                ? "border-accent-2"
                : "border-white/10 opacity-80 hover:opacity-100"
            }`}
          >
            <img src={item.result.image} alt="" className="h-full w-full object-cover" />
          </button>
        ))}
      </div>
    </section>
  );
}
