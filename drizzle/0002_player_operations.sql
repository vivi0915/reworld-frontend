CREATE TABLE `admin_logs` (
	`id` text PRIMARY KEY NOT NULL,
	`admin_id` text NOT NULL,
	`action` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`admin_id`) REFERENCES `members`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `door_access_logs` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text,
	`session_id` text,
	`accessed_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`result` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `members`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_door_access_time` ON `door_access_logs` (`accessed_at`);--> statement-breakpoint
CREATE TABLE `guest_draws` (
	`id` text PRIMARY KEY NOT NULL,
	`session_id` text NOT NULL,
	`role` text NOT NULL,
	`reward` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_guest_draws_time` ON `guest_draws` (`created_at`);--> statement-breakpoint
CREATE TABLE `otp_challenges` (
	`id` text PRIMARY KEY NOT NULL,
	`phone` text NOT NULL,
	`code_hash` text NOT NULL,
	`expires_at` integer NOT NULL,
	`attempts` integer DEFAULT 0 NOT NULL,
	`consumed` integer DEFAULT 0 NOT NULL,
	`sent` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_otp_phone` ON `otp_challenges` (`phone`,`expires_at`);--> statement-breakpoint
CREATE TABLE `otp_limits` (
	`key` text PRIMARY KEY NOT NULL,
	`attempts` integer NOT NULL,
	`expires_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `player_history` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`type` text NOT NULL,
	`value` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `members`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_player_history_user` ON `player_history` (`user_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `reward_claims` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`reward_key` text NOT NULL,
	`status` text DEFAULT 'unlocked' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`claimed_at` text,
	FOREIGN KEY (`user_id`) REFERENCES `members`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "claim_status" CHECK("reward_claims"."status" IN ('unlocked','claimed','expired'))
);
--> statement-breakpoint
CREATE TABLE `system_settings` (
	`id` integer PRIMARY KEY NOT NULL,
	`store_online` integer DEFAULT 1 NOT NULL,
	`door_access_enabled` integer DEFAULT 0 NOT NULL,
	`card_draw_enabled` integer DEFAULT 1 NOT NULL,
	`registration_enabled` integer DEFAULT 1 NOT NULL,
	`maintenance_message` text DEFAULT '' NOT NULL,
	`door_pin` text,
	`door_pin_display_seconds` integer DEFAULT 15 NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	CONSTRAINT "single_settings" CHECK("system_settings"."id" = 1),
	CONSTRAINT "display_seconds_range" CHECK("system_settings"."door_pin_display_seconds" BETWEEN 5 AND 60)
);
--> statement-breakpoint
ALTER TABLE `members` ADD `player_id` text;--> statement-breakpoint
ALTER TABLE `members` ADD `phone_verified` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `members` ADD `status` text DEFAULT 'active' NOT NULL;--> statement-breakpoint
ALTER TABLE `members` ADD `last_login_at` text;--> statement-breakpoint
CREATE UNIQUE INDEX `idx_members_player_id` ON `members` (`player_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `idx_members_verified_phone` ON `members` (`phone`) WHERE "members"."phone_verified" = 1;
--> statement-breakpoint
UPDATE members SET player_id = 'RW-' || upper(replace(id, '-', ''));
--> statement-breakpoint
INSERT INTO system_settings(id) VALUES(1);
