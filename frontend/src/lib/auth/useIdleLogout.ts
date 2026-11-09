import { useCallback, useEffect, useRef, useState } from "react";
import {
  clearActivity,
  flagIdleLogout,
  IDLE_TIMEOUT_MS,
  IDLE_WARNING_MS,
  markActivity,
  readLastActivity,
} from "./idle";

const ACTIVITY_EVENTS = [
  "pointerdown",
  "pointermove",
  "keydown",
  "wheel",
  "touchstart",
  "scroll",
] as const;
/** pointermove fires constantly: write to storage at most this often */
const WRITE_THROTTLE_MS = 5_000;
const TICK_MS = 1_000;

export type IdleState = {
  /** True during the last minute before the logout */
  warning: boolean;
  /** Seconds left until the logout (meaningful while `warning`) */
  secondsLeft: number;
  /** Counts as activity: closes the warning and restarts the timer */
  stayActive: () => void;
};

/**
 * Calls `onTimeout` once after `timeoutMs` without activity in any tab.
 * Mount it only while the user is logged in.
 */
export function useIdleLogout(
  onTimeout: () => void,
  { timeoutMs = IDLE_TIMEOUT_MS, warningMs = IDLE_WARNING_MS } = {},
): IdleState {
  // Set on mount (from storage or "now")
  const lastActivity = useRef(0);
  const lastWrite = useRef(0);
  const timedOut = useRef(false);
  const onTimeoutRef = useRef(onTimeout);
  const [remaining, setRemaining] = useState(timeoutMs);

  useEffect(() => {
    onTimeoutRef.current = onTimeout;
  }, [onTimeout]);

  const record = useCallback((force = false) => {
    const now = Date.now();
    lastActivity.current = now;
    if (force || now - lastWrite.current >= WRITE_THROTTLE_MS) {
      lastWrite.current = now;
      markActivity(now);
    }
  }, []);

  const check = useCallback(() => {
    if (timedOut.current) return;
    // Another tab may have seen more recent activity
    const last = Math.max(lastActivity.current, readLastActivity() ?? 0);
    const left = timeoutMs - (Date.now() - last);
    if (left <= 0) {
      timedOut.current = true;
      flagIdleLogout();
      clearActivity();
      onTimeoutRef.current();
      return;
    }
    setRemaining(left);
  }, [timeoutMs]);

  useEffect(() => {
    // A session left open (closed tab, laptop asleep) may already be past the limit
    const stored = readLastActivity();
    lastActivity.current = stored ?? Date.now();
    check();
    if (timedOut.current) return;
    record(true);

    const onActivity = () => record();
    const onVisible = () => {
      if (document.visibilityState === "visible") check();
    };
    for (const event of ACTIVITY_EVENTS) {
      window.addEventListener(event, onActivity, { passive: true });
    }
    document.addEventListener("visibilitychange", onVisible);
    const timer = window.setInterval(check, TICK_MS);

    return () => {
      for (const event of ACTIVITY_EVENTS) {
        window.removeEventListener(event, onActivity);
      }
      document.removeEventListener("visibilitychange", onVisible);
      window.clearInterval(timer);
    };
  }, [check, record]);

  const stayActive = useCallback(() => {
    record(true);
    setRemaining(timeoutMs);
  }, [record, timeoutMs]);

  return {
    warning: remaining <= warningMs,
    secondsLeft: Math.max(0, Math.ceil(remaining / 1000)),
    stayActive,
  };
}
