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
      className="inline-flex shrink-0 items-center gap-2 rounded-full glass px-3 py-1 text-xs text-mist"
    >
      <span
        className={`h-2 w-2 rounded-full ${s.dot} ${health.status !== "ready" ? "animate-pulse-dot" : ""}`}
      />
      {s.text}
      {detail && <span className="text-white/80">· {detail}</span>}
    </span>
  );
}

/** A friendly explanation when the server isn't ready yet. Nothing is shown once it's ready. */
export function ServerBanner({ health }: { health: HealthState }) {
  if (health.status === "loading") {
    return (
      <p className="mt-3 rounded-xl border border-warn/30 bg-warn/10 px-3 py-2 text-sm text-warn">
        The server just woke up and is loading the model. This takes a moment the first time.
      </p>
    );
  }
  if (health.status === "offline") {
    return (
      <p className="mt-3 rounded-xl border border-bad/30 bg-bad/10 px-3 py-2 text-sm text-bad">
        Can&apos;t reach the server right now. It may be switched off. We&apos;ll keep trying.
      </p>
    );
  }
  return null;
}
