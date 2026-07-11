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
});
