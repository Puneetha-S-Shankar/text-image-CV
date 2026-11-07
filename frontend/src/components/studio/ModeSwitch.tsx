import { MODES } from "@/lib/config";
import type { Mode } from "@/lib/types";

interface Props {
  value: Mode;
  onChange: (mode: Mode) => void;
  disabled?: boolean;
}

/** Fast / Balanced / Quality segmented control (an accessible radio group). */
export function ModeSwitch({ value, onChange, disabled }: Props) {
  const modes = Object.keys(MODES) as Mode[];
  return (
    <div className="mb-2">
      <div
        role="radiogroup"
        aria-label="Generation mode"
        className="grid grid-cols-3 gap-1.5 rounded-[22px] border border-ink-700 bg-ink-900 p-1.5"
      >
        {modes.map((m) => {
          const active = m === value;
          return (
            <button
              key={m}
              type="button"
              role="radio"
              aria-checked={active}
              disabled={disabled}
              onClick={() => onChange(m)}
              className={`min-h-11 rounded-2xl border px-2 py-2.5 text-left transition disabled:cursor-not-allowed disabled:opacity-50 ${
                active
                  ? "border-transparent bg-ink-800 text-espresso shadow-sm"
                  : "border-transparent bg-transparent text-mist hover:border-ink-700 hover:bg-ink-950 hover:text-espresso"
              }`}
            >
              <span className="block text-center text-sm font-semibold">{MODES[m].label}</span>
            </button>
          );
        })}
      </div>
      <p className="mt-2 px-1 text-xs leading-5 text-mist" aria-live="polite">
        {MODES[value].blurb}
      </p>
    </div>
  );
}
