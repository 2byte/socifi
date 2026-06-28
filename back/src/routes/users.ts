import { Elysia, t } from "elysia";
import { auth as authPlugin, resolveSession } from "../middleware/auth";
import { fail, ok } from "../lib/http";
import { toUserDto } from "../mappers/user.mapper";
import { userRepository } from "../repositories/user.repository";

export const userRoutes = new Elysia({ prefix: "/users" })
  .use(authPlugin)
  .get("/", async ({ headers, accessAuth, set }) => {
    const session = await resolveSession(headers.authorization, accessAuth);

    if (!session) {
      set.status = 401;
      return fail("Unauthorized");
    }

    return ok(userRepository.findCurrentListById(session.id));
  })
  .get(
    "/:id",
    async ({ params: { id }, headers, accessAuth, set }) => {
      const session = await resolveSession(headers.authorization, accessAuth);

      if (!session) {
        set.status = 401;
        return fail("Unauthorized");
      }

      if (session.id !== Number(id)) {
        set.status = 403;
        return fail("Forbidden");
      }

      const user = userRepository.findById(Number(id));

      if (!user) {
        set.status = 404;
        return fail("User not found");
      }

      return ok(toUserDto(user));
    },
    {
      params: t.Object({ id: t.String() }),
    }
  )
  .delete(
    "/:id",
    async ({ params: { id }, headers, accessAuth, set }) => {
      const session = await resolveSession(headers.authorization, accessAuth);

      if (!session) {
        set.status = 401;
        return fail("Unauthorized");
      }

      if (session.id !== Number(id)) {
        set.status = 403;
        return fail("Forbidden");
      }

      const user = userRepository.findById(Number(id));

      if (!user) {
        set.status = 404;
        return fail("User not found");
      }

      userRepository.deleteById(Number(id));

      return ok({ success: true });
    },
    {
      params: t.Object({ id: t.String() }),
    }
  );
