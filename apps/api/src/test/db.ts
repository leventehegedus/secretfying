import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { onTestFinished } from "vitest";
import { createDb, migrateDb } from "../db/client.js";

// File DB, not :memory:, so transaction() cannot land on a fresh empty connection.
export async function testDb() {
  const dir = mkdtempSync(join(tmpdir(), "fdw-"));
  const db = createDb(`file:${join(dir, "t.db")}`);
  onTestFinished(() => {
    db.$client.close();
    rmSync(dir, { recursive: true, force: true });
  });
  await migrateDb(db);
  return db;
}
