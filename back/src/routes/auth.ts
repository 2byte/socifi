import { Elysia, t } from "elysia";
import {
  createRefreshSession,
  findRefreshSession,
  findUserSessionById,
  getSessionMeta,
  isExpired,
  listUserSessions,
  revokeAllUserSessions,
  revokeRefreshSession,
  rotateRefreshSession,
} from "../lib/auth-sessions";
import {
  auth as authPlugin,
  clearRefreshCookie,
  REFRESH_COOKIE_NAME,
  resolveSession,
  setRefreshCookie,
  signAccessToken,
} from "../middleware/auth";
import { fail, ok } from "../lib/http";
import { toSessionDto } from "../mappers/session.mapper";
import { toUserDto } from "../mappers/user.mapper";
import { userRepository } from "../repositories/user.repository";

async function getCurrentRefreshSessionId(rawToken: unknown) {
  if (typeof rawToken !== "string" || rawToken.length === 0) {
    return null;
  }

  const session = await findRefreshSession(rawToken);
  return session?.id || null;
}

export const authRoutes = new Elysia({ prefix: "/auth" })
  .use(authPlugin)
  .post(
    "/register",
    async ({ body, accessAuth, cookie, headers, set }) => {
      const existing = userRepository.findByLoginOrEmail(body.login, body.email);

      if (existing) {
        set.status = 409;
        return fail("Login or email already exists");
      }

      const now = new Date().toISOString();
      const password = await Bun.password.hash(body.password);

      const user = userRepository.create({
        login: body.login,
        email: body.email,
        password,
        name: body.name,
        createdAt: now,
        updatedAt: now,
      });

      userRepository.createDefaultWorkspace(user.id);

      const session = await createRefreshSession(user.id, getSessionMeta(headers));
      setRefreshCookie(cookie[REFRESH_COOKIE_NAME], session.rawToken);

      return ok({
        user: toUserDto(user),
        accessToken: await signAccessToken(
          { id: user.id, login: user.login },
          accessAuth,
        ),
      });
    },
    {
      body: t.Object({
        login: t.String({ minLength: 3 }),
        email: t.Optional(t.String({ format: "email" })),
        password: t.String({ minLength: 6 }),
        name: t.Optional(t.String()),
      }),
    },
  )
  .post(
    "/login",
    async ({ body, accessAuth, cookie, headers, set }) => {
      const user = userRepository.findByLogin(body.login);

      if (!user) {
        set.status = 401;
        return fail("Invalid credentials");
      }

      const valid = await Bun.password.verify(body.password, user.password);

      if (!valid) {
        set.status = 401;
        return fail("Invalid credentials");
      }

      const session = await createRefreshSession(user.id, getSessionMeta(headers));
      setRefreshCookie(cookie[REFRESH_COOKIE_NAME], session.rawToken);

      return ok({
        user: toUserDto(user),
        accessToken: await signAccessToken(
          { id: user.id, login: user.login },
          accessAuth,
        ),
      });
    },
    {
      body: t.Object({
        login: t.String(),
        password: t.String(),
      }),
    },
  )
  .post("/refresh", async ({ cookie, headers, accessAuth, set }) => {
    const rawToken = cookie[REFRESH_COOKIE_NAME]?.value;

    if (typeof rawToken !== "string" || rawToken.length === 0) {
      clearRefreshCookie(cookie[REFRESH_COOKIE_NAME]);
      set.status = 401;
      return fail("Unauthorized");
    }

    const refreshSession = await findRefreshSession(rawToken);

    if (!refreshSession || isExpired(refreshSession.expiresAt)) {
      if (refreshSession) {
        revokeRefreshSession(refreshSession.id);
      }

      clearRefreshCookie(cookie[REFRESH_COOKIE_NAME]);
      set.status = 401;
      return fail("Unauthorized");
    }

    const user = userRepository.findById(refreshSession.userId);

    if (!user) {
      revokeRefreshSession(refreshSession.id);
      clearRefreshCookie(cookie[REFRESH_COOKIE_NAME]);
      set.status = 401;
      return fail("Unauthorized");
    }

    const rotated = await rotateRefreshSession(refreshSession.id, getSessionMeta(headers));
    setRefreshCookie(cookie[REFRESH_COOKIE_NAME], rotated.rawToken);

    return ok({
      user: toUserDto(user),
      accessToken: await signAccessToken(
        { id: user.id, login: user.login },
        accessAuth,
      ),
    });
  })
  .post("/logout", async ({ cookie }) => {
    const rawToken = cookie[REFRESH_COOKIE_NAME]?.value;

    if (typeof rawToken === "string" && rawToken.length > 0) {
      const session = await findRefreshSession(rawToken);

      if (session) {
        revokeRefreshSession(session.id);
      }
    }

    clearRefreshCookie(cookie[REFRESH_COOKIE_NAME]);
    return ok({ success: true });
  })
  .post("/logout-all", async ({ headers, accessAuth, cookie, set }) => {
    const session = await resolveSession(headers.authorization, accessAuth);

    if (!session) {
      set.status = 401;
      return fail("Unauthorized");
    }

    revokeAllUserSessions(session.id);
    clearRefreshCookie(cookie[REFRESH_COOKIE_NAME]);
    return ok({ success: true });
  })
  .get("/me", async ({ headers, accessAuth, set }) => {
    const session = await resolveSession(headers.authorization, accessAuth);

    if (!session) {
      set.status = 401;
      return fail("Unauthorized");
    }

    const user = userRepository.findById(session.id);

    if (!user) {
      set.status = 401;
      return fail("Unauthorized");
    }

    return ok({ user: toUserDto(user) });
  })
  .patch(
    "/profile",
    async ({ headers, accessAuth, body, set }) => {
      const session = await resolveSession(headers.authorization, accessAuth);

      if (!session) {
        set.status = 401;
        return fail("Unauthorized");
      }

      const duplicateEmail = body.email ? userRepository.findByEmail(body.email) : null;

      if (duplicateEmail && duplicateEmail.id !== session.id) {
        set.status = 409;
        return fail("Email already exists");
      }

      const user = userRepository.updateProfile(session.id, {
        email: body.email || null,
        name: body.name || null,
        updatedAt: new Date().toISOString(),
      });

      return ok({ user: toUserDto(user) });
    },
    {
      body: t.Object({
        email: t.Optional(t.Union([t.String({ format: "email" }), t.Literal("")])),
        name: t.Optional(t.Union([t.String(), t.Literal("")])),
      }),
    },
  )
  .get("/sessions", async ({ headers, accessAuth, cookie, set }) => {
    const session = await resolveSession(headers.authorization, accessAuth);

    if (!session) {
      set.status = 401;
      return fail("Unauthorized");
    }

    const currentSessionId = await getCurrentRefreshSessionId(cookie[REFRESH_COOKIE_NAME]?.value);
    const sessions = listUserSessions(session.id).map((item) =>
      toSessionDto(item, item.id === currentSessionId),
    );

    return ok({ sessions });
  })
  .delete(
    "/sessions/:id",
    async ({ params, headers, accessAuth, cookie, set }) => {
      const session = await resolveSession(headers.authorization, accessAuth);

      if (!session) {
        set.status = 401;
        return fail("Unauthorized");
      }

      const target = findUserSessionById(session.id, params.id);

      if (!target) {
        set.status = 404;
        return fail("Session not found");
      }

      revokeRefreshSession(target.id);

      const currentSessionId = await getCurrentRefreshSessionId(cookie[REFRESH_COOKIE_NAME]?.value);

      if (currentSessionId === target.id) {
        clearRefreshCookie(cookie[REFRESH_COOKIE_NAME]);
      }

      return ok({ success: true });
    },
    {
      params: t.Object({
        id: t.String(),
      }),
    },
  );
