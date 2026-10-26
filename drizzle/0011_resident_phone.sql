ALTER TABLE `user` ADD `phone` text;--> statement-breakpoint
CREATE UNIQUE INDEX `user_phone_unique` ON `user` (`phone`);