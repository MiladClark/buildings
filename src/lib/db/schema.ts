import { periodTypes } from "@/lib/billing/periods";
import { relations, sql } from "drizzle-orm";
import {
  check,
  index,
  integer,
  sqliteTable,
  text,
} from "drizzle-orm/sqlite-core";

export const user = sqliteTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: integer("email_verified", { mode: "boolean" })
    .notNull()
    .default(false),
  image: text("image"),
  createdAt: integer("created_at", { mode: "timestamp_ms" })
    .notNull()
    .default(sql`(unixepoch() * 1000)`),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" })
    .notNull()
    .default(sql`(unixepoch() * 1000)`),
});

export const session = sqliteTable("session", {
  id: text("id").primaryKey(),
  expiresAt: integer("expires_at", { mode: "timestamp_ms" }).notNull(),
  token: text("token").notNull().unique(),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
});

export const account = sqliteTable("account", {
  id: text("id").primaryKey(),
  accountId: text("account_id").notNull(),
  providerId: text("provider_id").notNull(),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  accessToken: text("access_token"),
  refreshToken: text("refresh_token"),
  idToken: text("id_token"),
  accessTokenExpiresAt: integer("access_token_expires_at", {
    mode: "timestamp_ms",
  }),
  refreshTokenExpiresAt: integer("refresh_token_expires_at", {
    mode: "timestamp_ms",
  }),
  scope: text("scope"),
  password: text("password"),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
});

export const verification = sqliteTable("verification", {
  id: text("id").primaryKey(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: integer("expires_at", { mode: "timestamp_ms" }).notNull(),
  createdAt: integer("created_at", { mode: "timestamp_ms" }),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }),
});

export const building = sqliteTable("building", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  address: text("address"),
  bankAccount: text("bank_account"),
  bankSheba: text("bank_sheba"),
  defaultPeriodType: text("default_period_type", {
    enum: periodTypes,
  })
    .notNull()
    .default("monthly"),
  paymentDueDay: integer("payment_due_day").notNull().default(10),
  perUnitIncludeEmpty: integer("per_unit_include_empty", { mode: "boolean" })
    .notNull()
    .default(false),
  createdAt: integer("created_at", { mode: "timestamp_ms" })
    .notNull()
    .default(sql`(unixepoch() * 1000)`),
});

export const unit = sqliteTable("unit", {
  id: text("id").primaryKey(),
  deletedAt: integer("deleted_at", { mode: "timestamp_ms" }),
  buildingId: text("building_id")
    .notNull()
    .references(() => building.id, { onDelete: "cascade" }),
  label: text("label").notNull(),
  floor: integer("floor"),
  status: text("status", {
    enum: ["occupied", "empty", "owner_occupied"],
  })
    .notNull()
    .default("occupied"),
  occupantCount: integer("occupant_count").notNull().default(1),
  temporarilyAbsent: integer("temporarily_absent", { mode: "boolean" })
    .notNull()
    .default(false),
  ownerName: text("owner_name"),
  tenantName: text("tenant_name"),
  areaSqm: integer("area_sqm"),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: integer("created_at", { mode: "timestamp_ms" })
    .notNull()
    .default(sql`(unixepoch() * 1000)`),
});

export const membership = sqliteTable("membership", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  buildingId: text("building_id")
    .notNull()
    .references(() => building.id, { onDelete: "cascade" }),
  unitId: text("unit_id").references(() => unit.id, { onDelete: "set null" }),
  role: text("role", { enum: ["manager", "resident", "accountant"] }).notNull(),
  createdAt: integer("created_at", { mode: "timestamp_ms" })
    .notNull()
    .default(sql`(unixepoch() * 1000)`),
});

