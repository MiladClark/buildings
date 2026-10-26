CREATE TABLE `standalone_expense` (
	`id` text PRIMARY KEY NOT NULL,
	`building_id` text NOT NULL,
	`category_id` text NOT NULL,
	`description` text NOT NULL,
	`amount_rial` integer NOT NULL,
	`expense_date` integer NOT NULL,
	`maintenance_ticket_id` text,
	`linked_expense_id` text,
	`deleted_at` integer,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`building_id`) REFERENCES `building`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`category_id`) REFERENCES `expense_category`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`maintenance_ticket_id`) REFERENCES `maintenance_ticket`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`linked_expense_id`) REFERENCES `expense_line`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `standalone_expense_linked_expense_id_unique` ON `standalone_expense` (`linked_expense_id`);--> statement-breakpoint
ALTER TABLE `payment` ADD `standalone_expense_id` text REFERENCES standalone_expense(id);--> statement-breakpoint
ALTER TABLE `payment` ADD `kind` text DEFAULT 'receipt' NOT NULL;