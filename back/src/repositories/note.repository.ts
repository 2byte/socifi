import { and, desc, eq } from "drizzle-orm";
import { db } from "../db";
import {
  notes,
  notesPosts,
  type NewNote,
  type NewNotePost,
} from "../db/schema";

type CreateNoteInput = Pick<
  NewNote,
  | "userId"
  | "categoryId"
  | "workspaceId"
  | "title"
  | "content"
  | "tags"
  | "props"
  | "createdAt"
  | "updatedAt"
>;

type UpdateNoteInput = {
  categoryId?: number | null;
  workspaceId?: number | null;
  title?: string;
  content?: string;
  tags?: string;
  props?: string;
  updatedAt: string;
};

type CreateNotePostInput = Pick<
  NewNotePost,
  "noteId" | "content" | "tags" | "props" | "createdAt"
>;

type UpdateNotePostInput = {
  content?: string;
  tags?: string;
  props?: string;
};

type ListNotesInput = {
  categoryId?: number | null;
  limit: number;
  offset: number;
};

export const noteRepository = {
  listByUserId(userId: number, options?: ListNotesInput) {
    const conditions =
      options?.categoryId != null
        ? and(eq(notes.userId, userId), eq(notes.categoryId, options.categoryId))
        : eq(notes.userId, userId);

    const limit = options?.limit ?? 20;
    const offset = options?.offset ?? 0;

    return db
      .select()
      .from(notes)
      .where(conditions)
      .orderBy(desc(notes.updatedAt), desc(notes.id))
      .limit(limit + 1)
      .offset(offset)
      .all();
  },

  findById(id: number) {
    return db.select().from(notes).where(eq(notes.id, id)).get();
  },

  findByIdForUser(id: number, userId: number) {
    return db
      .select()
      .from(notes)
      .where(and(eq(notes.id, id), eq(notes.userId, userId)))
      .get();
  },

  create(data: CreateNoteInput) {
    return db.insert(notes).values(data).returning().get();
  },

  update(id: number, userId: number, data: UpdateNoteInput) {
    return db
      .update(notes)
      .set(data)
      .where(and(eq(notes.id, id), eq(notes.userId, userId)))
      .returning()
      .get();
  },

  delete(id: number, userId: number) {
    return db
      .delete(notes)
      .where(and(eq(notes.id, id), eq(notes.userId, userId)))
      .run();
  },

  listPostsByNoteId(noteId: number) {
    return db
      .select()
      .from(notesPosts)
      .where(eq(notesPosts.noteId, noteId))
      .all();
  },

  findPostById(id: number) {
    return db.select().from(notesPosts).where(eq(notesPosts.id, id)).get();
  },

  findPostByIdForUser(id: number, userId: number) {
    return db
      .select({
        id: notesPosts.id,
        noteId: notesPosts.noteId,
        content: notesPosts.content,
        tags: notesPosts.tags,
        props: notesPosts.props,
        createdAt: notesPosts.createdAt,
      })
      .from(notesPosts)
      .innerJoin(notes, eq(notesPosts.noteId, notes.id))
      .where(and(eq(notesPosts.id, id), eq(notes.userId, userId)))
      .get();
  },

  createPost(data: CreateNotePostInput) {
    return db.insert(notesPosts).values(data).returning().get();
  },

  updatePost(id: number, data: UpdateNotePostInput) {
    return db.update(notesPosts).set(data).where(eq(notesPosts.id, id)).returning().get();
  },

  deletePost(id: number) {
    return db.delete(notesPosts).where(eq(notesPosts.id, id)).run();
  },

  // ── NTPM Token Management ──────────────────────────────────

  /**
   * Set NTPM token for a post. Returns the updated post.
   */
  setNtpmToken(postId: number, token: string) {
    return db
      .update(notesPosts)
      .set({ ntpmToken: token })
      .where(eq(notesPosts.id, postId))
      .returning()
      .get();
  },

  /**
   * Find a post by its NTPM token. Used for auth verification.
   */
  findPostByNtpmToken(token: string) {
    return db
      .select()
      .from(notesPosts)
      .where(eq(notesPosts.ntpmToken, token))
      .get();
  },

  /**
   * Get the NTPM token for a post.
   */
  getNtpmToken(postId: number) {
    const post = db
      .select({ ntpmToken: notesPosts.ntpmToken })
      .from(notesPosts)
      .where(eq(notesPosts.id, postId))
      .get();
    return post?.ntpmToken ?? null;
  },
};
