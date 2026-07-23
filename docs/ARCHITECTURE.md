# AnchorNet Backend Architecture & Security Guarantees

## Overview

The `anchornet-backend` service provides REST APIs for Stellar liquidity coordination, settlement, and routing.

## Security Architecture & Audit Log Guarantees

### Audit Endpoint (`GET /api/v1/audit`)

The audit log middleware (`src/middleware/auditLog.ts`) captures recent mutating requests (`POST`, `PUT`, `PATCH`, `DELETE`) in an in-memory bounded ring buffer.

#### Captured Fields
- `method`: HTTP method
- `path`: Request path (without query parameters)
- `status`: Response status code
- `requestId`: Correlation ID from `x-request-id` response header
- `timestamp`: ISO timestamp of request completion

#### Sensitive Data Redaction & Security Guarantees
- **Strict Redaction via Denylist**: Any header, body parameter, or metadata stored in audit log entries is processed through `redactSensitiveData()`.
- **Denylisted Fields**: Secret-bearing keys such as `x-api-key`, `authorization`, `cookie`, `set-cookie`, `token`, `access_token`, `refresh_token`, `secret`, `password`, `bearer`, `private_key`, `client_secret` are matched case-insensitively and replaced with `"[REDACTED]"`.
- **Preventing Plaintext Exposure**: Under no circumstances should raw credentials or API keys be captured or retained in plaintext in the in-memory audit ring buffer or exposed via `GET /api/v1/audit`.
