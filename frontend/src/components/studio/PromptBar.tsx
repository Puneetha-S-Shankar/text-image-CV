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
      className="flex items-end gap-2 rounded-2xl glass p-2 transition focus-within:border-white/25"
    >
      <label htmlFor="prompt" className="sr-only">
        Describe the picture you want
      </label>
      <div className="flex-1">
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
          className="block w-full resize-none bg-transparent px-2 py-1.5 text-base outline-none placeholder:text-mist/60"
        />
        <span className="px-2 text-[11px] text-mist/70 tabular-nums">
          {value.length}/{PROMPT_MAX_CHARS}
        </span>
      </div>
      {busy ? (
        <button
          type="button"
          onClick={onCancel}
          aria-label="Stop"
          className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-white/10 text-white hover:bg-white/15"
        >
          <StopIcon className="h-5 w-5" />
        </button>
      ) : (
        <button
          type="submit"
          disabled={empty}
          aria-label="Generate"
          className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-brand text-white shadow-lg shadow-fuchsia-500/25 transition active:scale-95 disabled:opacity-40 disabled:shadow-none"
        >
          <ArrowUpIcon className="h-5 w-5" />
        </button>
      )}
    </form>
  );
}
