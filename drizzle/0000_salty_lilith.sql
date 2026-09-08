CREATE TABLE `reward_draws` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`member_id` text NOT NULL,
	`member_name` text DEFAULT '測試會員' NOT NULL,
	`role` text NOT NULL,
	`reward` text NOT NULL,
	`used` integer DEFAULT false NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_reward_draws_member_created` ON `reward_draws` (`member_id`,`created_at`);