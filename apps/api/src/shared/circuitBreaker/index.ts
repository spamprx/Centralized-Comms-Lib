/**
 * S6 — Circuit Breakers (SRS §3.2 — Workload Isolation)
 *
 * Implements a half-open circuit breaker per named key so flapping
 * external services (AI inference, Integration Layer) do not cascade
 * latency into core domain logic.
 *
 * States:
 *   CLOSED   — normal operation; failures are counted
 *   OPEN     — all calls fail fast for OPEN_DURATION_MS
 *   HALF_OPEN — one probe call is allowed; success resets to CLOSED,
 *               failure resets to OPEN
 *
 * Tunables (process.env):
 *   CB_FAILURE_THRESHOLD   Failures before opening (default: 5)
 *   CB_OPEN_DURATION_MS    Duration of OPEN state in ms (default: 30 000)
 */

type CircuitState = "CLOSED" | "OPEN" | "HALF_OPEN";

interface CircuitStats {
  state: CircuitState;
  failures: number;
  openedAt: number | null;
  halfOpenProbeInFlight: boolean;
}

const circuits = new Map<string, CircuitStats>();

function getConfig() {
  return {
    failureThreshold: parseInt(process.env.CB_FAILURE_THRESHOLD ?? "5", 10),
    openDurationMs: parseInt(process.env.CB_OPEN_DURATION_MS ?? "30000", 10),
  };
}

function getOrCreate(key: string): CircuitStats {
  if (!circuits.has(key)) {
    circuits.set(key, {
      state: "CLOSED",
      failures: 0,
      openedAt: null,
      halfOpenProbeInFlight: false,
    });
  }
  return circuits.get(key)!;
}

function transition(stats: CircuitStats, newState: CircuitState): void {
  stats.state = newState;
  if (newState === "OPEN") {
    stats.openedAt = Date.now();
    stats.halfOpenProbeInFlight = false;
  } else if (newState === "CLOSED") {
    stats.failures = 0;
    stats.openedAt = null;
    stats.halfOpenProbeInFlight = false;
  }
}

export class CircuitOpenError extends Error {
  constructor(key: string) {
    super(`Circuit breaker OPEN for: ${key}`);
    this.name = "CircuitOpenError";
  }
}

/**
 * Wrap an external call with circuit-breaker protection.
 * Throws `CircuitOpenError` when the circuit is OPEN and no probe is due.
 */
export async function withCircuitBreaker<T>(
  key: string,
  fn: () => Promise<T>,
): Promise<T> {
  const cfg = getConfig();
  const stats = getOrCreate(key);

  if (stats.state === "OPEN") {
    const elapsed = Date.now() - (stats.openedAt ?? 0);
    if (elapsed >= cfg.openDurationMs) {
      // Transition to HALF_OPEN and allow one probe
      if (!stats.halfOpenProbeInFlight) {
        stats.state = "HALF_OPEN";
        stats.halfOpenProbeInFlight = true;
      } else {
        throw new CircuitOpenError(key);
      }
    } else {
      throw new CircuitOpenError(key);
    }
  }

  try {
    const result = await fn();
    if (stats.state === "HALF_OPEN") {
      transition(stats, "CLOSED");
    } else {
      // Successful call resets failure counter in CLOSED state
      stats.failures = 0;
    }
    return result;
  } catch (err) {
    if (err instanceof CircuitOpenError) throw err;

    stats.failures += 1;
    if (
      stats.state === "HALF_OPEN" ||
      stats.failures >= cfg.failureThreshold
    ) {
      transition(stats, "OPEN");
    }
    throw err;
  }
}

/** Expose circuit states for observability / admin dashboard. */
export function getCircuitStats(): Record<string, { state: CircuitState; failures: number }> {
  const out: Record<string, { state: CircuitState; failures: number }> = {};
  for (const [key, stats] of circuits.entries()) {
    out[key] = { state: stats.state, failures: stats.failures };
  }
  return out;
}

/** Reset a named circuit (admin use). */
export function resetCircuit(key: string): void {
  const stats = circuits.get(key);
  if (stats) transition(stats, "CLOSED");
}
