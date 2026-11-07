"use client";

import { useEffect, useState } from "react";
import { getHealth } from "@/lib/api";
import type { HealthResponse } from "@/lib/types";

export type HealthState =
  | { status: "checking" }
  | { status: "loading"; health: HealthResponse }
  | { status: "ready"; health: HealthResponse }
  | { status: "offline" };

/**
 * Polls GET /api/health: every 3 s while the model loads, every 30 s once ready, and every 5 s
 * while the server can't be reached. Drives the status pill and the "server is starting" screen.
 */
export function useHealth(): HealthState {
  const [state, setState] = useState<HealthState>({ status: "checking" });

  useEffect(() => {
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout> | undefined;

    async function poll() {
      try {
        const health = await getHealth(controller.signal);
        if (controller.signal.aborted) return;
        setState({ status: health.ready ? "ready" : "loading", health });
        timer = setTimeout(poll, health.ready ? 30_000 : 3_000);
      } catch {
        if (controller.signal.aborted) return;
        setState({ status: "offline" });
        timer = setTimeout(poll, 5_000);
      }
    }
    poll();

    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, []);

  return state;
}
