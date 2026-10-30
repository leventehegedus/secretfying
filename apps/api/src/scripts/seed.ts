import { createDeps } from "../deps.js";
import { seedWatches } from "../services/seed.js";

const { db } = createDeps(process.env);
await seedWatches(db, new Date());
db.$client.close();
