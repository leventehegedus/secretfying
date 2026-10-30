import { WatchInput } from "@fdw/shared";
import { eq } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import { ZodError } from "zod";
import { watches } from "../db/schema.js";
import { loadIataCodes } from "../providers/iata.js";
import { toRow, toWatch } from "../services/watches.js";
import { ApiError, docs, IdParams } from "./util.js";
import type { Deps } from "./util.js";

export function watchRoutes(app: FastifyInstance, { db, ctx, now }: Deps): void {
  async function parseInput(raw: unknown): Promise<WatchInput> {
    const w = WatchInput.parse(raw);
    const codes = await loadIataCodes(ctx);
    const unknown = (["origin", "destination"] as const).filter(
      (k) => !codes.has(w[k]) && !(k === "destination" && w[k] === "ANYWHERE"),
    );
    if (unknown.length === 0) return w;
    throw new ZodError(
      unknown.map((k) => ({
        code: "custom",
        path: [k],
        message: "unknown IATA code",
        input: w[k],
      })),
    );
  }

  app.get("/api/watches", async () => (await db.select().from(watches)).map(toWatch));

  app.post("/api/watches", { schema: docs({ body: WatchInput }) }, async (req, reply) => {
    const w = await parseInput(req.body);
    const [row] = await db
      .insert(watches)
      .values({ ...toRow(w), createdAt: now().toISOString() })
      .returning();
    return reply.code(201).send(row && toWatch(row));
  });

  app.put("/api/watches/:id", { schema: docs({ body: WatchInput }) }, async (req) => {
    const { id } = IdParams.parse(req.params);
    const w = await parseInput(req.body);
    const [row] = await db.update(watches).set(toRow(w)).where(eq(watches.id, id)).returning();
    if (!row) throw new ApiError(404, "watch not found");
    return toWatch(row);
  });

  app.delete("/api/watches/:id", async (req, reply) => {
    const { id } = IdParams.parse(req.params);
    const gone = await db.delete(watches).where(eq(watches.id, id)).returning({ id: watches.id });
    if (gone.length === 0) throw new ApiError(404, "watch not found");
    return reply.code(204).send();
  });
}
