import { buildApp } from "./app.js";
import { createDeps } from "./deps.js";

const deps = createDeps(process.env);
// Not awaited: Vercel's Fastify runtime intercepts listen(), and a top-level await on it
// kept module evaluation from finishing there (every request hung).
buildApp(deps)
  .listen({ port: deps.cfg.PORT, host: "0.0.0.0" })
  .catch((err: unknown) => {
    console.error(err);
    process.exit(1);
  });
