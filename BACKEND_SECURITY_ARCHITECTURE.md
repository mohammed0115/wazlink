# WazLink Backend Architecture & Documentation

> **B0 status:** Architecture and contracts only. Backend coding is not authorized. This document is normative for future backend implementation agents.

**Frontend reference:** `30bc15e9ca3c0205df2b49e792fce1b8e78a36b1`  
**Scope:** Django + PostgreSQL backend design; no production implementation, migrations, endpoints, provider calls, secrets, infrastructure, or frontend changes are included in B0.

## Security baseline

Use Django session authentication with secure, HttpOnly, SameSite cookies and CSRF protection for unsafe requests. Passwords use Django’s approved password hasher; verification and reset tokens are single-use, expiring, and rate-limited. Workspace membership and object-level authorization are required on every tenant query; `public_id` alone is never sufficient.

RBAC is enforced in application services, not only UI visibility. Serializer fields are allow-listed to prevent mass assignment. Inputs are size-limited and validated before ORM operations. ORM parameterization prevents SQL injection; output escaping and safe HTML policies prevent XSS. Provider URL fetches use strict allowlists and SSRF defenses; redirects are not trusted for payment truth.

Uploads require MIME sniffing, extension allowlists, size limits, checksum, malware scanning where available, quarantine status, and signed/proxied access. Hostinger paths are never exposed directly. Webhook signatures are verified before persistence/dispatch, with replay protection and provider-specific deduplication.

Secrets live in environment/secret management systems and never in Git, logs, DTOs, or client bundles. Required secret classes include Django, PostgreSQL, Redis, Google, scraper, Meta, OpenAI, Tap, ZATCA, Sentry, and Hostinger credentials. Environments have isolated databases, Redis, provider apps, webhook credentials, storage, payment, tax, and observability projects.

Logs omit passwords, tokens, authorization headers, full payment data, and unnecessary message content. PII is masked in operations and exports. Sentry scrubs PII; OpenTelemetry propagates request IDs but does not capture sensitive payloads. Backups are encrypted and access-controlled. Security testing must include IDOR, cross-workspace access, permission escalation, quota bypass, injection, mass assignment, webhook signature, and idempotency replay.
