import type { HealthState } from "@/hooks/useHealth";

const STYLES: Record<HealthState["status"], { dot: string; text: string }> = {
  checking: { dot: "bg-mist", text: "Connecting…" },
  loading: { dot: "bg-warn", text: "Model loading…" },
  ready: { dot: "bg-ok", text: "Ready" },
  offline: { dot: "bg-bad", text: "Offline" },
};

export function StatusPill({ health }: { health: HealthState }) {
  const s = STYLES[health.status];
  const detail = health.status === "ready" ? (health.health.mock ? "mock" : health.health.gpu) : "";
  return (
    <span
      role="status"
      className="inline-flex shrink-0 items-center gap-2 rounded-full border border-ink-700 bg-ink-900 px-3 py-1.5 text-xs text-mist shadow-sm"
    >
      <span
        className={`h-2.5 w-2.5 rounded-full ${s.dot} ${health.status !== "ready" ? "animate-pulse-dot" : ""}`}
      />
      {s.text}
      {detail && <span className="text-espresso">· {detail}</span>}
    </span>
  );
}

/** A friendly explanation when the server isn't ready yet. Nothing is shown once it's ready. */
export function ServerBanner({ health }: { health: HealthState }) {
  if (health.status === "loading") {
    return (
      <p className="rounded-2xl border border-warn/25 bg-warn/10 px-3 py-2 text-sm leading-6 text-warn">
        The server just woke up and is loading the model. This takes a moment the first time.
      </p>
    );
  }
  if (health.status === "offline") {
    return (
      <p className="rounded-2xl border border-bad/25 bg-bad/10 px-3 py-2 text-sm leading-6 text-bad">
        Can&apos;t reach the server right now. It may be switched off. We&apos;ll keep trying.
      </p>
    );
  }
  return null;
}
