import type { FastifyInstance } from "fastify";
import type { Deps } from "./util.js";

export function notifyRoutes(app: FastifyInstance, { notifiers }: Deps): void {
  app.post("/api/notify/test", async () => {
    const message = {
      subject: "Flight Deal Watcher",
      text: "Test notification: the channel works.",
    };
    const channels = [];
    for (const n of notifiers) {
      try {
        await n.send(message);
        channels.push({ name: n.name, ok: true });
      } catch (e) {
        channels.push({
          name: n.name,
          ok: false,
          error: e instanceof Error ? e.message : "failed",
        });
      }
    }
    return { channels };
  });
}
