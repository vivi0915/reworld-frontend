# Reworld Player / Operations

## Delivery and migrations

The existing app, menu and class/draw visuals remain in place. `drizzle/0002_player_operations.sql` is an additive migration over 0000/0001, with a matching Drizzle snapshot and journal. It preserves existing members and draws, gives legacy accounts a Player ID, and leaves their phone numbers **unverified**. Never infer account ownership from a legacy contact phone. Verified phone bindings are unique; existing password accounts can still log in. New password registration remains disabled. New device Players are created without a phone via POST /api/player/create.

Apply migrations to a backed-up staging database before production. Sites packages migrations with the build. For other Worker deployments, apply the same migration files through that deployment's D1 migration process. Do not manually run 0002 twice or replace the production database. No live database migration was run by the local tests.

Initial settings: store online, draw enabled, registration enabled, door access disabled, PIN NULL, display duration 15 seconds. Settings writes and their audit entries use D1 batch transactions. Public settings refresh every 10 seconds; each ACCESS and draw request validates current server settings. An already disclosed PIN cannot be revoked from a person's memory; disabling access blocks subsequent requests. Door PIN changes here must match the code configured separately on the physical offline lock.

## SMS integration still required

There is deliberately no built-in SMS vendor or test-code login in production. With no SMS configuration, send/verify fail closed with a helpful message; device Player creation remains available. Set a Worker service binding `SMS` and a secret `OTP_SECRET` of at least 32 characters after selecting a vendor. The SMS adapter owns the vendor credentials and implements:

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

Existing reward draws and their content remain intact. Reward definitions declare requires_phone_verification and one_time. POST /api/rewards/claim accepts only an existing server-issued claimId belonging to the authenticated member. No client can grant an entitlement or choose its verification policy. Unknown reward definitions fail closed. No live rewards are seeded, automatically granted or attached from Guest history; concrete campaigns and grant/redemption rules remain to be defined. Existing draw labels are game results, not issued member entitlements.

A protected claim requires phone_verified_at. The transaction acquires a unique (user_id, reward_key) lock for one-time rewards before changing available/unlocked to claimed. That verified user identity remains stable because a phone cannot be rebound to a different Player; users must restore the original account. The lock survives claim expiration and preserves historical claimed records. Claims support available, legacy unlocked, claimed, redeemed and expired, with claimed_at and redeemed_at. The UI shows claim controls only for known definitions and available entitlements.

## Verification

- `node --test tests/operations.test.mjs`: actual API handlers, isolated SQLite adapter, test-only injected SMS transport; migration preservation, Guest/Player/Admin, no PIN leakage, OTP replay/expiry/attempt limits, duplicate phone, account isolation, toggles and suspension.
- `node node_modules/typescript/bin/tsc --noEmit`
- `node node_modules/eslint/bin/eslint.js app components/member-panel.tsx components/admin-console.tsx lib db/schema.ts tests/operations.test.mjs`
- `npm run build`

The optional local HTTP contract test checks retired registration and protected records. Operational tests use isolated in-memory data; the built Worker smoke test uses disposable D1. No tests seed production accounts.

## Optional phone upgrade (migration 0005)

- GUEST has no member; PLAYER has a member and no phone_verified_at; VERIFIED PLAYER has phone_verified_at. The old phone_verified flag is retained for compatibility, not used as a separate account tier.
- POST /api/player/create creates a random Player ID, NULL phone and a 90-day session without SMS, username input or password input. Existing authenticated requests are idempotent. Registration toggle and server rate limits still apply. Unverified device-only accounts are not guaranteed recoverable after cookie loss/logout; the UI explains this. Legacy password accounts retain their login.
- OTP send declares attach or recover. Attach requires an authenticated unverified Player. Each challenge is bound to the current member (or NULL for signed-out recovery), its phone and purpose. Verification updates the same member, preserving histories and claims. Recovery never creates a member. Registration off blocks new Players, not verification or recovery of existing ones.
- If proof reveals an existing phone owner, no account is merged or phone moved. The API returns a short-lived, one-use recovery proof; the UI explicitly asks CONTINUE WITH EXISTING PLAYER. The restore route binds that proof to its originating member and logs into the original identity. Proof expires with the OTP. Suspended identities cannot log in or evade suspension by relinking.
- OTP limits include phone cooldown/hour, IP/hour, source member/hour and verification counters; no frontend OTP or test bypass exists. Actual SMS still requires a provider.
- Migration 0005 avoids rebuilding members (and cascading away sessions) by retaining the old required contact column as legacy_contact_phone, adding the nullable canonical phone column and backfilling phone_verified_at for already verified accounts. This archive is never exposed by API. Unverified legacy contact numbers remain unverified. Member foreign keys, sessions, histories, claims and admin privileges are preserved. Outstanding pre-migration OTP challenges are invalidated. Reward claims are copied with all existing IDs/statuses/timestamps before replacing their table to extend allowed statuses.
- GitHub skips private Sites migrations 0003/0004; they contain account maintenance data and must never be exported. Current work targets GitHub; the separate Sites deployment needs a coordinated migration journal before any later deployment. Use a backed-up staging database first.

Acceptance coverage: isolated handlers exercise flows A–H, provider absence, registration-off verification/recovery, preserved account identity/history, private recovery, cross-account OTP rejection, attempt/expiry/replay, duplicate/concurrent claims, suspension and admin visibility. The built Worker test applies migrations to disposable real D1. No live SMS or production data is used.
