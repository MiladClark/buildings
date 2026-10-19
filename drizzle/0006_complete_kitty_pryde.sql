CREATE TABLE `charge_budget_policy` (
	`category_id` text PRIMARY KEY NOT NULL,
	`building_id` text NOT NULL,
	`mode` text NOT NULL,
	`interval_months` integer,
	`monthly_reserve_rial` integer,
	FOREIGN KEY (`category_id`) REFERENCES `expense_category`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`building_id`) REFERENCES `building`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `period_charge_plan` (
	`period_id` text PRIMARY KEY NOT NULL,
	`manual_monthly_rial` integer,
	`buffer_percent` integer DEFAULT 10 NOT NULL,
	`round_to_rial` integer DEFAULT 500000 NOT NULL,
	FOREIGN KEY (`period_id`) REFERENCES `billing_period`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
ALTER TABLE `expense_line` ADD `coverage_months` integer;