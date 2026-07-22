/**
 * Small request-validation helpers that throw {@link ApiError} on failure so
 * the error-handling middleware can translate them into 400 responses.
 */

import { ApiError } from "../errors/ApiError";

/** Ensures `value` is a non-empty string and returns it trimmed. */
export function requireString(value: unknown, field: string): string {
  if (typeof value !== "string" || value.trim() === "") {
    throw ApiError.badRequest(`"${field}" must be a non-empty string`);
  }
  return value.trim();
}

/** Ensures `value` is a non-empty string up to a maximum length. */
export function requireStringMaxLength(value: unknown, field: string, maxLength: number): string {
  const str = requireString(value, field);
  if (str.length > maxLength) {
    throw ApiError.badRequest(`"${field}" must be at most ${maxLength} characters`);
  }
  return str;
}

/** Ensures `value` is a finite number greater than zero. */
export function requirePositiveNumber(value: unknown, field: string): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) {
    throw ApiError.badRequest(`"${field}" must be a positive number`);
  }
  return value;
}

/**
 * Coerces `value` to a number and ensures it is a positive integer (e.g. a
 * resource id from a route param), returning the parsed number.
 */
export function requirePositiveInteger(value: unknown, field: string): number {
  if (typeof value !== "number" && typeof value !== "string") {
    throw ApiError.badRequest(`"${field}" must be a positive integer`);
  }
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed <= 0) {
    throw ApiError.badRequest(`"${field}" must be a positive integer`);
  }
  return parsed;
}

/** Normalizes an asset code to upper case (e.g. "usdc" -> "USDC"). */
export function normalizeAsset(value: unknown): string {
  const asset = requireString(value, "asset").toUpperCase();
  if (!/^[A-Z0-9]{1,12}$/.test(asset)) {
    throw ApiError.badRequest(`"asset" must be 1-12 alphanumeric characters`);
  }
  return asset;
}
