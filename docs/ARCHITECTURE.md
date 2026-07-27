AnchorNet Backend Architecture & Security Guarantees
Overview
The anchornet-backend service provides REST APIs for Stellar liquidity coordination, settlement, and routing.

Security Architecture & Audit Log Guarantees
Audit Endpoint (GET /api/v1/audit)
The audit log middleware (src/middleware/auditLog.ts) captures recent mutating requests (POST, PUT, PATCH, DELETE) in an in-memory bounded ring buffer.

Captured Fields
method: HTTP method
path: Request path (without query parameters)
status: Response status code
requestId: Correlation ID from x-request-id response header
timestamp: ISO timestamp of request completion
Sensitive Data Redaction & Security Guarantees
Strict Redaction via Denylist: Any header, body parameter, or metadata stored in audit log entries is processed through redactSensitiveData().
Denylisted Fields: Secret-bearing keys such as x-api-key, authorization, cookie, set-cookie, token, access_token, refresh_token, secret, password, bearer, private_key, client_secret are matched case-insensitively and replaced with "[REDACTED]".
Preventing Plaintext Exposure: Under no circumstances should raw credentials or API keys be captured or retained in plaintext in the in-memory audit ring buffer or exposed via GET /api/v1/audit.
In-Memory Repositories & Future Persistence
Settlement, anchor, and liquidity data are held in process-local in-memory
repositories (src/repositories/*), all extending the shared
InMemoryRepository base class.

Persistence-Swap Risk (read before swapping any repository for a DB)
Several repositories already document that they are "swappable for a
persistent … store later" (e.g. liquidityRepository.ts). This is a forward
design intent, but the current id-allocation contract does not survive that
swap unchanged:

InMemoryRepository.generateId() / peekId() allocate ids under the
assumption that they run synchronously and atomically on Node's single
thread. peekId() exposes the id that generateId() will hand out next
without any locking.
SettlementRepository.peekNextId() returns that previewed id. It is safe to
call peekNextId() and then create() only because both are synchronous
— no other mutation can interleave between them on the event loop. The
returned id is a hint, not a reservation.
⚠️ If any repository is ever backed by an asynchronous store (e.g. a
database), this guarantee breaks. Splitting allocation into a separate
peek + create across an await boundary lets a concurrent caller consume
the previewed id first, introducing a race that does not exist today.

Required guardrails for any async-backed repository:

Allocate ids atomically inside a single transactional/atomic operation
rather than a separate peek + generate.
Never use peekNextId() to reserve an id across an await.
The synchronous-only contract is locked in by a test in
src/repositories/settlementRepository.test.ts (preview … immediate create). That test must remain green; treat its failure as a signal that a
non-atomic change to id allocation has been introduced.