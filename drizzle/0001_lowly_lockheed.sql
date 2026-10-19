ALTER TABLE `period_snapshot` ADD `temporarily_absent` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `unit` ADD `temporarily_absent` integer DEFAULT false NOT NULL;