import { eq, or } from "drizzle-orm";
import { db } from "../db";
import { users, workspaces, type NewUser, type User } from "../db/schema";

type CreateUserInput = Pick<NewUser, "login" | "email" | "password" | "name" | "createdAt" | "updatedAt">;
type UpdateProfileInput = {
  email: string | null;
  name: string | null;
  updatedAt: string;
};

export const userRepository = {
  findById(id: number) {
    return db.select().from(users).where(eq(users.id, id)).get();
  },

  findByLogin(login: string) {
    return db.select().from(users).where(eq(users.login, login)).get();
  },

  findByEmail(email: string) {
    return db.select().from(users).where(eq(users.email, email)).get();
  },

  findByLoginOrEmail(login: string, email?: string) {
    return db
      .select()
      .from(users)
      .where(or(eq(users.login, login), email ? eq(users.email, email) : undefined))
      .get();
  },

  create(data: CreateUserInput) {
    return db.insert(users).values(data).returning().get();
  },

  createDefaultWorkspace(userId: number) {
    return db.insert(workspaces).values({ userId, name: "default" }).run();
  },

  updateProfile(id: number, data: UpdateProfileInput) {
    return db.update(users).set(data).where(eq(users.id, id)).returning().get();
  },

  deleteById(id: number) {
    return db.delete(users).where(eq(users.id, id)).run();
  },

  findCurrentListById(id: number): Pick<User, "id" | "login" | "email" | "name" | "createdAt">[] {
    return db
      .select({
        id: users.id,
        login: users.login,
        email: users.email,
        name: users.name,
        createdAt: users.createdAt,
      })
      .from(users)
      .where(eq(users.id, id))
      .all();
  },
};
