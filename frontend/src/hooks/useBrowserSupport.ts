"use client";

import { useSyncExternalStore } from "react";

const noopSubscribe = () => () => {};

/**
 * True when the browser can share files (Web Share API), e.g. Chrome on Android, Safari on iOS.
 * Uses useSyncExternalStore so the server-rendered HTML (false) and the browser agree on hydration.
 */
export function useCanShare(): boolean {
  return useSyncExternalStore(
    noopSubscribe,
    () => typeof navigator !== "undefined" && typeof navigator.share === "function",
    () => false,
  );
}
