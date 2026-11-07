import type { CheckKind, GenerateResponse } from "@/lib/types";
import { CheckIcon, CrossIcon } from "../icons";

const KIND_LABEL: Record<CheckKind, string> = {
  object: "Object",
  count: "Count",
  colour: "Colour",
  position: "Position",
};

/** "Does the picture match the prompt?" Only things the prompt actually asked for. */
export function CheckList({ checks }: { checks: GenerateResponse["checks"] }) {
  return (
    <div className="rounded-2xl glass p-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-medium">Quality check</h2>
        {checks.clip_score != null && (
          <span className="text-xs text-mist">
            Prompt match (CLIP) <span className="text-white tabular-nums">{checks.clip_score}</span>
          </span>
        )}
      </div>

      <ul className="mt-3 grid gap-2">
        <Row
          ok={checks.visual.ok}
          kind="Picture"
          label={
            checks.visual.ok ? "Sharp, well exposed, no glitches" : checks.visual.flags.join(", ")
          }
        />
        {checks.semantic.map((c, i) => (
          <Row
            key={`${c.kind}-${c.label}-${i}`}
            ok={c.ok}
            kind={KIND_LABEL[c.kind]}
            label={c.label}
            detail={c.detail}
          />
        ))}
      </ul>

      {checks.semantic.length === 0 && (
        <p className="mt-2 text-xs text-mist">
          This prompt has no counts, colours or positions to verify, so only the overall match and
          picture quality were checked.
        </p>
      )}
    </div>
  );
}

function Row({
  ok,
  kind,
  label,
  detail,
}: {
  ok: boolean;
  kind: string;
  label: string;
  detail?: string;
}) {
  return (
    <li className="flex items-start gap-3 text-sm">
      <span
        className={`mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full ${
          ok ? "bg-ok/15 text-ok" : "bg-bad/15 text-bad"
        }`}
      >
        {ok ? <CheckIcon className="h-3 w-3" /> : <CrossIcon className="h-3 w-3" />}
      </span>
      <span className="flex-1">
        <span className="mr-2 text-xs text-mist">{kind}</span>
        {label}
        {detail && <span className="block text-xs text-bad/90">{detail}</span>}
      </span>
    </li>
  );
}
