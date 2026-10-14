-- Additive migration: existing accounts, sessions and rewards remain intact.
CREATE TABLE menu_explorations (
  member_id text NOT NULL REFERENCES members(id),
  drink_id text NOT NULL CONSTRAINT menu_drink_id CHECK(drink_id IN ('role-01-drink-1','role-01-drink-2','role-01-drink-3','role-02-drink-1','role-02-drink-2','role-02-drink-3','role-04-drink-1','role-04-drink-2','role-04-drink-3','role-03-drink-1','role-03-drink-2','role-03-drink-3')),
  status text NOT NULL DEFAULT 'pending' CONSTRAINT menu_status CHECK(status IN ('pending','completed','revoked')),
  requested_at text NOT NULL DEFAULT CURRENT_TIMESTAMP,
  confirmed_at text,
  confirmed_by text REFERENCES members(id),
  revision integer NOT NULL DEFAULT 1,
  last_event_id text,
  PRIMARY KEY(member_id, drink_id),
  CONSTRAINT menu_confirmed CHECK(status != 'completed' OR (confirmed_at IS NOT NULL AND confirmed_by IS NOT NULL))
);
--> statement-breakpoint
CREATE TABLE menu_exploration_events (
  id text PRIMARY KEY NOT NULL,
  member_id text NOT NULL REFERENCES members(id),
  drink_id text NOT NULL,
  actor_id text NOT NULL REFERENCES members(id),
  action text NOT NULL CONSTRAINT menu_event_action CHECK(action IN ('confirm','revoke')),
  reason text NOT NULL DEFAULT '',
  created_at text NOT NULL DEFAULT CURRENT_TIMESTAMP
);
--> statement-breakpoint
CREATE INDEX idx_menu_events_member ON menu_exploration_events(member_id, created_at);
--> statement-breakpoint
CREATE TABLE menu_vouchers (
  member_id text PRIMARY KEY NOT NULL REFERENCES members(id),
  code text NOT NULL UNIQUE,
  created_at text NOT NULL DEFAULT CURRENT_TIMESTAMP,
  redeemed_at text,
  redeemed_by text REFERENCES members(id)
);
