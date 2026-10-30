import { periodTypes } from "@/lib/billing/periods";
import { relations, sql } from "drizzle-orm";
import {
  check,
  index,
  integer,
  pgTable,
  boolean,
  timestamp,
  bigint,
  jsonb,
  text,
} from "drizzle-orm/pg-core";

export const user = pgTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  phone: text("phone").unique(),
  emailVerified: boolean("email_verified").notNull().default(false),
  image: text("image"),
  createdAt: timestamp("created_at", {
    withTimezone: true,
    mode: "date",
    precision: 3,
  })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", {
    withTimezone: true,
    mode: "date",
    precision: 3,
  })
    .notNull()
    .defaultNow(),
});

export const session = pgTable("session", {
  id: text("id").primaryKey(),
  expiresAt: timestamp("expires_at", {
    withTimezone: true,
    mode: "date",
    precision: 3,
  }).notNull(),
  token: text("token").notNull().unique(),
  createdAt: timestamp("created_at", {
    withTimezone: true,
    mode: "date",
    precision: 3,
  }).notNull(),
  updatedAt: timestamp("updated_at", {
    withTimezone: true,
    mode: "date",
    precision: 3,
  }).notNull(),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
});

export const account = pgTable("account", {
  id: text("id").primaryKey(),
  accountId: text("account_id").notNull(),
  providerId: text("provider_id").notNull(),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  accessToken: text("access_token"),
  refreshToken: text("refresh_token"),
  idToken: text("id_token"),
  accessTokenExpiresAt: timestamp("access_token_expires_at", {
    withTimezone: true,
    mode: "date",
    precision: 3,
  }),
  refreshTokenExpiresAt: timestamp("refresh_token_expires_at", {
    withTimezone: true,
    mode: "date",
    precision: 3,
  }),
  scope: text("scope"),
  password: text("password"),
  createdAt: timestamp("created_at", {
    withTimezone: true,
    mode: "date",
    precision: 3,
  }).notNull(),
  updatedAt: timestamp("updated_at", {
    withTimezone: true,
    mode: "date",
    precision: 3,
  }).notNull(),
});

export const verification = pgTable("verification", {
  id: text("id").primaryKey(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: timestamp("expires_at", {
    withTimezone: true,
    mode: "date",
    precision: 3,
  }).notNull(),
  createdAt: timestamp("created_at", {
    withTimezone: true,
    mode: "date",
    precision: 3,
  }),
  updatedAt: timestamp("updated_at", {
    withTimezone: true,
    mode: "date",
    precision: 3,
  }),
});

export const building = pgTable("building", {
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
  perUnitIncludeEmpty: boolean("per_unit_include_empty")
    .notNull()
    .default(false),
  googleSignInEnabled: boolean("google_sign_in_enabled")
    .notNull()
    .default(true),
  createdAt: timestamp("created_at", {
    withTimezone: true,
    mode: "date",
    precision: 3,
  })
    .notNull()
    .defaultNow(),
});

export const unit = pgTable("unit", {
  id: text("id").primaryKey(),
  deletedAt: timestamp("deleted_at", {
    withTimezone: true,
    mode: "date",
    precision: 3,
  }),
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
  temporarilyAbsent: boolean("temporarily_absent").notNull().default(false),
  ownerName: text("owner_name"),
  tenantName: text("tenant_name"),
  areaSqm: integer("area_sqm"),
  sortOrder: bigint("sort_order", { mode: "number" }).notNull().default(0),
  createdAt: timestamp("created_at", {
    withTimezone: true,
    mode: "date",
    precision: 3,
  })
    .notNull()
    .defaultNow(),
});

export const membership = pgTable("membership", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  buildingId: text("building_id")
    .notNull()
    .references(() => building.id, { onDelete: "cascade" }),
  unitId: text("unit_id").references(() => unit.id, { onDelete: "set null" }),
  role: text("role", { enum: ["manager", "resident", "accountant"] }).notNull(),
  createdAt: timestamp("created_at", {
    withTimezone: true,
    mode: "date",
    precision: 3,
  })
    .notNull()
    .defaultNow(),
});

export const expenseCategory = pgTable("expense_category", {
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
  includeEmptyUnits: boolean("include_empty_units").notNull().default(false),
  fixedMonthlyAmount: bigint("fixed_monthly_amount", { mode: "number" }),
  inflationPercent: integer("inflation_percent").default(0),
  sortOrder: bigint("sort_order", { mode: "number" }).notNull().default(0),
  active: boolean("active").notNull().default(true),
});

