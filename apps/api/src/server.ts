import { buildApp } from "./app.js";
import { createDeps } from "./deps.js";

const deps = createDeps(process.env);
await buildApp(deps).listen({ port: deps.cfg.PORT, host: "0.0.0.0" });
