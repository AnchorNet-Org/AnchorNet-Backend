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

/** Builds the {@link Config} from `process.env`, applying sensible defaults. */
export function loadConfig(
  env: Record<string, string | undefined> = process.env,
): Config {
  const apiKey = env.API_KEY?.trim();
  return {
    port: intFromEnv(env.PORT, 3001),
    feeBps: intFromEnv(env.FEE_BPS, 10),
    apiKey: apiKey ? apiKey : undefined,
    env: env.NODE_ENV ?? "development",
  };
}
