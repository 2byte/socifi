import { relations, type InferInsertModel, type InferSelectModel } from "drizzle-orm";
import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

const timestamps = {
  createdAt: text("created_at")
    .notNull()
    .$defaultFn(() => new Date().toISOString()),
  updatedAt: text("updated_at")
    .notNull()
    .$defaultFn(() => new Date().toISOString()),
} as const;

export const users = sqliteTable("users", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  email: text("email"),
  login: text("login").notNull().unique(),
  password: text("password").notNull(),
  name: text("name"),
  ...timestamps,
});

export const workspaces = sqliteTable("workspaces", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: integer("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  props: text("props"),
  ...timestamps,
});

export const categories = sqliteTable("categories", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: integer("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  workspaceId: integer("workspace_id").references(() => workspaces.id, {
    onDelete: "set null",
  }),
  name: text("name").notNull(),
  props: text("props").$defaultFn(() => "{}"),
  ...timestamps,
});

export const notes = sqliteTable("notes", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: integer("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  categoryId: integer("category_id").references(() => categories.id, {
    onDelete: "set null",
  }),
  workspaceId: integer("workspace_id").references(() => workspaces.id, {
    onDelete: "set null",
  }),
  title: text("title").notNull(),
  content: text("content")
    .notNull()
    .$defaultFn(() => "{}"),
  tags: text("tags")
    .notNull()
    .$defaultFn(() => "[]"),
  props: text("props")
    .notNull()
    .$defaultFn(() => "{}"),
  ...timestamps,
});

export const notesPosts = sqliteTable("notes_posts", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  noteId: integer("note_id")
    .notNull()
    .references(() => notes.id, { onDelete: "cascade" }),
  content: text("content")
    .notNull()
    .$defaultFn(() => "{}"),
  tags: text("tags")
    .notNull()
    .$defaultFn(() => "[]"),
  props: text("props")
    .notNull()
    .$defaultFn(() => "{}"),
  ntpmToken: text("ntpm_token"),
  createdAt: text("created_at")
    .notNull()
    .$defaultFn(() => new Date().toISOString()),
});

export const authSessions = sqliteTable("auth_sessions", {
  id: text("id").primaryKey(),
  userId: integer("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  tokenHash: text("token_hash").notNull().unique(),
  userAgent: text("user_agent"),
  ipAddress: text("ip_address"),
  ...timestamps,
  lastUsedAt: text("last_used_at")
    .notNull()
    .$defaultFn(() => new Date().toISOString()),
  expiresAt: text("expires_at").notNull(),
  revokedAt: text("revoked_at"),
});

export const usersRelations = relations(users, ({ many }) => ({
  workspaces: many(workspaces),
  categories: many(categories),
  notes: many(notes),
  authSessions: many(authSessions),
}));

export const workspacesRelations = relations(workspaces, ({ one, many }) => ({
  user: one(users, {
    fields: [workspaces.userId],
    references: [users.id],
  }),
  categories: many(categories),
  notes: many(notes),
}));

export const categoriesRelations = relations(categories, ({ one, many }) => ({
  user: one(users, {
    fields: [categories.userId],
    references: [users.id],
  }),
  workspace: one(workspaces, {
    fields: [categories.workspaceId],
    references: [workspaces.id],
  }),
  notes: many(notes),
}));

export const notesRelations = relations(notes, ({ one, many }) => ({
  user: one(users, {
    fields: [notes.userId],
    references: [users.id],
  }),
  category: one(categories, {
    fields: [notes.categoryId],
    references: [categories.id],
  }),
  workspace: one(workspaces, {
    fields: [notes.workspaceId],
    references: [workspaces.id],
  }),
  posts: many(notesPosts),
}));

export const notesPostsRelations = relations(notesPosts, ({ one }) => ({
  note: one(notes, {
    fields: [notesPosts.noteId],
    references: [notes.id],
  }),
}));

export const authSessionsRelations = relations(authSessions, ({ one }) => ({
  user: one(users, {
    fields: [authSessions.userId],
    references: [users.id],
  }),
}));

export type User = InferSelectModel<typeof users>;
export type NewUser = InferInsertModel<typeof users>;

export type Workspace = InferSelectModel<typeof workspaces>;
export type NewWorkspace = InferInsertModel<typeof workspaces>;

export type Category = InferSelectModel<typeof categories>;
export type NewCategory = InferInsertModel<typeof categories>;

export type Note = InferSelectModel<typeof notes>;
export type NewNote = InferInsertModel<typeof notes>;

export type NotePost = InferSelectModel<typeof notesPosts>;
export type NewNotePost = InferInsertModel<typeof notesPosts>;

export type AuthSession = InferSelectModel<typeof authSessions>;
export type NewAuthSession = InferInsertModel<typeof authSessions>;
