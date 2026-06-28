import { and, eq } from "drizzle-orm";
import { db } from "../db";
import { categories, workspaces, type Category, type NewCategory } from "../db/schema";

type CreateCategoryInput = Pick<
  NewCategory,
  "userId" | "workspaceId" | "name" | "props" | "createdAt" | "updatedAt"
>;

type UpdateCategoryInput = {
  name: string;
  workspaceId: number | null;
  props: string | null;
  updatedAt: string;
};

export const categoryRepository = {
  listByUserId(userId: number) {
    return db.select().from(categories).where(eq(categories.userId, userId)).all();
  },

  findById(id: number) {
    return db.select().from(categories).where(eq(categories.id, id)).get();
  },

  findByIdForUser(id: number, userId: number) {
    return db
      .select()
      .from(categories)
      .where(and(eq(categories.id, id), eq(categories.userId, userId)))
      .get();
  },

  create(data: CreateCategoryInput) {
    return db.insert(categories).values(data).returning().get();
  },

  update(id: number, userId: number, data: UpdateCategoryInput) {
    return db
      .update(categories)
      .set(data)
      .where(and(eq(categories.id, id), eq(categories.userId, userId)))
      .returning()
      .get();
  },

  delete(id: number, userId: number) {
    return db
      .delete(categories)
      .where(and(eq(categories.id, id), eq(categories.userId, userId)))
      .run();
  },

  findWorkspaceByIdForUser(workspaceId: number, userId: number) {
    return db
      .select()
      .from(workspaces)
      .where(and(eq(workspaces.id, workspaceId), eq(workspaces.userId, userId)))
      .get();
  },
};
