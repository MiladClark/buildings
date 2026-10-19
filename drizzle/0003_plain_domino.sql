CREATE TABLE `management_event` (
	`id` text PRIMARY KEY NOT NULL,
	`building_id` text NOT NULL,
	`actor_id` text,
	`entity_type` text NOT NULL,
	`entity_id` text NOT NULL,
	`action` text NOT NULL,
	`label` text NOT NULL,
	`before_json` text,
	`after_json` text,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`building_id`) REFERENCES `building`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`actor_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
ALTER TABLE `billing_period` ADD `deleted_at` integer;--> statement-breakpoint
ALTER TABLE `expense_line` ADD `deleted_at` integer;--> statement-breakpoint
ALTER TABLE `maintenance_ticket` ADD `deleted_at` integer;--> statement-breakpoint
ALTER TABLE `payment` ADD `deleted_at` integer;--> statement-breakpoint
ALTER TABLE `unit` ADD `deleted_at` integer;