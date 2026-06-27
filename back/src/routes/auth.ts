import { Elysia, t } from "elysia";
import { db } from "../db";
import { users } from "../db/schema";
import { eq } from "drizzle-orm";

export const authRoutes = new Elysia({ prefix: "/auth" })
  .post(
    "/register",
    async ({ body, auth, set }) => {
      const existing = db
        .select()
        .from(users)
        .where(eq(users.email, body.email))
        .get();

      if (existing) {
        set.status = 409;
        return { error: "Email already registered" };
      }

      const password = await Bun.password.hash(body.password);

      const user = db
        .insert(users)
        .values({
          email: body.email,
          password,
          name: body.name,
        })
        .returning()
        .get();

      const token = await auth.sign({
        id: user.id,
        email: user.email,
      });

      return {
        user: { id: user.id, email: user.email, name: user.name },
        token,
      };
    },
    {
      body: t.Object({
        email: t.String({ format: "email" }),
        password: t.String({ minLength: 6 }),
        name: t.Optional(t.String()),
      }),
    }
  )
  .post(
    "/login",
    async ({ body, auth, set }) => {
      const user = db
        .select()
        .from(users)
        .where(eq(users.email, body.email))
        .get();

      if (!user) {
        set.status = 401;
        return { error: "Invalid credentials" };
      }

      const valid = await Bun.password.verify(body.password, user.password);

      if (!valid) {
        set.status = 401;
        return { error: "Invalid credentials" };
      }

      const token = await auth.sign({
        id: user.id,
        email: user.email,
      });

      return {
        user: { id: user.id, email: user.email, name: user.name },
        token,
      };
    },
    {
      body: t.Object({
        email: t.String({ format: "email" }),
        password: t.String(),
      }),
    }
  );
