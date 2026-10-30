import { historyStats } from "@fdw/shared";
import { and, asc, eq, gte } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { loadSettings } from "../jobs/run.js";
import { observations, watches } from "../db/schema.js";
import { ApiError, docs, IdParams } from "./util.js";
import type { Deps } from "./util.js";

const DAY_MS = 86_400_000;
const RANGES = { "30d": 30, "90d": 90, "365d": 365 };
const Query = z.object({ range: z.enum(["30d", "90d", "365d"]).default("90d") });

export function priceRoutes(app: FastifyInstance, { db, now }: Deps): void {
  app.get("/api/watches/:id/prices", { schema: docs({ querystring: Query }) }, async (req) => {
    const { id } = IdParams.parse(req.params);
    const { range } = Query.parse(req.query);
    const [w] = await db.select().from(watches).where(eq(watches.id, id));
    if (!w) throw new ApiError(404, "watch not found");
    const settings = await loadSettings(db);
    const since = new Date(now().getTime() - RANGES[range] * DAY_MS).toISOString();
    // Older rows are loaded too so the first days of the range still have their window.
    const from = new Date(Date.parse(since) - settings.medianWindowDays * DAY_MS).toISOString();
    const rows = await db
      .select()
      .from(observations)
      .where(
        and(
          eq(observations.origin, w.origin),
          eq(observations.destination, w.destination),
          gte(observations.observedAt, from),
        ),
      )
      .orderBy(asc(observations.observedAt));
    const series = rows.filter((r) => r.observedAt >= since);
    const days = [...new Set(series.map((r) => r.observedDay))];
    const stats = days.map((day) => {
      const end = new Date(`${day}T23:59:59.999Z`);
      // Sentinel month: no departure month matches, so the stats use the whole route.
      const s = historyStats(
        rows.filter((r) => r.observedAt <= end.toISOString()),
        { now: end, departMonth: "0000-00", settings },
      );
      return { day, median: s.median, p10: s.p10, sufficiency: s.sufficiency };
    });
    return {
      series: series.map(({ observedAt, amount, departDate, returnDate, source, isCached }) => ({
        observedAt,
        amount,
        departDate,
        returnDate,
        source,
        isCached,
      })),
      stats,
    };
  });
}
