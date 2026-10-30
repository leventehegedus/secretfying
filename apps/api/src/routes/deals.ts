import { Deal, DealStatus, IsoDate } from "@fdw/shared";
import { and, desc, eq, gte, lte } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { deals } from "../db/schema.js";
import { docs } from "./util.js";
import type { Deps } from "./util.js";

const Query = z.object({
  status: DealStatus.optional(),
  from: IsoDate.optional(),
  to: IsoDate.optional(),
});

export function dealRoutes(app: FastifyInstance, { db }: Deps): void {
  app.get("/api/deals", { schema: docs({ querystring: Query }) }, async (req) => {
    const q = Query.parse(req.query);
    const rows = await db
      .select()
      .from(deals)
      .where(
        and(
          q.status ? eq(deals.status, q.status) : undefined,
          q.from ? gte(deals.detectedAt, `${q.from}T00:00:00.000Z`) : undefined,
          q.to ? lte(deals.detectedAt, `${q.to}T23:59:59.999Z`) : undefined,
        ),
      )
      .orderBy(desc(deals.detectedAt));
    return rows.map((r) => {
      const [origin, destination, tripType] = r.routeKey.split("-");
      return Deal.parse({ ...r, origin, destination, tripType });
    });
  });
}
