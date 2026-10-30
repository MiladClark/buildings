CREATE TABLE "expense_disbursement" (
	"id" text PRIMARY KEY NOT NULL,
	"building_id" text NOT NULL,
	"expense_id" text,
	"standalone_expense_id" text,
	"amount_rial" bigint NOT NULL,
	"payee" text NOT NULL,
	"paid_at" timestamp (3) with time zone NOT NULL,
	"method" text NOT NULL,
	"reference" text,
	"note" text,
	"items" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"final_payment" boolean DEFAULT true NOT NULL,
	"recorded_by_user_id" text,
	"created_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	"cancelled_at" timestamp (3) with time zone,
	"cancellation_reason" text,
	CONSTRAINT "disbursement_one_cost" CHECK (("expense_disbursement"."expense_id" IS NOT NULL)::int + ("expense_disbursement"."standalone_expense_id" IS NOT NULL)::int = 1),
	CONSTRAINT "disbursement_positive" CHECK ("expense_disbursement"."amount_rial" > 0)
);
--> statement-breakpoint
ALTER TABLE "expense_disbursement" ADD CONSTRAINT "expense_disbursement_building_id_building_id_fk" FOREIGN KEY ("building_id") REFERENCES "public"."building"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expense_disbursement" ADD CONSTRAINT "expense_disbursement_expense_id_expense_line_id_fk" FOREIGN KEY ("expense_id") REFERENCES "public"."expense_line"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expense_disbursement" ADD CONSTRAINT "expense_disbursement_standalone_expense_id_standalone_expense_id_fk" FOREIGN KEY ("standalone_expense_id") REFERENCES "public"."standalone_expense"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expense_disbursement" ADD CONSTRAINT "expense_disbursement_recorded_by_user_id_user_id_fk" FOREIGN KEY ("recorded_by_user_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "disbursement_building_idx" ON "expense_disbursement" USING btree ("building_id");