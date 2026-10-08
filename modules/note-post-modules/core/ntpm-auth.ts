/**
 * NTPM Auth Helper
 *
 * Provides authentication verification for NTPM HTTP routes.
 * Supports two auth modes:
 *   1. Post-specific NTPM token (stored in notes_posts.ntpm_token)
 *   2. JWT user token (for frontend/authenticated users)
 *
 * Used inline in route handlers since Elysia middleware
 * from different node_modules copies are incompatible.
 */

import { noteRepository } from "../../../back/src/repositories/note.repository";
import { verifyAccessToken } from "../../../back/src/lib/jwt";

export interface NtpmAuthResult {
  session: { id: number; login: string } | null;
  postId: number;
  isNtpmToken: boolean;
}

/**
 * Verify authorization for NTPM HTTP routes.
 *
 * Accepts two auth modes:
 *   - NTPM token: `Authorization: Bearer <ntpm-token>` — verified against notes_posts.ntpm_token
 *   - JWT user token: `Authorization: Bearer <jwt>` — verifies user owns the post
 *
 * @param authorization - Authorization header value
 * @param postIdRaw - Post ID from route params
 * @returns Auth result or null if unauthorized
 */
export function verifyNtpmAuth(
  authorization: string | undefined,
  postIdRaw: string | undefined,
): NtpmAuthResult | null {
  if (!authorization?.startsWith("Bearer ")) return null;

  const token = authorization.slice("Bearer ".length);
  const postId = Number(postIdRaw);

  if (!Number.isFinite(postId) || postId <= 0) return null;

  // Mode 1: NTPM post-specific token
  const post = noteRepository.findPostByNtpmToken(token);
  if (post && post.id === postId) {
    return { session: null, postId, isNtpmToken: true };
  }

  // Mode 2: JWT user token — signature checked, then ownership of the post.
  const session = verifyAccessToken(token);
  if (!session) return null;

  const userPost = noteRepository.findPostByIdForUser(postId, session.id);
  if (!userPost) return null;

  return { session, postId, isNtpmToken: false };
}
