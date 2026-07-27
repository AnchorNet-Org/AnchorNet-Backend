Guard CSV_COLUMNS against silent export drift
Closes the CSV column-coverage drift issue.

Problem
routes/anchors.ts declared CSV_COLUMNS = ["id", "name", "registeredAt", "active"]
as a plain string[] and passed it to toCsv. routes/settlements.ts did the
same for Settlement.

toCsv renders exactly the columns it is handed and ignores every model field it
is not handed. Nothing connected those constants to Anchor / Settlement, so
adding a field to a model without updating the constant would have silently
dropped that field from the CSV export — no compile error, no failing test, and
consumers downloading the CSV quietly lose data. Same class of problem as the
existing OpenAPI schema-drift issue, applied to export columns.

What changed
Two independent guardrails, in separate commits so the second can be dropped if
a reviewer prefers to keep this strictly test-only.

1. test: — exact header-row assertions (the issue's core ask)
Tests parse the first line of the real ?format=csv response and assert the
exact column list and order:

Endpoint	Asserted header
GET /api/v1/anchors?format=csv	id, name, registeredAt, active
GET /api/v1/settlements?format=csv	id, anchor, asset, amount, fee, status, createdAt, cancelReason
GET /api/v1/anchors/:id/settlements?format=csv	same as settlements, and pinned to equal the top-level export
Beyond the literal list, each suite also asserts the header against
Object.keys(...) of a real serialized API object rather than a second
hardcoded list. That is the part that actually resists drift: a field added to
the model and surfaced in the JSON response fails the suite even if nobody
remembers to update the expected-column array. The settlement version uses a
cancelled settlement so the optional cancelReason is present.

Also covered: the header is still emitted when the result set is empty, and each
data row has exactly one cell per header column.

2. feat: — compile-time derivation (the issue's "consider" item)
The issue asked whether CSV_COLUMNS could be derived from keyof Anchor /
keyof Settlement to make drift structurally impossible. It can, so it is done
rather than deferred:

TypeScript

const CSV_COLUMNS = csvColumnsFor<Anchor>()([
  "id", "name", "registeredAt", "active",
]);
csvColumnsFor<T>() (in utils/csv.ts) is a pure type-level helper — it returns
its tuple unchanged at runtime and has zero effect on any response body. It
constrains the tuple to (keyof T & string)[] and additionally requires it to be
exhaustive, so both drift directions fail npm run build:

a column naming a field that does not exist on the model (typo / renamed /
removed field), and
a model field that no column covers — and the compiler error names the
uncovered field via the CSV_COLUMNS_IS_MISSING_MODEL_FIELDS property.
Optional fields such as cancelReason? are treated exactly like required ones,
since omitting them truncates the export just the same. toCsv's columns
parameter was widened to readonly string[] so the const tuples pass directly.

3. docs:

ARCHITECTURE.md
 gains a "CSV Export Column Coverage" section documenting
the risk and both guardrails, written in the same "locked in by a test" style as
the existing persistence-swap section, plus a CHANGELOG entry.

Validation
Full CI pipeline (lint → build → test) green:

text

LINT   exit 0
BUILD  exit 0
TEST   40 suites, 453 tests passed  (baseline was 40 / 439)
Coverage 97.11% statements overall (bar: 95%); 
csv.ts
 at 100%.

The tests pass against the current constants, verified independently: the
test-only commit checked out on its own, against unmodified production code,
gives 40 suites / 449 tests green.

Drift was deliberately simulated and reverted (not in this diff)
#	Simulated drift	Result
1	Added required tier to Anchor, left CSV_COLUMNS alone	Build fails, error names tier
2	Added optional tier? to Anchor + populated it in the service	Build fails naming tier; with the type guard bypassed, the runtime test fails with - "tier"
3	Removed "active" from the anchor CSV_COLUMNS	Build fails, error names active
4	Removed "cancelReason" from the settlement CSV_COLUMNS	Build fails naming it; with the guard bypassed, 4 runtime tests fail
Case 2 is the important one — it confirms the runtime tests catch drift on their
own, so the two guardrails are genuinely independent rather than the type guard
merely masking the tests. All simulations were reverted; grep for
tier/SIMULATED/ghostColumn across src/ and docs/ returns nothing.

Reviewer note
When adding a field to Anchor or Settlement, add it to the corresponding
CSV_COLUMNS — and for settlements, to both routes/settlements.ts and the
nested list in routes/anchors.ts — plus the expected-column lists in the tests.
The build will name the field you missed.

Files changed
File	Change

anchors.test.ts
Added header-coverage tests (anchors + nested settlements) and a parseHeaderRow helper

settlements.test.ts
Added header-coverage tests and a parseHeaderRow helper

csv.ts
Added csvColumnsFor<T>(); toCsv accepts readonly string[]

csv.test.ts
Added csvColumnsFor unit tests

anchors.ts
CSV_COLUMNS / SETTLEMENT_CSV_COLUMNS built via csvColumnsFor

settlements.ts
CSV_COLUMNS built via csvColumnsFor

ARCHITECTURE.md
New "CSV Export Column Coverage" section

CHANGELOG.md
[Unreleased] entry
