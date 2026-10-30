import swagger from "@fastify/swagger";
import swaggerUi from "@fastify/swagger-ui";
import Fastify from "fastify";
import type { FastifyInstance } from "fastify";
import { registerAuth } from "./plugins/auth.js";
import { dealRoutes } from "./routes/deals.js";
import { infoRoutes } from "./routes/info.js";
import { notifyRoutes } from "./routes/notify.js";
import { priceRoutes } from "./routes/prices.js";
import { refreshRoutes } from "./routes/refresh.js";
import { settingsRoutes } from "./routes/settings.js";
import { registerErrors } from "./routes/util.js";
import type { Deps } from "./routes/util.js";
import { watchRoutes } from "./routes/watches.js";

export function buildApp(deps: Deps): FastifyInstance {
  const app = Fastify({
    logger: {
      level: deps.cfg.LOG_LEVEL,
      redact: [
        "req.headers.authorization",
        "req.headers.cookie",
        "*.token",
        "*.key",
        "*.apiKey",
        "*.api_key",
        "*.secret",
      ],
    },
  });
  // Zod in the handlers is the only validator; Fastify's ajv stays out of the way.
  app.setValidatorCompiler(() => () => true);
  registerErrors(app);
  registerAuth(app, deps.cfg.API_TOKEN, deps.cfg.VERCEL_ENV === "production");
  app.register(swagger, { openapi: { info: { title: "Flight Deal Watcher", version: "0.1.0" } } });
  app.register(swaggerUi, { routePrefix: "/docs" });
  app.register(async (a) => {
    for (const routes of [
      infoRoutes,
      watchRoutes,
      dealRoutes,
      priceRoutes,
      settingsRoutes,
      refreshRoutes,
      notifyRoutes,
    ]) {
      routes(a, deps);
    }
  });
  return app;
}
