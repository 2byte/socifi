import { createHmac, timingSafeEqual } from "node:crypto";
import { config } from "../config";
import type { AuthSession } from "../middleware/auth";

/**
 * Synchronous HS256 access-token check, for the places that cannot await the
 * Elysia jwt plugin (NTPM route handlers and the WebSocket upgrade).
 *
 * The signature is verified against the same secret `middleware/auth.ts`
 * signs with. Decoding the payload without this step would let anyone mint a
 * token for any user id.
 */
export function verifyAccessToken(token: string): AuthSession | null {
  const parts = token.split(".");
  if (parts.length !== 3) {
    return null;
  }

  const [header64, payload64, signature64] = parts as [string, string, string];

  try {
    const header = JSON.parse(Buffer.from(header64, "base64url").toString());
    if (header?.alg !== "HS256") {
      return null;
    }

    const expected = createHmac("sha256", config.jwtSecret)
      .update(`${header64}.${payload64}`)
      .digest();
    const actual = Buffer.from(signature64, "base64url");

    if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) {
      return null;
    }

    const payload = JSON.parse(Buffer.from(payload64, "base64url").toString());

    if (
      typeof payload.id !== "number" ||
      typeof payload.login !== "string" ||
      payload.type !== "access"
    ) {
      return null;
    }

    if (typeof payload.exp !== "number" || payload.exp < Math.floor(Date.now() / 1000)) {
      return null;
    }

    return { id: payload.id, login: payload.login };
  } catch {
    return null;
  }
}
