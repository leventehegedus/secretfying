import { createDeps } from "../deps.js";
import { runOnce } from "../jobs/run.js";

const deps = createDeps(process.env);
const r = await runOnce(deps);
deps.db.$client.close();
console.log(JSON.stringify(r.ok ? r.summary : r));
process.exitCode = r.ok && r.status === "done" ? 0 : 1;
