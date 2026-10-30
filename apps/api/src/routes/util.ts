import type { FastifyInstance } from "fastify";
import { z, ZodError } from "zod";
import type { RunDeps } from "../jobs/run.js";

export type Deps = RunDeps;

export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

// Route schemas for /docs only; Zod in the handlers is the single validator.
export const docs = (parts: Partial<Record<"body" | "querystring" | "params", z.ZodType>>) =>
  Object.fromEntries(
    Object.entries(parts).map(([k, s]) => [
      k,
      z.toJSONSchema(s, { io: "input", unrepresentable: "any" }),
    ]),
  );

export const IdParams = z.object({ id: z.coerce.number().int().positive() });

export function registerErrors(app: FastifyInstance): void {
  app.setErrorHandler((err, req, reply) => {
    if (err instanceof ZodError) {
      const issues = err.issues.map((i) => ({ path: i.path.join("."), message: i.message }));
      return reply.code(400).send({ error: "invalid_request", issues });
    }
    if (err instanceof ApiError) return reply.code(err.status).send({ error: err.message });
    const e = err instanceof Error ? err : new Error("unknown");
    const status = "statusCode" in e && typeof e.statusCode === "number" ? e.statusCode : 500;
    if (status >= 500) req.log.error(err);
    return reply.code(status).send({ error: status >= 500 ? "internal_error" : e.message });
  });
}