export const billingPeriod = pgTable("billing_period", {
  id: text("id").primaryKey(),
  deletedAt: timestamp("deleted_at", {
    withTimezone: true,
    mode: "date",
    precision: 3,
  }),
  buildingId: text("building_id")
    .notNull()
    .references(() => building.id, { onDelete: "cascade" }),
  chargeModel: text("charge_model", { enum: ["direct", "fund"] })
    .notNull()
    .default("direct"),
  title: text("title").notNull(),
  periodType: text("period_type", {
    enum: periodTypes,
  }).notNull(),
  startDate: timestamp("start_date", {
    withTimezone: true,
    mode: "date",
    precision: 3,
  }).notNull(),
  endDate: timestamp("end_date", {
    withTimezone: true,
    mode: "date",
    precision: 3,
  }).notNull(),
  dueDate: timestamp("due_date", {
    withTimezone: true,
    mode: "date",
    precision: 3,
  }),
  status: text("status", { enum: ["draft", "finalized", "archived"] })
    .notNull()
    .default("draft"),
  finalizedAt: timestamp("finalized_at", {
    withTimezone: true,
    mode: "date",
    precision: 3,
  }),
  createdAt: timestamp("created_at", {
    withTimezone: true,
    mode: "date",
    precision: 3,
  })
    .notNull()
    .defaultNow(),
});

export const periodSnapshot = pgTable("period_snapshot", {
  id: text("id").primaryKey(),
  periodId: text("period_id")
    .notNull()
    .references(() => billingPeriod.id, { onDelete: "cascade" }),
  unitId: text("unit_id")
    .notNull()
    .references(() => unit.id, { onDelete: "cascade" }),
  occupantCount: integer("occupant_count").notNull(),
  temporarilyAbsent: boolean("temporarily_absent").notNull().default(false),
  status: text("status", {
    enum: ["occupied", "empty", "owner_occupied"],
  }).notNull(),
});

export const expenseLine = pgTable("expense_line", {
  id: text("id").primaryKey(),
  deletedAt: timestamp("deleted_at", {
    withTimezone: true,
    mode: "date",
    precision: 3,
  }),
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
  amountRial: bigint("amount_rial", { mode: "number" }).notNull(),
  billingTreatment: text("billing_treatment", { enum: ["auto", "separate"] })
    .notNull()
    .default("auto"),
  coverageMonths: integer("coverage_months"),
  sourceStandaloneId: text("source_standalone_id"),
  description: text("description"),
  expenseDate: timestamp("expense_date", {
    withTimezone: true,
    mode: "date",
    precision: 3,
  }).notNull(),
  attachmentPath: text("attachment_path"),
  createdAt: timestamp("created_at", {
    withTimezone: true,
    mode: "date",
    precision: 3,
  })
    .notNull()
    .defaultNow(),
});

/** Budget assumptions never change issued invoice lines or create a receivable. */
export const chargeBudgetPolicy = pgTable("charge_budget_policy", {
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
  monthlyReserveRial: bigint("monthly_reserve_rial", { mode: "number" }),
});

export const periodChargePlan = pgTable("period_charge_plan", {
  periodId: text("period_id")
    .primaryKey()
    .references(() => billingPeriod.id, { onDelete: "cascade" }),
  manualMonthlyRial: bigint("manual_monthly_rial", { mode: "number" }),
  cleaningVisitRial: bigint("cleaning_visit_rial", { mode: "number" }),
  cleaningEveryDays: integer("cleaning_every_days").notNull().default(30),
  bufferPercent: integer("buffer_percent").notNull().default(10),
  roundToRial: bigint("round_to_rial", { mode: "number" })
    .notNull()
    .default(500000),
});

// Recorded costs held outside billing until the manager explicitly includes them.
export const standaloneExpense = pgTable("standalone_expense", {
  id: text("id").primaryKey(),
  buildingId: text("building_id")
    .notNull()
    .references(() => building.id),
  categoryId: text("category_id")
    .notNull()
    .references(() => expenseCategory.id),
  description: text("description").notNull(),
  amountRial: bigint("amount_rial", { mode: "number" }).notNull(),
  expenseDate: timestamp("expense_date", {
    withTimezone: true,
    mode: "date",
    precision: 3,
  }).notNull(),
  maintenanceTicketId: text("maintenance_ticket_id").references(
    () => maintenanceTicket.id,
  ),
  linkedExpenseId: text("linked_expense_id")
    .unique()
    .references(() => expenseLine.id),
  deletedAt: timestamp("deleted_at", {
    withTimezone: true,
    mode: "date",
    precision: 3,
  }),
  createdAt: timestamp("created_at", {
    withTimezone: true,
    mode: "date",
    precision: 3,
  })
    .notNull()
    .defaultNow(),
});

