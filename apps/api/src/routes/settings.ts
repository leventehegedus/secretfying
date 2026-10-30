import { Settings } from "@fdw/shared";
import type { FastifyInstance } from "fastify";
import { settings } from "../db/schema.js";
import { loadSettings } from "../jobs/run.js";
import { docs } from "./util.js";
import type { Deps } from "./util.js";

export function settingsRoutes(app: FastifyInstance, { db }: Deps): void {
  app.get("/api/settings", () => loadSettings(db));

  app.put("/api/settings", { schema: docs({ body: Settings }) }, async (req) => {
    const json = Settings.parse(req.body);
    await db
      .insert(settings)
      .values({ id: 1, json })
      .onConflictDoUpdate({ target: settings.id, set: { json } });
    return json;
  });
}
