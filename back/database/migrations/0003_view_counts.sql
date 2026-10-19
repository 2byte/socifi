CREATE TABLE `view_counts` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`target_type` text NOT NULL,
	`target_id` integer NOT NULL,
	`count` integer DEFAULT 0 NOT NULL,
	`last_viewed_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `view_counts_target_idx` ON `view_counts` (`target_type`,`target_id`);