/** Actual money leaving the building fund. Billing and receipts remain separate. */
export const expenseDisbursement = pgTable(
  "expense_disbursement",
  {
    id: text("id").primaryKey(),
    buildingId: text("building_id")
      .notNull()
      .references(() => building.id),
    expenseId: text("expense_id").references(() => expenseLine.id),
    standaloneExpenseId: text("standalone_expense_id").references(
      () => standaloneExpense.id,
    ),
    amountRial: bigint("amount_rial", { mode: "number" }).notNull(),
    payee: text("payee").notNull(),
    paidAt: timestamp("paid_at", {
      withTimezone: true,
      mode: "date",
      precision: 3,
    }).notNull(),
    method: text("method", {
      enum: ["bank_transfer", "cash", "other"],
    }).notNull(),
    reference: text("reference"),
    note: text("note"),
    items: jsonb("items")
      .$type<{ description: string; amountRial: number }[]>()
      .notNull()
      .default([]),
    finalPayment: boolean("final_payment").notNull().default(true),
    recordedByUserId: text("recorded_by_user_id").references(() => user.id),
    createdAt: timestamp("created_at", {
      withTimezone: true,
      mode: "date",
      precision: 3,
    })
      .notNull()
      .defaultNow(),
    cancelledAt: timestamp("cancelled_at", {
      withTimezone: true,
      mode: "date",
      precision: 3,
    }),
    cancellationReason: text("cancellation_reason"),
  },
  (t) => [
    check(
      "disbursement_one_cost",
      sql`(${t.expenseId} IS NOT NULL)::int + (${t.standaloneExpenseId} IS NOT NULL)::int = 1`,
    ),
    check("disbursement_positive", sql`${t.amountRial} > 0`),
    index("disbursement_building_idx").on(t.buildingId),
  ],
);

export const unitInvoice = pgTable("unit_invoice", {
  id: text("id").primaryKey(),
  periodId: text("period_id")
    .notNull()
    .references(() => billingPeriod.id, { onDelete: "cascade" }),
  unitId: text("unit_id")
    .notNull()
    .references(() => unit.id, { onDelete: "cascade" }),
  subtotalRial: bigint("subtotal_rial", { mode: "number" }).notNull(),
  previousBalanceRial: bigint("previous_balance_rial", { mode: "number" })
    .notNull()
    .default(0),
  totalRial: bigint("total_rial", { mode: "number" }).notNull(),
  paidRial: bigint("paid_rial", { mode: "number" }).notNull().default(0),
  legacyPaidRial: bigint("legacy_paid_rial", { mode: "number" })
    .notNull()
    .default(0),
  balanceRial: bigint("balance_rial", { mode: "number" }).notNull(),
  createdAt: timestamp("created_at", {
    withTimezone: true,
    mode: "date",
    precision: 3,
  })
    .notNull()
    .defaultNow(),
});

export const invoiceLineItem = pgTable("invoice_line_item", {
  id: text("id").primaryKey(),
  invoiceId: text("invoice_id")
    .notNull()
    .references(() => unitInvoice.id, { onDelete: "cascade" }),
  categoryId: text("category_id").references(() => expenseCategory.id),
  title: text("title").notNull(),
  basis: text("basis"),
  amountRial: bigint("amount_rial", { mode: "number" }).notNull(),
  sortOrder: bigint("sort_order", { mode: "number" }).notNull().default(0),
});

export const payment = pgTable("payment", {
  id: text("id").primaryKey(),
  deletedAt: timestamp("deleted_at", {
    withTimezone: true,
    mode: "date",
    precision: 3,
  }),
  buildingId: text("building_id")
    .notNull()
    .references(() => building.id, { onDelete: "cascade" }),
  unitId: text("unit_id")
    .notNull()
    .references(() => unit.id, { onDelete: "cascade" }),
  periodId: text("period_id").references(() => billingPeriod.id),
  categoryId: text("category_id").references(() => expenseCategory.id),
  standaloneExpenseId: text("standalone_expense_id").references(
    () => standaloneExpense.id,
  ),
  kind: text("kind", { enum: ["receipt", "advance"] })
    .notNull()
    .default("receipt"),
  allocationTracked: boolean("allocation_tracked").notNull().default(false),
  receiptKey: text("receipt_key").unique(),
  amountRial: bigint("amount_rial", { mode: "number" }).notNull(),
  method: text("method", {
    enum: ["bank_transfer", "cash", "other"],
  }).notNull(),
  paidAt: timestamp("paid_at", {
    withTimezone: true,
    mode: "date",
    precision: 3,
  }).notNull(),
  note: text("note"),
  recordedByUserId: text("recorded_by_user_id").references(() => user.id),
  createdAt: timestamp("created_at", {
    withTimezone: true,
    mode: "date",
    precision: 3,
  })
    .notNull()
    .defaultNow(),
});

