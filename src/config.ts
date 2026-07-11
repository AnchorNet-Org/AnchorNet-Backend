/**
 * Typed application configuration loaded from environment variables.
 */

export interface Config {
  /** Port the HTTP server binds to. */
  port: number;
  /** Protocol fee in basis points applied to settlements/quotes. */
  feeBps: number;
  /** Optional API key required for mutating requests (disabled if unset). */
  apiKey?: string;
  /** Current environment name. */
  env: string;
}

function intFromEnv(value: string | undefined, fallback: number): number {
  if (value === undefined) return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

const MIN_FEE_BPS = 0;
const MAX_FEE_BPS = 10_000;

/** Builds the {@link Config} from `process.env`, applying sensible defaults. */
export function loadConfig(
  env: Record<string, string | undefined> = process.env,
): Config {
  const apiKey = env.API_KEY?.trim();
  const feeBps = intFromEnv(env.FEE_BPS, 10);

  if (feeBps < MIN_FEE_BPS || feeBps > MAX_FEE_BPS) {
    throw new Error(
      `FEE_BPS must be between ${MIN_FEE_BPS} and ${MAX_FEE_BPS} (got ${feeBps})`,
    );
  }

  return {
    port: intFromEnv(env.PORT, 3001),
    feeBps,
    apiKey: apiKey ? apiKey : undefined,
    env: env.NODE_ENV ?? "development",
  };
}
