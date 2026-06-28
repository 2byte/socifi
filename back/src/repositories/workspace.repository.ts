import { and, eq } from "drizzle-orm";
import { db } from "../db";
import { workspaces, type NewWorkspace } from "../db/schema";

type CreateWorkspaceInput = Pick<
  NewWorkspace,
  "userId" | "name" | "props" | "createdAt" | "updatedAt"
>;

type UpdateWorkspaceInput = {
  name?: string;
  props?: string | null;
  updatedAt: string;
};

export const workspaceRepository = {
  listByUserId(userId: number) {
    return db.select().from(workspaces).where(eq(workspaces.userId, userId)).all();
  },

  findById(id: number) {
    return db.select().from(workspaces).where(eq(workspaces.id, id)).get();
  },

  findByIdForUser(id: number, userId: number) {
    return db
      .select()
      .from(workspaces)
      .where(and(eq(workspaces.id, id), eq(workspaces.userId, userId)))
      .get();
  },

  findDefaultByUserId(userId: number) {
    return db
      .select()
      .from(workspaces)
      .where(and(eq(workspaces.userId, userId), eq(workspaces.name, "default")))
      .get();
  },

  create(data: CreateWorkspaceInput) {
    return db.insert(workspaces).values(data).returning().get();
  },

  update(id: number, userId: number, data: UpdateWorkspaceInput) {
    return db
      .update(workspaces)
      .set(data)
      .where(and(eq(workspaces.id, id), eq(workspaces.userId, userId)))
      .returning()
      .get();
  },

  delete(id: number, userId: number) {
    return db
      .delete(workspaces)
      .where(and(eq(workspaces.id, id), eq(workspaces.userId, userId)))
      .run();
  },
};
