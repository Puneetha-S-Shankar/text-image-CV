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
    <div className="rounded-[26px] border border-ink-700 bg-ink-900 p-4 shadow-card-soft">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-espresso">Quality and prompt checks</h2>
        {checks.clip_score != null && (
          <span className="text-[11px] text-mist">
            Prompt match · CLIP ×100{" "}
            <span className="font-semibold text-espresso tabular-nums">{checks.clip_score}</span>
          </span>
        )}
      </div>

      <p className="mb-3 text-xs leading-5 text-mist">
        Classical computer vision checks appearance and artifacts; CLIP and prompt-specific checks
        assess how well the image matches the request.
      </p>

      <ul className="grid gap-2.5">
        <Row
          ok={checks.visual.ok}
          kind="Visual quality · CV"
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
        <p className="mt-3 text-xs leading-5 text-mist">
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
      <span className="min-w-0 flex-1 text-espresso">
        <span className="mr-2 text-xs text-mist">{kind}</span> {label}
        {detail && <span className="block text-xs text-bad/90">{detail}</span>}
      </span>
    </li>
  );
}