export const paymentRequest = pgTable("payment_request", {
  id: text("id").primaryKey(),
  deletedAt: timestamp("deleted_at", {
    withTimezone: true,
    mode: "date",
    precision: 3,
  }),
  unitId: text("unit_id")
    .notNull()
    .references(() => unit.id, { onDelete: "cascade" }),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  amountRial: bigint("amount_rial", { mode: "number" }).notNull(),
  periodId: text("period_id").references(() => billingPeriod.id),
  categoryId: text("category_id").references(() => expenseCategory.id),
  status: text("status", { enum: ["pending", "approved", "rejected"] })
    .notNull()
    .default("pending"),
  note: text("note"),
  createdAt: timestamp("created_at", {
    withTimezone: true,
    mode: "date",
    precision: 3,
  })
    .notNull()
    .defaultNow(),
});

// An application reserves money against one cost, including before invoice issue.
// A null source denotes credit predating this ledger, preserved by legacyPaidRial.
export const paymentApplication = pgTable(
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
    amountRial: bigint("amount_rial", { mode: "number" }).notNull(),
    createdAt: timestamp("created_at", {
      withTimezone: true,
      mode: "date",
      precision: 3,
    })
      .notNull()
      .defaultNow(),
  },
  (t) => [check("positive_application", sql`${t.amountRial} > 0`)],
);

export const appNotification = pgTable("app_notification", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  body: text("body").notNull(),
  read: boolean("read").notNull().default(false),
  createdAt: timestamp("created_at", {
    withTimezone: true,
    mode: "date",
    precision: 3,
  })
    .notNull()
    .defaultNow(),
});

export const chatMessage = pgTable(
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
    editedAt: timestamp("edited_at", {
      withTimezone: true,
      mode: "date",
      precision: 3,
    }),
    deletedAt: timestamp("deleted_at", {
      withTimezone: true,
      mode: "date",
      precision: 3,
    }),
    createdAt: timestamp("created_at", {
      withTimezone: true,
      mode: "date",
      precision: 3,
    })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("idx_chat_message_building_created").on(t.buildingId, t.createdAt),
    index("idx_chat_message_user").on(t.userId),
  ],
);

export const chargeRecommendation = pgTable("charge_recommendation", {
  id: text("id").primaryKey(),
  buildingId: text("building_id")
    .notNull()
    .references(() => building.id, { onDelete: "cascade" }),
  monthsWindow: integer("months_window").notNull(),
  suggestedMonthlyRial: bigint("suggested_monthly_rial", {
    mode: "number",
  }).notNull(),
  breakdownJson: text("breakdown_json").notNull(),
  computedAt: timestamp("computed_at", {
    withTimezone: true,
    mode: "date",
    precision: 3,
  }).notNull(),
});

export const rateAdjustment = pgTable("rate_adjustment", {
  id: text("id").primaryKey(),
  categoryId: text("category_id")
    .notNull()
    .references(() => expenseCategory.id, { onDelete: "cascade" }),
  previousValue: bigint("previous_value", { mode: "number" }),
  newValue: bigint("new_value", { mode: "number" }),
  percentChange: integer("percent_change"),
  reason: text("reason"),
  adjustedByUserId: text("adjusted_by_user_id").references(() => user.id),
  createdAt: timestamp("created_at", {
    withTimezone: true,
    mode: "date",
    precision: 3,
  })
    .notNull()
    .defaultNow(),
});

export const maintenanceTicket = pgTable("maintenance_ticket", {
  id: text("id").primaryKey(),
  deletedAt: timestamp("deleted_at", {
    withTimezone: true,
    mode: "date",
    precision: 3,
  }),
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
  scheduledAt: timestamp("scheduled_at", {
    withTimezone: true,
    mode: "date",
    precision: 3,
  }),
  createdAt: timestamp("created_at", {
    withTimezone: true,
    mode: "date",
    precision: 3,
  })
    .notNull()
    .defaultNow(),
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
export const managementEvent = pgTable("management_event", {
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
  createdAt: timestamp("created_at", {
    withTimezone: true,
    mode: "date",
    precision: 3,
  })
    .notNull()
    .defaultNow(),
});
