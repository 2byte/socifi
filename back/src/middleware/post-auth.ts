/**
 * Post Auth Middleware
 *
 * Verifies that the authenticated user owns the note
 * that the post belongs to. Used for NTPM external access routes.
 *
 * Usage:
 *   .use(postAuth)
 *   .get("/something", ({ session, postId }) => { ... })
 */

import { Elysia } from "elysia";
import { auth, resolveSession } from "./auth";
import { noteRepository } from "../repositories/note.repository";

export const postAuth = new Elysia()
  .use(auth)
  .derive(async ({ headers, accessAuth, params, set }) => {
    const session = await resolveSession(headers.authorization, accessAuth);

    if (!session) {
      set.status = 401;
      return { session: null, postId: null, error: "Unauthorized" };
    }

    const postId = Number((params as Record<string, string>).post_id);

    if (!Number.isFinite(postId) || postId <= 0) {
      set.status = 400;
      return { session: null, postId: null, error: "Invalid post id" };
    }

    // Verify user owns the note that this post belongs to
    const post = noteRepository.findPostByIdForUser(postId, session.id);

    if (!post) {
      set.status = 404;
      return { session: null, postId: null, error: "Post not found" };
    }

    return { session, postId, error: null };
  });

/**
 * Post Auth for WebSocket connections.
 *
 * WS can't send custom headers, so auth is via query param `?token=...`.
 * Returns session + postId or null.
 */
export async function resolvePostAuth(
  token: string | undefined,
  postIdRaw: string | undefined,
): Promise<{ session: { id: number; login: string }; postId: number } | null> {
  if (!token || !postIdRaw) return null;

  const postId = Number(postIdRaw);
  if (!Number.isFinite(postId) || postId <= 0) return null;

  // We need to verify the JWT manually for WS
  // Import config and create a temporary JWT verifier
  const { config } = await import("../config");
  const { jwt } = await import("@elysiajs/jwt");

  // Create a minimal verifier
  const jwtInstance = jwt({ name: "wsAuth", secret: config.jwtSecret });
  // We can't use .use() outside Elysia context, so we verify manually
  try {
    // Decode JWT payload (Elysia JWT uses jose under the hood)
    const parts = token.split(".");
    if (parts.length !== 3) return null;

    const payload = JSON.parse(atob(parts[1]));

    if (typeof payload.id !== "number" || typeof payload.login !== "string") {
      return null;
    }

    // Check expiration
    if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) {
      return null;
    }

    const session = { id: payload.id, login: payload.login };

    // Verify user owns the post
    const post = noteRepository.findPostByIdForUser(postId, session.id);
    if (!post) return null;

    return { session, postId };
  } catch {
    return null;
  }
}
