import { desc } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import { runs } from "../db/schema.js";
import { runOnce } from "../jobs/run.js";
import { bearerOk } from "../plugins/auth.js";
import { ApiError } from "./util.js";
import type { Deps } from "./util.js";

const MIN_GAP_MS = 60_000;

export function refreshRoutes(app: FastifyInstance, deps: Deps): void {
  const { db, cfg, now } = deps;
  let last = 0;

  async function trigger() {
    const r = await runOnce(deps);
    if (!r.ok) throw new ApiError(409, "a run is already in progress");
    return { runId: r.runId, status: r.status, summary: r.summary };
  }

  // shortcut: in-memory limit is per instance, so serverless instances do not share it.
  app.post("/api/refresh", async () => {
    if (now().getTime() - last < MIN_GAP_MS) throw new ApiError(429, "refresh limited to 1/min");
    last = now().getTime();
    return trigger();
  });

  app.get("/api/refresh/status", async () => {
    const [row] = await db.select().from(runs).orderBy(desc(runs.id)).limit(1);
    return row ?? null;
  });

  app.get("/api/cron/run", async (req) => {
    if (!cfg.CRON_SECRET) throw new ApiError(503, "CRON_SECRET is not configured");
    if (!bearerOk(req.headers.authorization, cfg.CRON_SECRET)) {
      throw new ApiError(401, "unauthorized");
    }
    return trigger();
  });
}
