/**
 * Applies the SQL migrations in `database/migrations` to the configured
 * database (`DATABASE_URL`). Safe to run on every deploy: already-applied
 * migrations are skipped.
 *
 *   bun run db:migrate
 *
 * This uses drizzle's bun:sqlite migrator rather than `drizzle-kit migrate`,
 * so it needs no native driver and works on a server that only has Bun.
 */
import { fileURLToPath } from "node:url";
import { migrate } from "drizzle-orm/bun-sqlite/migrator";
import { db } from "./index";

migrate(db, {
  migrationsFolder: fileURLToPath(new URL("../../database/migrations", import.meta.url)),
});

console.log("[db] migrations applied");