export const expenseCategory = sqliteTable("expense_category", {
  id: text("id").primaryKey(),
  buildingId: text("building_id")
    .notNull()
    .references(() => building.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  slug: text("slug").notNull(),
  kind: text("kind", { enum: ["variable", "fixed"] })
    .notNull()
    .default("variable"),
  allocationMethod: text("allocation_method", {
    enum: ["per_person", "per_unit", "fixed_per_unit", "excluded"],
  }).notNull(),
  includeEmptyUnits: integer("include_empty_units", { mode: "boolean" })
    .notNull()
    .default(false),
  fixedMonthlyAmount: integer("fixed_monthly_amount"),
  inflationPercent: integer("inflation_percent").default(0),
  sortOrder: integer("sort_order").notNull().default(0),
  active: integer("active", { mode: "boolean" }).notNull().default(true),
});

export const billingPeriod = sqliteTable("billing_period", {
  id: text("id").primaryKey(),
  deletedAt: integer("deleted_at", { mode: "timestamp_ms" }),
  buildingId: text("building_id")
    .notNull()
    .references(() => building.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  periodType: text("period_type", {
    enum: periodTypes,
  }).notNull(),
  startDate: integer("start_date", { mode: "timestamp_ms" }).notNull(),
  endDate: integer("end_date", { mode: "timestamp_ms" }).notNull(),
  dueDate: integer("due_date", { mode: "timestamp_ms" }),
  status: text("status", { enum: ["draft", "finalized", "archived"] })
    .notNull()
    .default("draft"),
  finalizedAt: integer("finalized_at", { mode: "timestamp_ms" }),
  createdAt: integer("created_at", { mode: "timestamp_ms" })
    .notNull()
    .default(sql`(unixepoch() * 1000)`),
});

export const periodSnapshot = sqliteTable("period_snapshot", {
  id: text("id").primaryKey(),
  periodId: text("period_id")
    .notNull()
    .references(() => billingPeriod.id, { onDelete: "cascade" }),
  unitId: text("unit_id")
    .notNull()
    .references(() => unit.id, { onDelete: "cascade" }),
  occupantCount: integer("occupant_count").notNull(),
  temporarilyAbsent: integer("temporarily_absent", { mode: "boolean" })
    .notNull()
    .default(false),
  status: text("status", {
    enum: ["occupied", "empty", "owner_occupied"],
  }).notNull(),
});

export const expenseLine = sqliteTable("expense_line", {
  id: text("id").primaryKey(),
  deletedAt: integer("deleted_at", { mode: "timestamp_ms" }),
  periodId: text("period_id")
    .notNull()
    .references(() => billingPeriod.id, { onDelete: "cascade" }),
  categoryId: text("category_id")
    .notNull()
    .references(() => expenseCategory.id),
  maintenanceTicketId: text("maintenance_ticket_id").references(
    () => maintenanceTicket.id,
    { onDelete: "set null" },
  ),
  amountRial: integer("amount_rial").notNull(),
  coverageMonths: integer("coverage_months"),
  description: text("description"),
  expenseDate: integer("expense_date", { mode: "timestamp_ms" }).notNull(),
  attachmentPath: text("attachment_path"),
  createdAt: integer("created_at", { mode: "timestamp_ms" })
    .notNull()
    .default(sql`(unixepoch() * 1000)`),
});

/** Budget assumptions never change issued invoice lines or create a receivable. */
export const chargeBudgetPolicy = sqliteTable("charge_budget_policy", {
  categoryId: text("category_id")
    .primaryKey()
    .references(() => expenseCategory.id, { onDelete: "cascade" }),
  buildingId: text("building_id")
    .notNull()
    .references(() => building.id, { onDelete: "cascade" }),
  mode: text("mode", {
    enum: ["monthly", "bill", "reserve", "separate", "one_off"],
  }).notNull(),
  intervalMonths: integer("interval_months"),
  monthlyReserveRial: integer("monthly_reserve_rial"),
});

export const periodChargePlan = sqliteTable("period_charge_plan", {
  periodId: text("period_id")
    .primaryKey()
    .references(() => billingPeriod.id, { onDelete: "cascade" }),
  manualMonthlyRial: integer("manual_monthly_rial"),
  bufferPercent: integer("buffer_percent").notNull().default(10),
  roundToRial: integer("round_to_rial").notNull().default(500000),
});

export const unitInvoice = sqliteTable("unit_invoice", {
  id: text("id").primaryKey(),
  periodId: text("period_id")
    .notNull()
    .references(() => billingPeriod.id, { onDelete: "cascade" }),
  unitId: text("unit_id")
    .notNull()
    .references(() => unit.id, { onDelete: "cascade" }),
  subtotalRial: integer("subtotal_rial").notNull(),
  previousBalanceRial: integer("previous_balance_rial").notNull().default(0),
  totalRial: integer("total_rial").notNull(),
  paidRial: integer("paid_rial").notNull().default(0),
  legacyPaidRial: integer("legacy_paid_rial").notNull().default(0),
  balanceRial: integer("balance_rial").notNull(),
  createdAt: integer("created_at", { mode: "timestamp_ms" })
    .notNull()
    .default(sql`(unixepoch() * 1000)`),
});

export const invoiceLineItem = sqliteTable("invoice_line_item", {
  id: text("id").primaryKey(),
  invoiceId: text("invoice_id")
    .notNull()
    .references(() => unitInvoice.id, { onDelete: "cascade" }),
  categoryId: text("category_id").references(() => expenseCategory.id),
  title: text("title").notNull(),
  basis: text("basis"),
  amountRial: integer("amount_rial").notNull(),
  sortOrder: integer("sort_order").notNull().default(0),
});

export const payment = sqliteTable("payment", {
  id: text("id").primaryKey(),
  deletedAt: integer("deleted_at", { mode: "timestamp_ms" }),
  buildingId: text("building_id")
    .notNull()
    .references(() => building.id, { onDelete: "cascade" }),
  unitId: text("unit_id")
    .notNull()
    .references(() => unit.id, { onDelete: "cascade" }),
  periodId: text("period_id").references(() => billingPeriod.id),
  categoryId: text("category_id").references(() => expenseCategory.id),
  allocationTracked: integer("allocation_tracked", { mode: "boolean" })
    .notNull()
    .default(false),
  receiptKey: text("receipt_key").unique(),
  amountRial: integer("amount_rial").notNull(),
  method: text("method", {
    enum: ["bank_transfer", "cash", "other"],
  }).notNull(),
  paidAt: integer("paid_at", { mode: "timestamp_ms" }).notNull(),
  note: text("note"),
  recordedByUserId: text("recorded_by_user_id").references(() => user.id),
  createdAt: integer("created_at", { mode: "timestamp_ms" })
    .notNull()
    .default(sql`(unixepoch() * 1000)`),
});

export const paymentRequest = sqliteTable("payment_request", {
  id: text("id").primaryKey(),
  deletedAt: integer("deleted_at", { mode: "timestamp_ms" }),
  unitId: text("unit_id")
    .notNull()
    .references(() => unit.id, { onDelete: "cascade" }),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  amountRial: integer("amount_rial").notNull(),
  periodId: text("period_id").references(() => billingPeriod.id),
  categoryId: text("category_id").references(() => expenseCategory.id),
  status: text("status", { enum: ["pending", "approved", "rejected"] })
    .notNull()
    .default("pending"),
  note: text("note"),
  createdAt: integer("created_at", { mode: "timestamp_ms" })
    .notNull()
    .default(sql`(unixepoch() * 1000)`),
});

// An application reserves money against one cost, including before invoice issue.
// A null source denotes credit predating this ledger, preserved by legacyPaidRial.
export const paymentApplication = sqliteTable(
  "payment_application",
  {
    id: text("id").primaryKey(),
    unitId: text("unit_id")
      .notNull()
      .references(() => unit.id, { onDelete: "cascade" }),
    periodId: text("period_id")
      .notNull()
      .references(() => billingPeriod.id),
    categoryId: text("category_id").references(() => expenseCategory.id),
    paymentId: text("payment_id").references(() => payment.id),
    amountRial: integer("amount_rial").notNull(),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
  },
  (t) => [check("positive_application", sql`${t.amountRial} > 0`)],
);

export const appNotification = sqliteTable("app_notification", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  body: text("body").notNull(),
  read: integer("read", { mode: "boolean" }).notNull().default(false),
  createdAt: integer("created_at", { mode: "timestamp_ms" })
    .notNull()
    .default(sql`(unixepoch() * 1000)`),
});

export const chatMessage = sqliteTable(
  "chat_message",
  {
    id: text("id").primaryKey(),
    buildingId: text("building_id")
      .notNull()
      .references(() => building.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    body: text("body").notNull().default(""),
    imageKey: text("image_key"),
    imageMimeType: text("image_mime_type"),
    imageName: text("image_name"),
    editedAt: integer("edited_at", { mode: "timestamp_ms" }),
    deletedAt: integer("deleted_at", { mode: "timestamp_ms" }),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
  },
  (t) => [
    index("idx_chat_message_building_created").on(t.buildingId, t.createdAt),
    index("idx_chat_message_user").on(t.userId),
  ],
);

export const chargeRecommendation = sqliteTable("charge_recommendation", {
  id: text("id").primaryKey(),
  buildingId: text("building_id")
    .notNull()
    .references(() => building.id, { onDelete: "cascade" }),
  monthsWindow: integer("months_window").notNull(),
  suggestedMonthlyRial: integer("suggested_monthly_rial").notNull(),
  breakdownJson: text("breakdown_json").notNull(),
  computedAt: integer("computed_at", { mode: "timestamp_ms" }).notNull(),
});

export const rateAdjustment = sqliteTable("rate_adjustment", {
  id: text("id").primaryKey(),
  categoryId: text("category_id")
    .notNull()
    .references(() => expenseCategory.id, { onDelete: "cascade" }),
  previousValue: integer("previous_value"),
  newValue: integer("new_value"),
  percentChange: integer("percent_change"),
  reason: text("reason"),
  adjustedByUserId: text("adjusted_by_user_id").references(() => user.id),
  createdAt: integer("created_at", { mode: "timestamp_ms" })
    .notNull()
    .default(sql`(unixepoch() * 1000)`),
});

export const maintenanceTicket = sqliteTable("maintenance_ticket", {
  id: text("id").primaryKey(),
  deletedAt: integer("deleted_at", { mode: "timestamp_ms" }),
  buildingId: text("building_id")
    .notNull()
    .references(() => building.id, { onDelete: "cascade" }),
  unitId: text("unit_id").references(() => unit.id, { onDelete: "set null" }),
  createdBy: text("created_by")
    .notNull()
    .references(() => user.id),
  title: text("title").notNull(),
  description: text("description"),
  priority: text("priority", { enum: ["normal", "urgent"] })
    .notNull()
    .default("normal"),
  status: text("status", { enum: ["open", "in_progress", "resolved"] })
    .notNull()
    .default("open"),
  scheduledAt: integer("scheduled_at", { mode: "timestamp_ms" }),
  createdAt: integer("created_at", { mode: "timestamp_ms" })
    .notNull()
    .default(sql`(unixepoch() * 1000)`),
});

export const buildingRelations = relations(building, ({ many }) => ({
  units: many(unit),
  categories: many(expenseCategory),
  periods: many(billingPeriod),
}));

export const unitRelations = relations(unit, ({ one, many }) => ({
  building: one(building, {
    fields: [unit.buildingId],
    references: [building.id],
  }),
  invoices: many(unitInvoice),
}));

/** Manager corrections are reversible; snapshots retain the original financial evidence. */
export const managementEvent = sqliteTable("management_event", {
  id: text("id").primaryKey(),
  buildingId: text("building_id")
    .notNull()
    .references(() => building.id, { onDelete: "cascade" }),
  actorId: text("actor_id").references(() => user.id, { onDelete: "set null" }),
  entityType: text("entity_type").notNull(),
  entityId: text("entity_id").notNull(),
  action: text("action").notNull(),
  label: text("label").notNull(),
  beforeJson: text("before_json"),
  afterJson: text("after_json"),
  createdAt: integer("created_at", { mode: "timestamp_ms" })
    .notNull()
    .default(sql`(unixepoch() * 1000)`),
});
