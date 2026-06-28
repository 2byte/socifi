import { Elysia } from "elysia";
import { jwt } from "@elysiajs/jwt";
import type { Cookie } from "elysia";
import { config } from "../config";

const ACCESS_TOKEN_TTL = 60 * 15;
export const REFRESH_COOKIE_NAME = "socifi_refresh";

export type AuthSession = {
  id: number;
  login: string;
};

type JwtVerifier = {
  verify: (token: string) => Promise<unknown>;
  sign: (payload: Record<string, string | number | boolean | undefined>) => Promise<string>;
};

type RefreshCookie = Cookie<unknown> | undefined;

function getExpiration(seconds: number) {
  return Math.floor(Date.now() / 1000) + seconds;
}

export async function resolveSession(
  authorization: string | undefined,
  auth: JwtVerifier,
) {
  if (!authorization?.startsWith("Bearer ")) {
    return null;
  }

  const token = authorization.slice("Bearer ".length);
  const payload = await auth.verify(token);

  if (
    !payload ||
    typeof payload !== "object" ||
    typeof (payload as Record<string, unknown>).id !== "number" ||
    typeof (payload as Record<string, unknown>).login !== "string"
  ) {
    return null;
  }

  return {
    id: (payload as Record<string, number>).id,
    login: (payload as Record<string, string>).login,
  } satisfies AuthSession;
}

export async function signAccessToken(session: AuthSession, accessAuth: JwtVerifier) {
  return accessAuth.sign({
    ...session,
    exp: getExpiration(ACCESS_TOKEN_TTL),
    type: "access",
  });
}

export function setRefreshCookie(cookie: RefreshCookie, token: string) {
  cookie?.set({
    value: token,
    httpOnly: true,
    path: "/",
    sameSite: "lax",
    secure: config.cookieSecure,
    maxAge: 60 * 60 * 24 * 7,
  });
}

export function clearRefreshCookie(cookie: RefreshCookie) {
  cookie?.remove();
}

export const auth = new Elysia()
  .use(
    jwt({
      name: "accessAuth",
      secret: config.jwtSecret,
    }),
  )
  .derive(async ({ headers, accessAuth }) => {
    return {
      session: await resolveSession(headers.authorization, accessAuth),
    };
  });
