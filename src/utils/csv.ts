/**
 * Minimal CSV serialization for exporting list endpoints.
 */

/** Escapes a single CSV field per RFC 4180: quotes fields containing a comma, quote, or newline. */
function escapeField(value: unknown): string {
  const str = value === undefined || value === null ? "" : String(value);
  if (/[",\n]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

/**
 * Serializes an array of flat objects to CSV using `columns` as both the
 * header row and the field order. Missing fields render as an empty cell.
 */
export function toCsv<T extends Record<string, unknown>>(
  rows: T[],
  columns: string[],
): string {
  const header = columns.map(escapeField).join(",");
  const lines = rows.map((row) =>
    columns.map((column) => escapeField(row[column])).join(","),
  );
  return [header, ...lines].join("\n") + "\n";
}
