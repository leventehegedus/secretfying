import { index, integer, real, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

export const watches = sqliteTable("watches", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  origin: text("origin").notNull(),
  destination: text("destination").notNull(),
  monthsAhead: integer("months_ahead").notNull(),
  departFrom: text("depart_from"),
  departTo: text("depart_to"),
  minStay: integer("min_stay"),
  maxStay: integer("max_stay"),
  tripType: text("trip_type", { enum: ["oneway", "return"] }).notNull(),
  maxStops: integer("max_stops").notNull(),
  maxPrice: real("max_price"),
  active: integer("active", { mode: "boolean" }).notNull(),
  createdAt: text("created_at").notNull(),
});

export const observations = sqliteTable(
  "observations",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    source: text("source").notNull(),
    isCached: integer("is_cached", { mode: "boolean" }).notNull(),
    observedAt: text("observed_at").notNull(),
    observedDay: text("observed_day").notNull(),
    expiresAt: text("expires_at"),
    currency: text("currency").notNull(),
    amount: real("amount").notNull(),
    origin: text("origin").notNull(),
    destination: text("destination").notNull(),
    departDate: text("depart_date").notNull(),
    returnDate: text("return_date"),
    stops: integer("stops").notNull(),
    deepLink: text("deep_link"),
    market: text("market"),
  },
  (t) => [
    // SQLite treats NULLs as distinct; one-way rows are deduped by the writer upsert.
    uniqueIndex("observations_unique").on(
      t.source,
      t.origin,
      t.destination,
      t.departDate,
      t.returnDate,
      t.currency,
      t.observedDay,
    ),
    index("observations_route").on(t.origin, t.destination, t.observedAt),
  ],
);

export const deals = sqliteTable(
  "deals",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    watchId: integer("watch_id")
      .notNull()
      .references(() => watches.id, { onDelete: "cascade" }),
    routeKey: text("route_key").notNull(),
    departDate: text("depart_date").notNull(),
    returnDate: text("return_date"),
    status: text("status", { enum: ["candidate", "verified", "stale"] }).notNull(),
    reasons: text("reasons", { mode: "json" }).notNull(),
    discountPct: real("discount_pct"),
    belowMaxPct: real("below_max_pct"),
    amount: real("amount").notNull(),
    source: text("source").notNull(),
    stats: text("stats", { mode: "json" }),
    detectedAt: text("detected_at").notNull(),
    verifiedAt: text("verified_at"),
    verifyNote: text("verify_note"),
  },
  (t) => [uniqueIndex("deals_unique").on(t.watchId, t.routeKey, t.departDate, t.returnDate)],
);

export const alerts = sqliteTable(
  "alerts",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    routeKey: text("route_key").notNull(),
    departDate: text("depart_date").notNull(),
    returnDate: text("return_date"),
    amount: real("amount").notNull(),
    sentAt: text("sent_at").notNull(),
  },
  (t) => [index("alerts_lookup").on(t.routeKey, t.departDate, t.returnDate, t.sentAt)],
);

export const runs = sqliteTable("runs", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  status: text("status", { enum: ["running", "done", "failed"] }).notNull(),
  startedAt: text("started_at").notNull(),
  finishedAt: text("finished_at"),
  summary: text("summary", { mode: "json" }),
});

export const quotaLedger = sqliteTable(
  "quota_ledger",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    provider: text("provider").notNull(),
    kind: text("kind", { enum: ["discover", "verify"] }).notNull(),
    at: text("at").notNull(),
    day: text("day").notNull(),
    month: text("month").notNull(),
    status: text("status", { enum: ["reserved", "ok", "error"] }).notNull(),
    runId: integer("run_id"),
  },
  (t) => [index("quota_day").on(t.provider, t.day), index("quota_month").on(t.provider, t.month)],
);

export const providerCache = sqliteTable("provider_cache", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  key: text("key").notNull().unique(),
  json: text("json", { mode: "json" }).notNull(),
  expiresAt: text("expires_at").notNull(),
});

export const settings = sqliteTable("settings", {
  id: integer("id").primaryKey(),
  json: text("json", { mode: "json" }).notNull(),
});
