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
import { verifyAccessToken } from "../lib/jwt";

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

  // WS cannot send headers, so the token arrives in the query string and is
  // verified here against the signing secret.
  const session = verifyAccessToken(token);
  if (!session) return null;

  // Verify user owns the post
  const post = noteRepository.findPostByIdForUser(postId, session.id);
  if (!post) return null;

  return { session, postId };
}
