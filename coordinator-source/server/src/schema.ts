import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const plans = sqliteTable("plans", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  title: text("title").notNull(),
  headcount: integer("headcount").notNull(),
  budgetCents: integer("budget_cents").notNull(),
  currency: text("currency").notNull().default("USD"),
  totalCents: integer("total_cents").notNull(),
  verdict: text("verdict", { enum: ["under", "over", "exact"] }).notNull(),
  inputsJson: text("inputs_json").notNull(),
  planJson: text("plan_json").notNull(),
  createdAt: integer("created_at", { mode: "timestamp_ms" })
    .notNull()
    .$defaultFn(() => new Date()),
});
