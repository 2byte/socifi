import { Elysia, t } from "elysia";
import { db } from "../db";
import { users } from "../db/schema";
import { eq } from "drizzle-orm";

export const userRoutes = new Elysia({ prefix: "/users" })
  .get("/", () => {
    return db.select().from(users);
  })
  .get(
    "/:id",
    ({ params: { id }, set }) => {
      const user = db
        .select()
        .from(users)
        .where(eq(users.id, Number(id)))
        .get();

      if (!user) {
        set.status = 404;
        return { error: "User not found" };
      }

      return { id: user.id, email: user.email, name: user.name };
    },
    {
      params: t.Object({ id: t.String() }),
    }
  )
  .delete(
    "/:id",
    ({ params: { id }, set }) => {
      const user = db
        .select()
        .from(users)
        .where(eq(users.id, Number(id)))
        .get();

      if (!user) {
        set.status = 404;
        return { error: "User not found" };
      }

      db.delete(users).where(eq(users.id, Number(id))).run();

      return { success: true };
    },
    {
      params: t.Object({ id: t.String() }),
    }
  );
