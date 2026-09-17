-- Keep the old required contact column as a compatibility archive. No member
-- table rebuild: existing sessions, audit references and histories stay intact.
DROP INDEX idx_members_verified_phone;
--> statement-breakpoint
ALTER TABLE members RENAME COLUMN phone TO legacy_contact_phone;
--> statement-breakpoint
ALTER TABLE members ADD phone text;
--> statement-breakpoint
ALTER TABLE members ADD phone_verified_at text;
--> statement-breakpoint
UPDATE members SET phone = NULLIF(legacy_contact_phone, ''), phone_verified_at = CASE WHEN phone_verified = 1 THEN COALESCE(last_login_at, created_at) ELSE NULL END;
--> statement-breakpoint
CREATE UNIQUE INDEX idx_members_verified_phone ON members(phone) WHERE phone_verified_at IS NOT NULL;
--> statement-breakpoint
ALTER TABLE otp_challenges ADD user_id text REFERENCES members(id);
--> statement-breakpoint
ALTER TABLE otp_challenges ADD purpose text NOT NULL DEFAULT 'recover';
--> statement-breakpoint
ALTER TABLE otp_challenges ADD recovery_hash text;
--> statement-breakpoint
UPDATE otp_challenges SET consumed = 1;
--> statement-breakpoint
CREATE TABLE reward_definitions (reward_key text PRIMARY KEY NOT NULL, requires_phone_verification integer NOT NULL DEFAULT 1, one_time integer NOT NULL DEFAULT 1, CONSTRAINT reward_requires_phone_boolean CHECK(requires_phone_verification IN (0,1)), CONSTRAINT reward_one_time_boolean CHECK(one_time IN (0,1)));
--> statement-breakpoint
CREATE TABLE reward_claims_next (id text PRIMARY KEY NOT NULL, user_id text NOT NULL REFERENCES members(id), reward_key text NOT NULL, status text NOT NULL DEFAULT 'available', created_at text NOT NULL DEFAULT CURRENT_TIMESTAMP, claimed_at text, redeemed_at text, CONSTRAINT claim_status CHECK(status IN ('unlocked','available','claimed','redeemed','expired')));
--> statement-breakpoint
INSERT INTO reward_claims_next(id,user_id,reward_key,status,created_at,claimed_at) SELECT id,user_id,reward_key,status,created_at,claimed_at FROM reward_claims;
--> statement-breakpoint
DROP TABLE reward_claims;
--> statement-breakpoint
ALTER TABLE reward_claims_next RENAME TO reward_claims;
--> statement-breakpoint
CREATE TABLE reward_claim_locks (user_id text NOT NULL REFERENCES members(id), reward_key text NOT NULL, claim_id text NOT NULL, PRIMARY KEY(user_id, reward_key));
--> statement-breakpoint
INSERT OR IGNORE INTO reward_claim_locks(user_id,reward_key,claim_id) SELECT user_id,reward_key,id FROM reward_claims WHERE status IN ('claimed','redeemed') ORDER BY claimed_at, id;
