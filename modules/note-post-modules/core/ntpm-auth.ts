/**
 * NTPM Auth Helper
 *
 * Provides authentication verification for NTPM HTTP routes.
 * Supports three auth modes:
 *   1. Post-specific NTPM token (stored in notes_posts.ntpm_token): owner
 *   2. JWT user token (for frontend/authenticated users): owner of the post
 *   3. Share token (`share:<token>`): a guest holding a public link
 *
 * Used inline in route handlers since Elysia middleware
 * from different node_modules copies are incompatible.
 */

import { noteRepository } from "../../../back/src/repositories/note.repository";
import { targetRepository } from "../../../back/src/repositories/target.repository";
import { verifyAccessToken } from "../../../back/src/lib/jwt";
import { guestSettingsOf, SHARE_TOKEN_PREFIX, type NtpmRole } from "./ntpm-guest";

export interface NtpmAuthResult {
  session: { id: number; login: string } | null;
  postId: number;
  isNtpmToken: boolean;
  role: NtpmRole;
  /** For guests: the post owner allowed them to write. Meaningless for owners. */
  guestWrite: boolean;
}

/**
 * Verify authorization for NTPM HTTP routes.
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

  // Mode 3: a guest with a share link. The link must cover this very post.
  if (token.startsWith(SHARE_TOKEN_PREFIX)) {
    const share = targetRepository.findShareByToken(token.slice(SHARE_TOKEN_PREFIX.length));
    const post = noteRepository.findPostById(postId);
    if (!share || !post) return null;

    const covered =
      share.shareableType === "post"
        ? share.shareableId === postId
        : share.shareableId === post.noteId;
    if (!covered) return null;

    return {
      session: null,
      postId,
      isNtpmToken: false,
      role: "guest",
      guestWrite: guestSettingsOf(post.props).write,
    };
  }

  // Mode 1: NTPM post-specific token
  const post = noteRepository.findPostByNtpmToken(token);
  if (post && post.id === postId) {
    return { session: null, postId, isNtpmToken: true, role: "owner", guestWrite: false };
  }

  // Mode 2: JWT user token — signature checked, then ownership of the post.
  const session = verifyAccessToken(token);
  if (!session) return null;

  const userPost = noteRepository.findPostByIdForUser(postId, session.id);
  if (!userPost) return null;

  return { session, postId, isNtpmToken: false, role: "owner", guestWrite: false };
}
