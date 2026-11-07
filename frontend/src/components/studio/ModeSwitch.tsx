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
        className="grid grid-cols-3 gap-1 rounded-2xl glass p-1"
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
              className={`rounded-xl px-3 py-2 text-sm font-medium transition disabled:opacity-50 ${
                active
                  ? "bg-brand text-white shadow-lg shadow-fuchsia-500/20"
                  : "text-mist hover:text-white"
              }`}
            >
              {MODES[m].label}
            </button>
          );
        })}
      </div>
      <p className="mt-1.5 px-1 text-xs text-mist">
        {MODES[value].blurb} <span className="text-white/70">{MODES[value].expected}</span>
      </p>
    </div>
  );
}
