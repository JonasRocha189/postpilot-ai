import { API_BASE_URL, apiMode } from "@/lib/api/http";

/**
 * - `ok`: API and database answering
 * - `degraded`: the API answers but the database doesn't (503)
 * - `offline`: no answer (server down, asleep or no network)
 * - `demo`: mock mode (`npm run dev` without a backend): there is no API
 */
export type HealthState = "ok" | "degraded" | "offline" | "demo";

export type HealthResult = {
  state: HealthState;
  /** Round trip of the check, in milliseconds (null when there was no answer) */
  latencyMs: number | null;
  database: "ok" | "error" | null;
  checkedAt: string;
};

// The backend's readiness check: no token, 503 when the database is down
const READY_URL = `${API_BASE_URL}/health/ready`;
// Render's free plan wakes up in 30-60 s: wait for it instead of failing early
const TIMEOUT_MS = 70_000;

export async function checkHealth(): Promise<HealthResult> {
  const checkedAt = new Date().toISOString();
  if (apiMode === "mock") {
    return { state: "demo", latencyMs: null, database: null, checkedAt };
  }
  const start = performance.now();
  try {
    const response = await fetch(READY_URL, {
      signal: AbortSignal.timeout(TIMEOUT_MS),
      cache: "no-store",
    });
    const latencyMs = Math.round(performance.now() - start);
    const body = (await response.json().catch(() => null)) as {
      checks?: { database?: "ok" | "error" };
    } | null;
    const database = body?.checks?.database ?? null;
    if (response.ok)
      return { state: "ok", latencyMs, database: "ok", checkedAt };
    if (response.status === 503) {
      return {
        state: "degraded",
        latencyMs,
        database: database ?? "error",
        checkedAt,
      };
    }
    return { state: "offline", latencyMs, database: null, checkedAt };
  } catch {
    return { state: "offline", latencyMs: null, database: null, checkedAt };
  }
}
