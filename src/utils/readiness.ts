/**
 * Process-wide readiness flag.
 *
 * Starts ready; flipped to not-ready once, permanently, by
 * {@link markNotReady} so a load balancer's readiness probe can stop routing
 * new traffic while a graceful shutdown drains in-flight requests.
 */

let ready = true;

/** Returns whether the process should currently receive new traffic. */
export function isReady(): boolean {
  return ready;
}

/** Marks the process as not ready. Irreversible for the life of the process. */
export function markNotReady(): void {
  ready = false;
}
