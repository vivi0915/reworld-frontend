# Reworld Player / Operations

## Delivery and migrations

The existing app, menu and class/draw visuals remain in place. `drizzle/0002_player_operations.sql` is an additive migration over 0000/0001, with a matching Drizzle snapshot and journal. It preserves existing members and draws, gives legacy accounts a Player ID, and leaves their phone numbers **unverified**. Never infer account ownership from a legacy contact phone. New verified phone accounts are unique; existing password accounts can still log in. New password registration is disabled.

Apply migrations to a backed-up staging database before production. Sites packages migrations with the build. For other Worker deployments, apply the same migration files through that deployment's D1 migration process. Do not manually run 0002 twice or replace the production database. No live database migration was run by the local tests.

Initial settings: store online, draw enabled, registration enabled, door access disabled, PIN NULL, display duration 15 seconds. Settings writes and their audit entries use D1 batch transactions. Public settings refresh every 10 seconds; each ACCESS and draw request validates current server settings. An already disclosed PIN cannot be revoked from a person's memory; disabling access blocks subsequent requests. Door PIN changes here must match the code configured separately on the physical offline lock.

## SMS integration still required

There is deliberately no built-in SMS vendor or test-code login in production. With no SMS configuration, send/verify fail closed with a helpful Guest message. Set a Worker service binding `SMS` and a secret `OTP_SECRET` of at least 32 characters after selecting a vendor. The SMS adapter owns the vendor credentials and implements:

- `POST https://sms.internal/send`
- JSON `{ to: "+8869xxxxxxxx", message: "…", idempotencyKey: "challenge UUID" }`
- 2xx only after the provider accepts delivery; non-2xx on failure.
- Honor idempotency keys and never log messages, codes or phone numbers in diagnostic output.

The app times out after 10 seconds and only enables verification after successful transport acceptance. Actual Taiwan SMS delivery, provider error handling, sender registration and delivery quality must be tested after configuring the adapter. No SMS was sent by the automated tests.

OTP: six random digits, HMAC-SHA256 storage with the server secret, five-minute expiry, 60-second resend cooldown, maximum five wrong attempts per challenge, five sends per phone/hour and twenty per IP/hour, plus verification rate limits. Resending supersedes previous challenges. Verification consumes the code atomically. Phone formats `09xxxxxxxx` and `+8869xxxxxxxx` normalize to E.164. Sessions use hashed random tokens and a 90-day HttpOnly/SameSite=Lax cookie (Secure outside localhost). Suspended users cannot authenticate or access protected records; suspension revokes existing sessions. Existing session expiry is retained until next login.

## Admin access

`/admin` and every `/api/admin/*` endpoint check an active database-backed admin role. Use an existing authorized administrator. If none exists, a deployment maintainer must promote one specifically verified existing account with a parameterized database operation; there is no public bootstrap route, default password, first-user promotion, or client role assignment. Admin accounts cannot be suspended through member management.

The console includes four toggles, maintenance text, blank masked PIN replacement input, explicit PIN clearing, display duration, Taiwan-day statistics, phone/Player ID search, member histories, suspend/unsuspend and paginated audit/access logs. The PIN is not returned by admin settings, logs, initial HTML or public configuration. Only a successful POST to `/api/access` returns it, with no-store headers. Guest cookies use random identifiers; logs store only their hash. Guest draws are counted separately and cannot be claimed by submitting a client member ID.

## Rewards

Existing `reward_draws.used` and reward content remain intact. `reward_claims` supports unlocked/claimed/expired states for future member rewards. There is intentionally no automatic reward grant or claim endpoint until reward and redemption rules are defined. Guest pre-registration rewards are not automatically attached to a later account. Class selections made while logged in are saved; the original draw history remains in the history tab.

## Verification

- `node --test tests/operations.test.mjs`: actual API handlers, isolated SQLite adapter, test-only injected SMS transport; migration preservation, Guest/Player/Admin, no PIN leakage, OTP replay/expiry/attempt limits, duplicate phone, account isolation, toggles and suspension.
- `node node_modules/typescript/bin/tsc --noEmit`
- `node node_modules/eslint/bin/eslint.js app components/member-panel.tsx components/admin-console.tsx lib db/schema.ts tests/operations.test.mjs`
- `npm run build`

The optional local HTTP contract test checks retired registration and protected records. Operational tests use isolated in-memory data; the built Worker smoke test uses disposable D1. No tests seed production accounts.
