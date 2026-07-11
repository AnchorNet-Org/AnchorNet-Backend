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
  /**
   * Allowed CORS origins. `undefined` means no allowlist is configured and
   * every origin is permitted (the historical default behavior).
   */
  corsOrigins?: string[];
  /** Maximum accepted JSON request body size, as an `express.json` `limit` string. */
  bodyLimit: string;
  /** Current environment name. */
  env: string;
}

const DEFAULT_BODY_LIMIT = "100kb";

function intFromEnv(value: string | undefined, fallback: number): number {
  if (value === undefined) return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

/**
 * Parses a comma-separated `CORS_ORIGIN` value into a list of allowed
 * origins, trimming whitespace and dropping empty entries. Returns
 * `undefined` when unset or when every entry is blank.
 */
function parseCorsOrigins(value: string | undefined): string[] | undefined {
  if (!value) return undefined;
  const origins = value
    .split(",")
    .map((origin) => origin.trim())
    .filter((origin) => origin !== "");
  return origins.length > 0 ? origins : undefined;
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
    corsOrigins: parseCorsOrigins(env.CORS_ORIGIN),
    bodyLimit: env.BODY_LIMIT?.trim() || DEFAULT_BODY_LIMIT,
    env: env.NODE_ENV ?? "development",
  };
}
