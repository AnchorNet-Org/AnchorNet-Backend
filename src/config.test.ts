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
});
