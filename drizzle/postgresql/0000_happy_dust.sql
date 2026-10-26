CREATE TABLE "account" (
	"id" text PRIMARY KEY NOT NULL,
	"account_id" text NOT NULL,
	"provider_id" text NOT NULL,
	"user_id" text NOT NULL,
	"access_token" text,
	"refresh_token" text,
	"id_token" text,
	"access_token_expires_at" timestamp (3) with time zone,
	"refresh_token_expires_at" timestamp (3) with time zone,
	"scope" text,
	"password" text,
	"created_at" timestamp (3) with time zone NOT NULL,
	"updated_at" timestamp (3) with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "app_notification" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"title" text NOT NULL,
	"body" text NOT NULL,
	"read" boolean DEFAULT false NOT NULL,
	"created_at" timestamp (3) with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "billing_period" (
	"id" text PRIMARY KEY NOT NULL,
	"deleted_at" timestamp (3) with time zone,
	"building_id" text NOT NULL,
	"charge_model" text DEFAULT 'direct' NOT NULL,
	"title" text NOT NULL,
	"period_type" text NOT NULL,
	"start_date" timestamp (3) with time zone NOT NULL,
	"end_date" timestamp (3) with time zone NOT NULL,
	"due_date" timestamp (3) with time zone,
	"status" text DEFAULT 'draft' NOT NULL,
	"finalized_at" timestamp (3) with time zone,
	"created_at" timestamp (3) with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "building" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"address" text,
	"bank_account" text,
	"bank_sheba" text,
	"default_period_type" text DEFAULT 'monthly' NOT NULL,
	"payment_due_day" integer DEFAULT 10 NOT NULL,
	"per_unit_include_empty" boolean DEFAULT false NOT NULL,
	"created_at" timestamp (3) with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "charge_budget_policy" (
	"category_id" text PRIMARY KEY NOT NULL,
	"building_id" text NOT NULL,
	"mode" text NOT NULL,
	"interval_months" integer,
	"monthly_reserve_rial" bigint
);
--> statement-breakpoint
CREATE TABLE "charge_recommendation" (
	"id" text PRIMARY KEY NOT NULL,
	"building_id" text NOT NULL,
	"months_window" integer NOT NULL,
	"suggested_monthly_rial" bigint NOT NULL,
	"breakdown_json" text NOT NULL,
	"computed_at" timestamp (3) with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "chat_message" (
	"id" text PRIMARY KEY NOT NULL,
	"building_id" text NOT NULL,
	"user_id" text NOT NULL,
	"body" text DEFAULT '' NOT NULL,
	"image_key" text,
	"image_mime_type" text,
	"image_name" text,
	"edited_at" timestamp (3) with time zone,
	"deleted_at" timestamp (3) with time zone,
	"created_at" timestamp (3) with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "expense_category" (
	"id" text PRIMARY KEY NOT NULL,
	"building_id" text NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"kind" text DEFAULT 'variable' NOT NULL,
	"allocation_method" text NOT NULL,
	"include_empty_units" boolean DEFAULT false NOT NULL,
	"fixed_monthly_amount" bigint,
	"inflation_percent" integer DEFAULT 0,
	"sort_order" bigint DEFAULT 0 NOT NULL,
	"active" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE "expense_line" (
	"id" text PRIMARY KEY NOT NULL,
	"deleted_at" timestamp (3) with time zone,
	"period_id" text NOT NULL,
	"category_id" text NOT NULL,
	"maintenance_ticket_id" text,
	"amount_rial" bigint NOT NULL,
	"billing_treatment" text DEFAULT 'auto' NOT NULL,
	"coverage_months" integer,
	"source_standalone_id" text,
	"description" text,
	"expense_date" timestamp (3) with time zone NOT NULL,
	"attachment_path" text,
	"created_at" timestamp (3) with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "invoice_line_item" (
	"id" text PRIMARY KEY NOT NULL,
	"invoice_id" text NOT NULL,
	"category_id" text,
	"title" text NOT NULL,
	"basis" text,
	"amount_rial" bigint NOT NULL,
	"sort_order" bigint DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "maintenance_ticket" (
	"id" text PRIMARY KEY NOT NULL,
	"deleted_at" timestamp (3) with time zone,
	"building_id" text NOT NULL,
	"unit_id" text,
	"created_by" text NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"priority" text DEFAULT 'normal' NOT NULL,
	"status" text DEFAULT 'open' NOT NULL,
	"scheduled_at" timestamp (3) with time zone,
	"created_at" timestamp (3) with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "management_event" (
	"id" text PRIMARY KEY NOT NULL,
	"building_id" text NOT NULL,
	"actor_id" text,
	"entity_type" text NOT NULL,
	"entity_id" text NOT NULL,
	"action" text NOT NULL,
	"label" text NOT NULL,
	"before_json" text,
	"after_json" text,
	"created_at" timestamp (3) with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "membership" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"building_id" text NOT NULL,
	"unit_id" text,
	"role" text NOT NULL,
	"created_at" timestamp (3) with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "payment" (
	"id" text PRIMARY KEY NOT NULL,
	"deleted_at" timestamp (3) with time zone,
	"building_id" text NOT NULL,
	"unit_id" text NOT NULL,
	"period_id" text,
	"category_id" text,
	"standalone_expense_id" text,
	"kind" text DEFAULT 'receipt' NOT NULL,
	"allocation_tracked" boolean DEFAULT false NOT NULL,
	"receipt_key" text,
	"amount_rial" bigint NOT NULL,
	"method" text NOT NULL,
	"paid_at" timestamp (3) with time zone NOT NULL,
	"note" text,
	"recorded_by_user_id" text,
	"created_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "payment_receipt_key_unique" UNIQUE("receipt_key")
);
--> statement-breakpoint
CREATE TABLE "payment_application" (
	"id" text PRIMARY KEY NOT NULL,
	"unit_id" text NOT NULL,
	"period_id" text NOT NULL,
	"category_id" text,
	"payment_id" text,
	"amount_rial" bigint NOT NULL,
	"created_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "positive_application" CHECK ("payment_application"."amount_rial" > 0)
);
--> statement-breakpoint
CREATE TABLE "payment_request" (
	"id" text PRIMARY KEY NOT NULL,
	"deleted_at" timestamp (3) with time zone,
	"unit_id" text NOT NULL,
	"user_id" text NOT NULL,
	"amount_rial" bigint NOT NULL,
	"period_id" text,
	"category_id" text,
	"status" text DEFAULT 'pending' NOT NULL,
	"note" text,
	"created_at" timestamp (3) with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "period_charge_plan" (
	"period_id" text PRIMARY KEY NOT NULL,
	"manual_monthly_rial" bigint,
	"cleaning_visit_rial" bigint,
	"cleaning_every_days" integer DEFAULT 30 NOT NULL,
	"buffer_percent" integer DEFAULT 10 NOT NULL,
	"round_to_rial" bigint DEFAULT 500000 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "period_snapshot" (
	"id" text PRIMARY KEY NOT NULL,
	"period_id" text NOT NULL,
	"unit_id" text NOT NULL,
	"occupant_count" integer NOT NULL,
	"temporarily_absent" boolean DEFAULT false NOT NULL,
	"status" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "rate_adjustment" (
	"id" text PRIMARY KEY NOT NULL,
	"category_id" text NOT NULL,
	"previous_value" bigint,
	"new_value" bigint,
	"percent_change" integer,
	"reason" text,
	"adjusted_by_user_id" text,
	"created_at" timestamp (3) with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "session" (
	"id" text PRIMARY KEY NOT NULL,
	"expires_at" timestamp (3) with time zone NOT NULL,
	"token" text NOT NULL,
	"created_at" timestamp (3) with time zone NOT NULL,
	"updated_at" timestamp (3) with time zone NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"user_id" text NOT NULL,
	CONSTRAINT "session_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "standalone_expense" (
	"id" text PRIMARY KEY NOT NULL,
	"building_id" text NOT NULL,
	"category_id" text NOT NULL,
	"description" text NOT NULL,
	"amount_rial" bigint NOT NULL,
	"expense_date" timestamp (3) with time zone NOT NULL,
	"maintenance_ticket_id" text,
	"linked_expense_id" text,
	"deleted_at" timestamp (3) with time zone,
	"created_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "standalone_expense_linked_expense_id_unique" UNIQUE("linked_expense_id")
);
--> statement-breakpoint
CREATE TABLE "unit" (
	"id" text PRIMARY KEY NOT NULL,
	"deleted_at" timestamp (3) with time zone,
	"building_id" text NOT NULL,
	"label" text NOT NULL,
	"floor" integer,
	"status" text DEFAULT 'occupied' NOT NULL,
	"occupant_count" integer DEFAULT 1 NOT NULL,
	"temporarily_absent" boolean DEFAULT false NOT NULL,
	"owner_name" text,
	"tenant_name" text,
	"area_sqm" integer,
	"sort_order" bigint DEFAULT 0 NOT NULL,
	"created_at" timestamp (3) with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "unit_invoice" (
	"id" text PRIMARY KEY NOT NULL,
	"period_id" text NOT NULL,
	"unit_id" text NOT NULL,
	"subtotal_rial" bigint NOT NULL,
	"previous_balance_rial" bigint DEFAULT 0 NOT NULL,
	"total_rial" bigint NOT NULL,
	"paid_rial" bigint DEFAULT 0 NOT NULL,
	"legacy_paid_rial" bigint DEFAULT 0 NOT NULL,
	"balance_rial" bigint NOT NULL,
	"created_at" timestamp (3) with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"phone" text,
	"email_verified" boolean DEFAULT false NOT NULL,
	"image" text,
	"created_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_email_unique" UNIQUE("email"),
	CONSTRAINT "user_phone_unique" UNIQUE("phone")
);
--> statement-breakpoint
CREATE TABLE "verification" (
	"id" text PRIMARY KEY NOT NULL,
	"identifier" text NOT NULL,
	"value" text NOT NULL,
	"expires_at" timestamp (3) with time zone NOT NULL,
	"created_at" timestamp (3) with time zone,
	"updated_at" timestamp (3) with time zone
);
--> statement-breakpoint
ALTER TABLE "account" ADD CONSTRAINT "account_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app_notification" ADD CONSTRAINT "app_notification_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "billing_period" ADD CONSTRAINT "billing_period_building_id_building_id_fk" FOREIGN KEY ("building_id") REFERENCES "public"."building"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "charge_budget_policy" ADD CONSTRAINT "charge_budget_policy_category_id_expense_category_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."expense_category"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "charge_budget_policy" ADD CONSTRAINT "charge_budget_policy_building_id_building_id_fk" FOREIGN KEY ("building_id") REFERENCES "public"."building"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "charge_recommendation" ADD CONSTRAINT "charge_recommendation_building_id_building_id_fk" FOREIGN KEY ("building_id") REFERENCES "public"."building"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_message" ADD CONSTRAINT "chat_message_building_id_building_id_fk" FOREIGN KEY ("building_id") REFERENCES "public"."building"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_message" ADD CONSTRAINT "chat_message_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expense_category" ADD CONSTRAINT "expense_category_building_id_building_id_fk" FOREIGN KEY ("building_id") REFERENCES "public"."building"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expense_line" ADD CONSTRAINT "expense_line_period_id_billing_period_id_fk" FOREIGN KEY ("period_id") REFERENCES "public"."billing_period"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expense_line" ADD CONSTRAINT "expense_line_category_id_expense_category_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."expense_category"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expense_line" ADD CONSTRAINT "expense_line_maintenance_ticket_id_maintenance_ticket_id_fk" FOREIGN KEY ("maintenance_ticket_id") REFERENCES "public"."maintenance_ticket"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoice_line_item" ADD CONSTRAINT "invoice_line_item_invoice_id_unit_invoice_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "public"."unit_invoice"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoice_line_item" ADD CONSTRAINT "invoice_line_item_category_id_expense_category_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."expense_category"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "maintenance_ticket" ADD CONSTRAINT "maintenance_ticket_building_id_building_id_fk" FOREIGN KEY ("building_id") REFERENCES "public"."building"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "maintenance_ticket" ADD CONSTRAINT "maintenance_ticket_unit_id_unit_id_fk" FOREIGN KEY ("unit_id") REFERENCES "public"."unit"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "maintenance_ticket" ADD CONSTRAINT "maintenance_ticket_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "management_event" ADD CONSTRAINT "management_event_building_id_building_id_fk" FOREIGN KEY ("building_id") REFERENCES "public"."building"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "management_event" ADD CONSTRAINT "management_event_actor_id_user_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "membership" ADD CONSTRAINT "membership_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "membership" ADD CONSTRAINT "membership_building_id_building_id_fk" FOREIGN KEY ("building_id") REFERENCES "public"."building"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "membership" ADD CONSTRAINT "membership_unit_id_unit_id_fk" FOREIGN KEY ("unit_id") REFERENCES "public"."unit"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment" ADD CONSTRAINT "payment_building_id_building_id_fk" FOREIGN KEY ("building_id") REFERENCES "public"."building"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment" ADD CONSTRAINT "payment_unit_id_unit_id_fk" FOREIGN KEY ("unit_id") REFERENCES "public"."unit"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment" ADD CONSTRAINT "payment_period_id_billing_period_id_fk" FOREIGN KEY ("period_id") REFERENCES "public"."billing_period"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment" ADD CONSTRAINT "payment_category_id_expense_category_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."expense_category"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment" ADD CONSTRAINT "payment_standalone_expense_id_standalone_expense_id_fk" FOREIGN KEY ("standalone_expense_id") REFERENCES "public"."standalone_expense"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment" ADD CONSTRAINT "payment_recorded_by_user_id_user_id_fk" FOREIGN KEY ("recorded_by_user_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_application" ADD CONSTRAINT "payment_application_unit_id_unit_id_fk" FOREIGN KEY ("unit_id") REFERENCES "public"."unit"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_application" ADD CONSTRAINT "payment_application_period_id_billing_period_id_fk" FOREIGN KEY ("period_id") REFERENCES "public"."billing_period"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_application" ADD CONSTRAINT "payment_application_category_id_expense_category_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."expense_category"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_application" ADD CONSTRAINT "payment_application_payment_id_payment_id_fk" FOREIGN KEY ("payment_id") REFERENCES "public"."payment"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_request" ADD CONSTRAINT "payment_request_unit_id_unit_id_fk" FOREIGN KEY ("unit_id") REFERENCES "public"."unit"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_request" ADD CONSTRAINT "payment_request_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_request" ADD CONSTRAINT "payment_request_period_id_billing_period_id_fk" FOREIGN KEY ("period_id") REFERENCES "public"."billing_period"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_request" ADD CONSTRAINT "payment_request_category_id_expense_category_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."expense_category"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "period_charge_plan" ADD CONSTRAINT "period_charge_plan_period_id_billing_period_id_fk" FOREIGN KEY ("period_id") REFERENCES "public"."billing_period"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "period_snapshot" ADD CONSTRAINT "period_snapshot_period_id_billing_period_id_fk" FOREIGN KEY ("period_id") REFERENCES "public"."billing_period"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "period_snapshot" ADD CONSTRAINT "period_snapshot_unit_id_unit_id_fk" FOREIGN KEY ("unit_id") REFERENCES "public"."unit"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rate_adjustment" ADD CONSTRAINT "rate_adjustment_category_id_expense_category_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."expense_category"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rate_adjustment" ADD CONSTRAINT "rate_adjustment_adjusted_by_user_id_user_id_fk" FOREIGN KEY ("adjusted_by_user_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session" ADD CONSTRAINT "session_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "standalone_expense" ADD CONSTRAINT "standalone_expense_building_id_building_id_fk" FOREIGN KEY ("building_id") REFERENCES "public"."building"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "standalone_expense" ADD CONSTRAINT "standalone_expense_category_id_expense_category_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."expense_category"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "standalone_expense" ADD CONSTRAINT "standalone_expense_maintenance_ticket_id_maintenance_ticket_id_fk" FOREIGN KEY ("maintenance_ticket_id") REFERENCES "public"."maintenance_ticket"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "standalone_expense" ADD CONSTRAINT "standalone_expense_linked_expense_id_expense_line_id_fk" FOREIGN KEY ("linked_expense_id") REFERENCES "public"."expense_line"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "unit" ADD CONSTRAINT "unit_building_id_building_id_fk" FOREIGN KEY ("building_id") REFERENCES "public"."building"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "unit_invoice" ADD CONSTRAINT "unit_invoice_period_id_billing_period_id_fk" FOREIGN KEY ("period_id") REFERENCES "public"."billing_period"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "unit_invoice" ADD CONSTRAINT "unit_invoice_unit_id_unit_id_fk" FOREIGN KEY ("unit_id") REFERENCES "public"."unit"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_chat_message_building_created" ON "chat_message" USING btree ("building_id","created_at");--> statement-breakpoint
CREATE INDEX "idx_chat_message_user" ON "chat_message" USING btree ("user_id");