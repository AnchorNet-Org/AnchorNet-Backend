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

/** Ensures `value` is a finite number greater than zero. */
export function requirePositiveNumber(value: unknown, field: string): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) {
    throw ApiError.badRequest(`"${field}" must be a positive number`);
  }
  return value;
}

/** Normalizes an asset code to upper case (e.g. "usdc" -> "USDC"). */
export function normalizeAsset(value: unknown): string {
  return requireString(value, "asset").toUpperCase();
}
