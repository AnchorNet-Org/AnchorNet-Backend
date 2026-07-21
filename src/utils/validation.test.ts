import {
  normalizeAsset,
  requirePositiveInteger,
  requirePositiveNumber,
  requireString,
} from "./validation";
import { ApiError } from "../errors/ApiError";

describe("requireString", () => {
  it("returns a trimmed string", () => {
    expect(requireString("  hello  ", "field")).toBe("hello");
  });

  it("rejects a non-string value", () => {
    expect(() => requireString(42, "field")).toThrow(ApiError);
  });

  it("rejects an empty string", () => {
    expect(() => requireString("", "field")).toThrow(ApiError);
  });

  it("rejects a whitespace-only string", () => {
    expect(() => requireString("   ", "field")).toThrow(ApiError);
  });

  it("rejects undefined", () => {
    expect(() => requireString(undefined, "field")).toThrow(ApiError);
  });

  it("includes the field name in the error message", () => {
    expect(() => requireString(undefined, "asset")).toThrow(/"asset"/);
  });
});

describe("requirePositiveNumber", () => {
  it("returns a positive number unchanged", () => {
    expect(requirePositiveNumber(5, "amount")).toBe(5);
  });

  it("accepts fractional amounts", () => {
    expect(requirePositiveNumber(0.5, "amount")).toBe(0.5);
  });

  it("rejects zero", () => {
    expect(() => requirePositiveNumber(0, "amount")).toThrow(ApiError);
  });

  it("rejects a negative number", () => {
    expect(() => requirePositiveNumber(-1, "amount")).toThrow(ApiError);
  });

  it("rejects NaN", () => {
    expect(() => requirePositiveNumber(NaN, "amount")).toThrow(ApiError);
  });

  it("rejects Infinity", () => {
    expect(() => requirePositiveNumber(Infinity, "amount")).toThrow(ApiError);
  });

  it("rejects a non-number value", () => {
    expect(() => requirePositiveNumber("5", "amount")).toThrow(ApiError);
  });
});

describe("requirePositiveInteger", () => {
  it("coerces a numeric string to a number", () => {
    expect(requirePositiveInteger("42", "id")).toBe(42);
  });

  it("returns a positive integer unchanged", () => {
    expect(requirePositiveInteger(7, "id")).toBe(7);
  });

  it("rejects zero", () => {
    expect(() => requirePositiveInteger(0, "id")).toThrow(ApiError);
  });

  it("rejects a negative integer", () => {
    expect(() => requirePositiveInteger(-3, "id")).toThrow(ApiError);
  });

  it("rejects a fractional value", () => {
    expect(() => requirePositiveInteger(1.5, "id")).toThrow(ApiError);
  });

  it("rejects a non-numeric string", () => {
    expect(() => requirePositiveInteger("abc", "id")).toThrow(ApiError);
  });

  it("includes the field name in the error message", () => {
    expect(() => requirePositiveInteger("abc", "id")).toThrow(
      /"id" must be a positive integer/,
    );
  });
});

describe("normalizeAsset", () => {
  it("upper-cases a lower-case asset code", () => {
    expect(normalizeAsset("usdc")).toBe("USDC");
  });

  it("trims surrounding whitespace", () => {
    expect(normalizeAsset("  usdc  ")).toBe("USDC");
  });

  it("rejects a non-string value", () => {
    expect(() => normalizeAsset(123)).toThrow(ApiError);
  });

  it("rejects an empty value", () => {
    expect(() => normalizeAsset("")).toThrow(ApiError);
  });

  it("rejects a non-alphanumeric value", () => {
    expect(() => normalizeAsset("USD-C")).toThrow(ApiError);
    expect(() => normalizeAsset("USDC_1")).toThrow(ApiError);
    expect(() => normalizeAsset("USD!")).toThrow(ApiError);
  });

  it("rejects a value that is too long (gt 12 chars)", () => {
    expect(() => normalizeAsset("THISISWAYTOOLONGASSETCODE")).toThrow(ApiError);
  });
});
