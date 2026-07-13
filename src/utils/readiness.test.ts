import { isReady, markNotReady } from "./readiness";

describe("readiness", () => {
  it("starts ready", () => {
    expect(isReady()).toBe(true);
  });

  it("becomes not ready after markNotReady, and stays that way", () => {
    markNotReady();
    expect(isReady()).toBe(false);

    markNotReady();
    expect(isReady()).toBe(false);
  });
});
