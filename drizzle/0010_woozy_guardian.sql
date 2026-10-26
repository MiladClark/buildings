ALTER TABLE `billing_period` ADD `charge_model` text DEFAULT 'direct' NOT NULL;--> statement-breakpoint
ALTER TABLE `expense_line` ADD `billing_treatment` text DEFAULT 'auto' NOT NULL;--> statement-breakpoint
ALTER TABLE `period_charge_plan` ADD `cleaning_visit_rial` integer;--> statement-breakpoint
ALTER TABLE `period_charge_plan` ADD `cleaning_every_days` integer DEFAULT 30 NOT NULL;