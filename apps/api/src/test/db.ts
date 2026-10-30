import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createDb, migrateDb } from "../db/client.js";

// File DB, not :memory:, so transaction() cannot land on a fresh empty connection.
export async function testDb() {
  const db = createDb(`file:${join(mkdtempSync(join(tmpdir(), "fdw-")), "t.db")}`);
  await migrateDb(db);
  return db;
}
