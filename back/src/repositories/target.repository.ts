import { and, eq, inArray, sql } from "drizzle-orm";
import { db } from "../db";
import {
  attachments,
  shares,
  viewCounts,
  type NewAttachment,
  type TargetType,
} from "../db/schema";
import { storage } from "../lib/storage";
import { noteRepository } from "./note.repository";

/**
 * Everything that hangs off a polymorphic (type, id) target: who may touch it,
 * its public share and its attachments.
 */
export const targetRepository = {
  /** The target when it exists and belongs to `userId`, otherwise `null`. */
  findOwned(type: TargetType, id: number, userId: number) {
    if (type === "note") {
      return noteRepository.findByIdForUser(id, userId) ? { type, id } : null;
    }

    return noteRepository.findPostByIdForUser(id, userId) ? { type, id } : null;
  },

  // ── Shares ────────────────────────────────────────────────

  findShare(type: TargetType, id: number) {
    return db
      .select()
      .from(shares)
      .where(and(eq(shares.shareableType, type), eq(shares.shareableId, id)))
      .get();
  },

  findShareByToken(token: string) {
    return db.select().from(shares).where(eq(shares.token, token)).get();
  },

  createShare(userId: number, type: TargetType, id: number, token: string) {
    return db
      .insert(shares)
      .values({ userId, shareableType: type, shareableId: id, token })
      .returning()
      .get();
  },

  deleteShare(type: TargetType, id: number) {
    return db
      .delete(shares)
      .where(and(eq(shares.shareableType, type), eq(shares.shareableId, id)))
      .run();
  },

  // ── Views ─────────────────────────────────────────────────

  viewCount(type: TargetType, id: number) {
    return (
      db
        .select({ count: viewCounts.count })
        .from(viewCounts)
        .where(and(eq(viewCounts.targetType, type), eq(viewCounts.targetId, id)))
        .get()?.count ?? 0
    );
  },

  viewCountsForMany(type: TargetType, ids: number[]) {
    const counts = new Map<number, number>();

    if (ids.length === 0) {
      return counts;
    }

    const rows = db
      .select()
      .from(viewCounts)
      .where(and(eq(viewCounts.targetType, type), inArray(viewCounts.targetId, ids)))
      .all();

    for (const row of rows) {
      counts.set(row.targetId, row.count);
    }

    return counts;
  },

  recordView(type: TargetType, id: number) {
    db.insert(viewCounts)
      .values({ targetType: type, targetId: id, count: 1, lastViewedAt: new Date().toISOString() })
      .onConflictDoUpdate({
        target: [viewCounts.targetType, viewCounts.targetId],
        set: { count: sql`${viewCounts.count} + 1`, lastViewedAt: new Date().toISOString() },
      })
      .run();
  },

  // ── Attachments ───────────────────────────────────────────

  listAttachments(type: TargetType, id: number) {
    return db
      .select()
      .from(attachments)
      .where(and(eq(attachments.attachableType, type), eq(attachments.attachableId, id)))
      .orderBy(attachments.id)
      .all();
  },

  /** All attachments of several targets of one type, for building a public page in one query. */
  listAttachmentsForMany(type: TargetType, ids: number[]) {
    if (ids.length === 0) {
      return [];
    }

    return db
      .select()
      .from(attachments)
      .where(and(eq(attachments.attachableType, type), inArray(attachments.attachableId, ids)))
      .orderBy(attachments.id)
      .all();
  },

  findAttachment(id: number) {
    return db.select().from(attachments).where(eq(attachments.id, id)).get();
  },

  createAttachment(data: NewAttachment) {
    return db.insert(attachments).values(data).returning().get();
  },

  deleteAttachment(id: number) {
    return db.delete(attachments).where(eq(attachments.id, id)).run();
  },

  /**
   * Removes the shares and attachments (rows and files) of targets that are
   * about to be deleted. Call it *before* deleting the targets themselves.
   */
  async cleanupTargets(type: TargetType, ids: number[]) {
    if (ids.length === 0) {
      return;
    }

    const files = db
      .select({ storageKey: attachments.storageKey })
      .from(attachments)
      .where(and(eq(attachments.attachableType, type), inArray(attachments.attachableId, ids)))
      .all();

    db.delete(attachments)
      .where(and(eq(attachments.attachableType, type), inArray(attachments.attachableId, ids)))
      .run();
    db.delete(shares)
      .where(and(eq(shares.shareableType, type), inArray(shares.shareableId, ids)))
      .run();
    db.delete(viewCounts)
      .where(and(eq(viewCounts.targetType, type), inArray(viewCounts.targetId, ids)))
      .run();

    await Promise.all(files.map((file) => storage.remove(file.storageKey)));
  },
};
