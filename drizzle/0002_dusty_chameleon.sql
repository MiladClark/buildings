CREATE TABLE `payment_application` (
	`id` text PRIMARY KEY NOT NULL,
	`unit_id` text NOT NULL,
	`period_id` text NOT NULL,
	`category_id` text,
	`payment_id` text,
	`amount_rial` integer NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`unit_id`) REFERENCES `unit`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`period_id`) REFERENCES `billing_period`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`category_id`) REFERENCES `expense_category`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`payment_id`) REFERENCES `payment`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "positive_application" CHECK("payment_application"."amount_rial" > 0)
);
--> statement-breakpoint
ALTER TABLE `payment` ADD `category_id` text REFERENCES expense_category(id);--> statement-breakpoint
ALTER TABLE `payment` ADD `allocation_tracked` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `payment` ADD `receipt_key` text;--> statement-breakpoint
CREATE UNIQUE INDEX `payment_receipt_key_unique` ON `payment` (`receipt_key`);--> statement-breakpoint
ALTER TABLE `payment_request` ADD `period_id` text REFERENCES billing_period(id);--> statement-breakpoint
ALTER TABLE `payment_request` ADD `category_id` text REFERENCES expense_category(id);--> statement-breakpoint
ALTER TABLE `unit_invoice` ADD `legacy_paid_rial` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
UPDATE `unit_invoice` SET `legacy_paid_rial` = `paid_rial`;
