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
 * The model fields a `columns` tuple forgot to cover, or `never` when the
 * tuple is exhaustive. Optional model fields (e.g. `cancelReason?`) count
 * just like required ones — an omitted column silently drops data either way.
 */
type MissingColumns<T, C extends readonly (keyof T & string)[]> = Exclude<
  keyof T & string,
  C[number]
>;

/**
 * Resolves to `C` when `C` names every field of `T`, otherwise to a type that
 * cannot be satisfied — surfacing the offending field names directly in the
 * compiler error via the `CSV_COLUMNS_IS_MISSING_MODEL_FIELDS` property.
 */
type ExhaustiveColumns<T, C extends readonly (keyof T & string)[]> = [
  MissingColumns<T, C>,
] extends [never]
  ? C
  : C & { CSV_COLUMNS_IS_MISSING_MODEL_FIELDS: MissingColumns<T, C> };

/**
 * Builds a CSV column tuple that is *structurally* locked to a model type,
 * making header drift a build failure rather than a silent export bug.
 *
 * Two directions of drift are both compile errors:
 *  - a column naming a field that does not exist on `T` (typo / removed field);
 *  - a field added to `T` that no column covers (the silent-omission case).
 *
 * The `const` type parameter preserves the literal tuple, so the exported
 * constant keeps its exact order for both the header row and the field order.
 *
 * @example
 * const CSV_COLUMNS = csvColumnsFor<Anchor>()([
 *   "id", "name", "registeredAt", "active",
 * ]);
 */
export function csvColumnsFor<T>() {
  return <const C extends readonly (keyof T & string)[]>(
    columns: C & ExhaustiveColumns<T, C>,
  ): C => columns;
}

/**
 * Serializes an array of flat objects to CSV using `columns` as both the
 * header row and the field order. Missing fields render as an empty cell.
 */
export function toCsv<T>(rows: T[], columns: readonly string[]): string {
  const header = columns.map(escapeField).join(",");
  const lines = rows.map((row) =>
    columns
      .map((column) => escapeField((row as Record<string, unknown>)[column]))
      .join(","),
  );
  return [header, ...lines].join("\n") + "\n";
}
