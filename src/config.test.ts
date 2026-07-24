import { loadConfig } from "./config";

describe("loadConfig", () => {
  it("applies defaults when env is empty", () => {
    const config = loadConfig({});
    expect(config.port).toBe(3001);
    expect(config.feeBps).toBe(10);
    expect(config.apiKey).toBeUndefined();
    expect(config.env).toBe("development");
  });

  it("reads values from the environment", () => {
    const config = loadConfig({
      PORT: "8080",
      FEE_BPS: "25",
      API_KEY: "secret",
      NODE_ENV: "production",
    });
    expect(config.port).toBe(8080);
    expect(config.feeBps).toBe(25);
    expect(config.apiKey).toBe("secret");
    expect(config.env).toBe("production");
  });

  it("falls back to defaults for non-numeric values", () => {
    const config = loadConfig({ PORT: "abc" });
    expect(config.port).toBe(3001);
  });

  it("treats a blank API key as unset", () => {
    const config = loadConfig({ API_KEY: "   " });
    expect(config.apiKey).toBeUndefined();
  });

  it("throws when FEE_BPS is negative", () => {
    expect(() => loadConfig({ FEE_BPS: "-1" })).toThrow(/FEE_BPS/);
  });

  it("throws when FEE_BPS exceeds 10000", () => {
    expect(() => loadConfig({ FEE_BPS: "10001" })).toThrow(/FEE_BPS/);
  });

  it("accepts the boundary FEE_BPS values", () => {
    expect(loadConfig({ FEE_BPS: "0" }).feeBps).toBe(0);
    expect(loadConfig({ FEE_BPS: "10000" }).feeBps).toBe(10000);
  });

  it("leaves the CORS allowlist undefined when unset", () => {
    expect(loadConfig({}).corsOrigins).toBeUndefined();
  });

  it("parses a comma-separated CORS_ORIGIN allowlist", () => {
    const config = loadConfig({
      CORS_ORIGIN: "https://a.example, https://b.example",
    });
    expect(config.corsOrigins).toEqual([
      "https://a.example",
      "https://b.example",
    ]);
  });

  it("treats a blank CORS_ORIGIN as unset", () => {
    expect(loadConfig({ CORS_ORIGIN: "  ,  " }).corsOrigins).toBeUndefined();
  });

  it.each([
    "http://localhost:3000",
    "https://api.example.com",
    "https://api.example.com:8443",
    "https://[2001:db8::1]:8443",
  ])("accepts the valid CORS origin %p", (origin) => {
    expect(loadConfig({ CORS_ORIGIN: origin }).corsOrigins).toEqual([origin]);
  });

  it.each([
    "example.com",
    "*",
    "ftp://example.com",
    "https://user:password@example.com",
    "https://example.com/path",
    "https://example.com?query=value",
    "https://example.com#fragment",
  ])("rejects the invalid CORS origin %p", (origin) => {
    expect(() => loadConfig({ CORS_ORIGIN: origin })).toThrow(
      `CORS_ORIGIN contains an invalid origin: ${JSON.stringify(origin)}`,
    );
  });

  it("rejects the full allowlist when one CORS origin is malformed", () => {
    expect(() =>
      loadConfig({
        CORS_ORIGIN: "https://valid.example, example.com",
      }),
    ).toThrow(/example\.com/);
  });

  it("defaults the JSON body size limit to 100kb", () => {
    expect(loadConfig({}).bodyLimit).toBe("100kb");
  });

  it("reads a configured JSON body size limit", () => {
    expect(loadConfig({ BODY_LIMIT: "1mb" }).bodyLimit).toBe("1mb");
  });

  it("falls back to the default body limit for a blank value", () => {
    expect(loadConfig({ BODY_LIMIT: "   " }).bodyLimit).toBe("100kb");
  });

  it("defaults maintenance mode to disabled", () => {
    expect(loadConfig({}).maintenanceMode).toBe(false);
  });

  it.each(["1", "true", "TRUE", " true "])(
    "enables maintenance mode for MAINTENANCE_MODE=%p",
    (value) => {
      expect(loadConfig({ MAINTENANCE_MODE: value }).maintenanceMode).toBe(
        true,
      );
    },
  );

  it.each(["0", "false", "", undefined])(
    "leaves maintenance mode disabled for MAINTENANCE_MODE=%p",
    (value) => {
      expect(
        loadConfig({ MAINTENANCE_MODE: value }).maintenanceMode,
      ).toBe(false);
    },
  );

  it("defaults idempotency and rate limiting options", () => {
    const config = loadConfig({});
    expect(config.idempotencyTtlMs).toBe(86_400_000);
    expect(config.rateLimitMax).toBe(30);
    expect(config.rateLimitWindowMs).toBe(60_000);
  });

  it("reads idempotency and rate limiting options from the environment", () => {
    const config = loadConfig({
      IDEMPOTENCY_TTL_MS: "3600000",
      RATE_LIMIT_MAX: "100",
      RATE_LIMIT_WINDOW_MS: "120000",
    });
    expect(config.idempotencyTtlMs).toBe(3600000);
    expect(config.rateLimitMax).toBe(100);
    expect(config.rateLimitWindowMs).toBe(120000);
  });
});
