import { PROMPT_MAX_CHARS } from "@/lib/config";
import { ArrowUpIcon, StopIcon } from "../icons";

interface Props {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  onCancel: () => void;
  busy: boolean;
}

/** Prompt input + Generate button. Enter generates, Shift+Enter adds a new line. */
export function PromptBar({ value, onChange, onSubmit, onCancel, busy }: Props) {
  const empty = value.trim().length === 0;
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (!busy && !empty) onSubmit();
      }}
      className="rounded-[26px] border border-ink-700 bg-ink-900 p-2.5 shadow-card-soft transition focus-within:border-accent-1/60"
    >
      <div className="flex items-end gap-2.5">
        <label htmlFor="prompt" className="sr-only">
          Describe the picture you want
        </label>
        <div className="flex-1 rounded-2xl bg-ink-950/70 px-2 py-1.5">
          <textarea
            id="prompt"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                e.preventDefault();
                if (!busy && !empty) onSubmit();
              }
            }}
            rows={2}
            maxLength={PROMPT_MAX_CHARS}
            enterKeyHint="go"
            placeholder="A red car to the left of a blue bus…"
            // text-base (16px) stops iPhones from zooming in when the box is tapped.
            className="block w-full resize-none bg-transparent px-1.5 py-1.5 text-base text-espresso outline-none placeholder:text-mist/80"
          />
          <div className="mt-1 flex items-center justify-between gap-2 px-1.5 pb-0.5">
            <span className="text-[11px] text-mist/75 tabular-nums">
              {value.length}/{PROMPT_MAX_CHARS}
            </span>
            {value.length > 0 && (
              <button
                type="button"
                onClick={() => onChange("")}
                className="min-h-8 px-2 text-[11px] font-medium text-mist transition hover:text-espresso"
              >
                Clear
              </button>
            )}
          </div>
        </div>
        {busy ? (
          <button
            type="button"
            onClick={onCancel}
            aria-label="Stop"
            className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl border border-ink-700 bg-ink-800 text-espresso transition hover:bg-ink-700"
          >
            <StopIcon className="h-5 w-5" />
          </button>
        ) : (
          <button
            type="submit"
            disabled={empty}
            aria-label="Generate"
            className="inline-flex min-h-12 shrink-0 items-center justify-center gap-2 rounded-2xl bg-brand px-4 py-3 text-sm font-semibold text-ink-900 shadow-action transition active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-45 disabled:shadow-none"
          >
            <ArrowUpIcon className="h-4 w-4" />
            <span className="hidden sm:inline">Generate</span>
          </button>
        )}
      </div>
    </form>
  );
}
