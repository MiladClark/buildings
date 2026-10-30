CREATE TABLE "notification_delivery" (
	"id" text PRIMARY KEY NOT NULL,
	"notification_id" text NOT NULL,
	"subscription_id" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"next_attempt_at" timestamp with time zone DEFAULT now() NOT NULL,
	"lease_until" timestamp with time zone,
	"expires_at" timestamp with time zone NOT NULL,
	"sent_at" timestamp with time zone,
	"last_error" text
);
--> statement-breakpoint
CREATE TABLE "notification_preference" (
	"user_id" text PRIMARY KEY NOT NULL,
	"settings" jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notification_rule" (
	"building_id" text PRIMARY KEY NOT NULL,
	"settings" jsonb NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "push_identity" (
	"id" text PRIMARY KEY NOT NULL,
	"public_key" text NOT NULL,
	"private_key" text NOT NULL,
	"subject" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "push_subscription" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"building_id" text NOT NULL,
	"endpoint" text NOT NULL,
	"keys" jsonb NOT NULL,
	"device_name" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "push_subscription_endpoint_unique" UNIQUE("endpoint")
);
--> statement-breakpoint
CREATE TABLE "scheduled_announcement" (
	"id" text PRIMARY KEY NOT NULL,
	"building_id" text NOT NULL,
	"created_by" text,
	"title" text NOT NULL,
	"body" text NOT NULL,
	"audience" text NOT NULL,
	"unit_id" text,
	"send_at" timestamp with time zone NOT NULL,
	"processed_at" timestamp with time zone,
	"cancelled_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "app_notification" ADD COLUMN "building_id" text;--> statement-breakpoint
ALTER TABLE "app_notification" ADD COLUMN "kind" text DEFAULT 'system' NOT NULL;--> statement-breakpoint
ALTER TABLE "app_notification" ADD COLUMN "href" text DEFAULT '/resident/notifications' NOT NULL;--> statement-breakpoint
ALTER TABLE "app_notification" ADD COLUMN "dedupe_key" text;--> statement-breakpoint
ALTER TABLE "app_notification" ADD COLUMN "context" jsonb;--> statement-breakpoint
ALTER TABLE "expense_line" ADD COLUMN "utility_bill" jsonb;--> statement-breakpoint
ALTER TABLE "standalone_expense" ADD COLUMN "utility_bill" jsonb;--> statement-breakpoint
ALTER TABLE "notification_delivery" ADD CONSTRAINT "notification_delivery_notification_id_app_notification_id_fk" FOREIGN KEY ("notification_id") REFERENCES "public"."app_notification"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification_delivery" ADD CONSTRAINT "notification_delivery_subscription_id_push_subscription_id_fk" FOREIGN KEY ("subscription_id") REFERENCES "public"."push_subscription"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification_preference" ADD CONSTRAINT "notification_preference_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification_rule" ADD CONSTRAINT "notification_rule_building_id_building_id_fk" FOREIGN KEY ("building_id") REFERENCES "public"."building"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "push_subscription" ADD CONSTRAINT "push_subscription_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "push_subscription" ADD CONSTRAINT "push_subscription_building_id_building_id_fk" FOREIGN KEY ("building_id") REFERENCES "public"."building"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scheduled_announcement" ADD CONSTRAINT "scheduled_announcement_building_id_building_id_fk" FOREIGN KEY ("building_id") REFERENCES "public"."building"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scheduled_announcement" ADD CONSTRAINT "scheduled_announcement_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scheduled_announcement" ADD CONSTRAINT "scheduled_announcement_unit_id_unit_id_fk" FOREIGN KEY ("unit_id") REFERENCES "public"."unit"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "notification_delivery_pending_idx" ON "notification_delivery" USING btree ("status","next_attempt_at");--> statement-breakpoint
ALTER TABLE "app_notification" ADD CONSTRAINT "app_notification_building_id_building_id_fk" FOREIGN KEY ("building_id") REFERENCES "public"."building"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app_notification" ADD CONSTRAINT "app_notification_dedupe_key_unique" UNIQUE("dedupe_key");