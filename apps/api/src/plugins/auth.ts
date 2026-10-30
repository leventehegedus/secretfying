import { createHash, timingSafeEqual } from "node:crypto";
import type { FastifyInstance } from "fastify";
import { ApiError } from "../routes/util.js";

const digest = (s: string) => createHash("sha256").update(s).digest();

// Hashing first makes the compare constant-time and length-independent.
export const bearerOk = (header: string | undefined, secret: string): boolean =>
  timingSafeEqual(digest(header ?? ""), digest(`Bearer ${secret}`));

const MUTATING = new Set(["POST", "PUT", "DELETE"]);

export function registerAuth(app: FastifyInstance, apiToken: string | undefined): void {
  if (!apiToken) return;
  app.addHook("onRequest", async (req) => {
    if (MUTATING.has(req.method) && !bearerOk(req.headers.authorization, apiToken)) {
      throw new ApiError(401, "unauthorized");
    }
  });
}
