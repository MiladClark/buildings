CREATE TABLE `chat_message` (
	`id` text PRIMARY KEY NOT NULL,
	`building_id` text NOT NULL,
	`user_id` text NOT NULL,
	`body` text DEFAULT '' NOT NULL,
	`image_key` text,
	`image_mime_type` text,
	`image_name` text,
	`edited_at` integer,
	`deleted_at` integer,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`building_id`) REFERENCES `building`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_chat_message_building_created` ON `chat_message` (`building_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `idx_chat_message_user` ON `chat_message` (`user_id`);