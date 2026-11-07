import { PROMPT_INSPIRATION } from "@/lib/config";

export function PromptInspiration({ onSelect }: { onSelect: (prompt: string) => void }) {
  return (
    <details className="group rounded-[24px] border border-ink-700 bg-ink-900/80 p-4 shadow-card-soft">
      <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 text-sm font-medium text-espresso marker:hidden">
        <span>
          Need a starting point? <span className="font-normal text-mist">Explore prompt ideas</span>
        </span>
        <span
          aria-hidden="true"
          className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-ink-800 text-accent-1 transition-transform group-open:rotate-45"
        >
          +
        </span>
      </summary>
      <ul className="mt-3 grid gap-2 sm:grid-cols-2">
        {PROMPT_INSPIRATION.map(({ category, prompt }) => (
          <li key={category}>
            <button
              type="button"
              onClick={() => onSelect(prompt)}
              className="min-h-16 w-full rounded-2xl border border-ink-700 bg-ink-950/75 p-3 text-left transition hover:border-accent-1/40 hover:bg-ink-800 focus-visible:outline-offset-2"
            >
              <span className="block text-[10px] font-semibold tracking-[0.14em] text-accent-1 uppercase">
                {category}
              </span>
              <span className="mt-1 block text-xs leading-5 text-espresso">{prompt}</span>
            </button>
          </li>
        ))}
      </ul>
    </details>
  );
}
