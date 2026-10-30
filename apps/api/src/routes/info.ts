import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { loadPlaces } from "../providers/iata.js";
import { docs } from "./util.js";
import type { Deps } from "./util.js";

const Query = z.object({ q: z.string().trim().min(1).max(50) });

export function infoRoutes(app: FastifyInstance, { ctx, registry }: Deps): void {
  app.get("/api/health", async () => ({ status: "ok" }));

  app.get("/api/providers", async () => registry.statuses);

  app.get("/api/quota", async () => ({
    travelpayouts: await ctx.guard.remaining("travelpayouts"),
    serpapi: await ctx.guard.remaining("serpapi"),
  }));

  app.get("/api/places", { schema: docs({ querystring: Query }) }, async (req) => {
    const q = Query.parse(req.query).q.toLowerCase();
    const places = await loadPlaces(ctx);
    return places
      .filter((p) => p.code.toLowerCase().startsWith(q) || p.name.toLowerCase().includes(q))
      .slice(0, 10);
  });
}
