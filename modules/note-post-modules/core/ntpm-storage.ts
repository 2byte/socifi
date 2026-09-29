/**
 * NTPM Module Storage
 *
 * Generic SQLite storage for NTPM modules.
 * Each module gets its own table via the `module_slug` column.
 * Data is stored as JSON text in the `payload` column.
 */

import { drizzle } from "drizzle-orm/bun-sqlite";
import { Database } from "bun:sqlite";
import { eq, and, sql, count } from "drizzle-orm";
import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";

// ── Shared table for all NTPM modules ────────────────────────

export const ntpmEntries = sqliteTable("ntpm_entries", {
  id: text("id").primaryKey(),
  moduleSlug: text("module_slug").notNull(),
  postId: integer("post_id").notNull(),
  payload: text("payload").notNull(), // JSON
  createdAt: text("created_at")
    .notNull()
    .$defaultFn(() => new Date().toISOString()),
  updatedAt: text("updated_at")
    .notNull()
    .$defaultFn(() => new Date().toISOString()),
});

// ── Storage class ────────────────────────────────────────────

let dbInstance: ReturnType<typeof drizzle> | null = null;

const NTPM_DB_PATH = "./database/ntpm-modules.db";

function getDb() {
  if (!dbInstance) {
    mkdirSync(dirname(resolve(NTPM_DB_PATH)), { recursive: true });
    const sqlite = new Database(NTPM_DB_PATH);
    dbInstance = drizzle(sqlite);
  }
  return dbInstance;
}

export class NtpmModuleStorage {
  private slug: string;

  constructor(slug: string) {
    this.slug = slug;
  }

  /**
   * Create table if not exists.
   */
  public migrate(): void {
    const db = getDb();
    db.run(sql`
      CREATE TABLE IF NOT EXISTS ntpm_entries (
        id TEXT PRIMARY KEY,
        module_slug TEXT NOT NULL,
        post_id INTEGER NOT NULL,
        payload TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      )
    `);
    db.run(sql`CREATE INDEX IF NOT EXISTS idx_ntpm_entries_slug_post ON ntpm_entries(module_slug, post_id)`);
  }

  /**
   * Insert a new entry.
   */
  public insert<T>(postId: number, payload: T) {
    const db = getDb();
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    const record = {
      id,
      moduleSlug: this.slug,
      postId,
      payload: JSON.stringify(payload),
      createdAt: now,
      updatedAt: now,
    };
    db.insert(ntpmEntries).values(record).run();
    return { ...record, payload };
  }

  /**
   * List all entries for a post.
   */
  public listByPostId(postId: number) {
    const db = getDb();
    const rows = db
      .select()
      .from(ntpmEntries)
      .where(and(eq(ntpmEntries.moduleSlug, this.slug), eq(ntpmEntries.postId, postId)))
      .all();
    return rows.map((r) => ({ ...r, payload: JSON.parse(r.payload) } as { id: string; moduleSlug: string; postId: number; payload: unknown; createdAt: string; updatedAt: string }));
  }

  /**
   * Get single entry by id.
   */
  public findById(id: string) {
    const db = getDb();
    const row = db
      .select()
      .from(ntpmEntries)
      .where(eq(ntpmEntries.id, id))
      .get();
    if (!row) return null;
    return { ...row, payload: JSON.parse(row.payload) };
  }

  /**
   * Update an entry's payload.
   */
  public update<T>(id: string, payload: T) {
    const db = getDb();
    const now = new Date().toISOString();
    // .run() returns { changes: number } at runtime but types say void
    const result = db
      .update(ntpmEntries)
      .set({ payload: JSON.stringify(payload), updatedAt: now })
      .where(eq(ntpmEntries.id, id))
      .run() as unknown as { changes: number };
    if (result.changes === 0) return null;
    return { id, moduleSlug: this.slug, payload, updatedAt: now };
  }

  /**
   * Delete an entry.
   */
  public delete(id: string): boolean {
    const db = getDb();
    // .run() returns { changes: number } at runtime but types say void
    const result = db.delete(ntpmEntries).where(eq(ntpmEntries.id, id)).run() as unknown as { changes: number };
    return result.changes > 0;
  }

  /**
   * Aggregated stats for a post.
   */
  public stats(postId: number) {
    const db = getDb();
    const rows = db
      .select()
      .from(ntpmEntries)
      .where(and(eq(ntpmEntries.moduleSlug, this.slug), eq(ntpmEntries.postId, postId)))
      .all();
    return {
      totalEntries: rows.length,
      lastUpdated: rows.length
        ? rows.reduce((a, b) => (a.updatedAt > b.updatedAt ? a : b)).updatedAt
        : null,
    };
  }
}
