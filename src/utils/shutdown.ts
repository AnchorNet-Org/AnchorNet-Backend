/**
 * Graceful shutdown helper for the HTTP server.
 *
 * Produces a signal handler that stops the server from accepting new
 * connections and closes it, forcing an exit if in-flight connections do not
 * drain within `timeoutMs`. A second signal received while shutdown is
 * already underway is ignored, so e.g. a repeated Ctrl+C does not re-enter
 * (or restart) the shutdown path.
 */

/**
 * The minimal server shape this helper depends on, rather than the full
 * `http.Server` type, so tests can pass a lightweight fake.
 */
export interface CloseableServer {
  close(callback?: (err?: Error) => void): unknown;
}

export interface ShutdownOptions {
  /** Milliseconds to wait for the server to close before forcing exit. Default 10s. */
  timeoutMs?: number;
  /** Called once, synchronously, the first time a signal is handled. */
  onShutdown?: (signal: string) => void;
  /** Injectable for testing; defaults to `process.exit`. */
  exit?: (code: number) => void;
}

const DEFAULT_TIMEOUT_MS = 10_000;

/**
 * Builds a `(signal: string) => void` handler suitable for wiring up to
 * `process.on("SIGTERM", ...)` / `process.on("SIGINT", ...)`.
 */
export function createShutdownHandler(
  server: CloseableServer,
  options: ShutdownOptions = {},
): (signal: string) => void {
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const exit = options.exit ?? process.exit.bind(process);
  let shuttingDown = false;

  return (signal: string): void => {
    if (shuttingDown) return;
    shuttingDown = true;

    options.onShutdown?.(signal);

    const forceExit = setTimeout(() => exit(1), timeoutMs);
    forceExit.unref?.();

    server.close((err?: Error) => {
      clearTimeout(forceExit);
      exit(err ? 1 : 0);
    });
  };
}
