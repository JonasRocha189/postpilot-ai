import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  IDLE_TIMEOUT_MS,
  IDLE_WARNING_MS,
  markActivity,
  readLastActivity,
  wasIdleLogout,
} from "./idle";
import { useIdleLogout } from "./useIdleLogout";

const MINUTE = 60_000;

function advance(ms: number) {
  act(() => {
    vi.advanceTimersByTime(ms);
  });
}

describe("useIdleLogout", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    localStorage.clear();
    sessionStorage.clear();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("logs out after 30 minutes without activity, warning in the last minute", () => {
    const onTimeout = vi.fn();
    const { result } = renderHook(() => useIdleLogout(onTimeout));

    advance(IDLE_TIMEOUT_MS - IDLE_WARNING_MS - 1_000);
    expect(result.current.warning).toBe(false);

    advance(2_000);
    expect(result.current.warning).toBe(true);
    expect(result.current.secondsLeft).toBeLessThanOrEqual(60);
    expect(onTimeout).not.toHaveBeenCalled();

    advance(IDLE_WARNING_MS);
    expect(onTimeout).toHaveBeenCalledTimes(1);
    expect(wasIdleLogout()).toBe(true);
    expect(readLastActivity()).toBeNull();

    // Only once, even if the timer keeps ticking until the redirect
    advance(10_000);
    expect(onTimeout).toHaveBeenCalledTimes(1);
  });

  it("restarts the timer on user activity", () => {
    const onTimeout = vi.fn();
    renderHook(() => useIdleLogout(onTimeout));

    advance(20 * MINUTE);
    act(() => {
      window.dispatchEvent(new KeyboardEvent("keydown"));
    });
    advance(20 * MINUTE);
    expect(onTimeout).not.toHaveBeenCalled();

    advance(11 * MINUTE);
    expect(onTimeout).toHaveBeenCalledTimes(1);
  });

  it("'stay signed in' closes the warning and restarts the timer", () => {
    const onTimeout = vi.fn();
    const { result } = renderHook(() => useIdleLogout(onTimeout));

    advance(IDLE_TIMEOUT_MS - 30_000);
    expect(result.current.warning).toBe(true);

    act(() => result.current.stayActive());
    expect(result.current.warning).toBe(false);

    advance(IDLE_TIMEOUT_MS - 2 * MINUTE);
    expect(onTimeout).not.toHaveBeenCalled();
  });

  it("activity in another tab keeps this one alive", () => {
    const onTimeout = vi.fn();
    renderHook(() => useIdleLogout(onTimeout));

    advance(25 * MINUTE);
    markActivity(Date.now()); // written by the other tab
    advance(25 * MINUTE);
    expect(onTimeout).not.toHaveBeenCalled();
  });

  it("logs out right away when the stored session is already stale", () => {
    markActivity(Date.now() - IDLE_TIMEOUT_MS - MINUTE);
    const onTimeout = vi.fn();
    renderHook(() => useIdleLogout(onTimeout));

    expect(onTimeout).toHaveBeenCalledTimes(1);
  });

  it("keeps a recent stored session", () => {
    markActivity(Date.now() - 10 * MINUTE);
    const onTimeout = vi.fn();
    renderHook(() => useIdleLogout(onTimeout));

    expect(onTimeout).not.toHaveBeenCalled();
    advance(IDLE_TIMEOUT_MS - MINUTE);
    expect(onTimeout).not.toHaveBeenCalled();
  });
});
