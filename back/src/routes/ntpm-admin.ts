/**
 * NTPM admin routes.
 * Provides endpoints for inspecting loaded NTPM modules
 * and managing post-specific NTPM tokens.
 *
 * Every token route requires a signed-in user who owns the post. The token is
 * a credential for the post's data, so it is never handed to anyone else.
 */

import { Elysia } from "elysia";
import { randomBytes } from "node:crypto";
import { auth as authPlugin, resolveSession } from "../middleware/auth";
import { NtpmServiceManager } from "../note-post-module/NtpmServiceManager";
import { noteRepository } from "../repositories/note.repository";

export const ntpmAdminRoutes = new Elysia()
  .use(authPlugin)
  // List loaded modules
  .get("/ntpm/modules", async ({ headers, accessAuth, set }) => {
    const session = await resolveSession(headers.authorization, accessAuth);
    if (!session) {
      set.status = 401;
      return { error: "Unauthorized" };
    }

    return {
      modules: NtpmServiceManager.getLoadedInfo(),
    };
  })

  // Generate (or rotate) the NTPM token for a post
  .post("/ntpm/posts/:post_id/token", async ({ params, headers, accessAuth, set }: any) => {
    const session = await resolveSession(headers.authorization, accessAuth);
    if (!session) {
      set.status = 401;
      return { error: "Unauthorized" };
    }

    const postId = Number(params.post_id);
    if (!Number.isFinite(postId) || postId <= 0) {
      set.status = 400;
      return { error: "Invalid post id" };
    }

    if (!noteRepository.findPostByIdForUser(postId, session.id)) {
      set.status = 404;
      return { error: "Post not found" };
    }

    const token = `ntpm_${randomBytes(32).toString("hex")}`;
    noteRepository.setNtpmToken(postId, token);

    return { postId, token };
  })

  // Get current NTPM token for a post
  .get("/ntpm/posts/:post_id/token", async ({ params, headers, accessAuth, set }: any) => {
    const session = await resolveSession(headers.authorization, accessAuth);
    if (!session) {
      set.status = 401;
      return { error: "Unauthorized" };
    }

    const postId = Number(params.post_id);
    if (!Number.isFinite(postId) || postId <= 0) {
      set.status = 400;
      return { error: "Invalid post id" };
    }

    if (!noteRepository.findPostByIdForUser(postId, session.id)) {
      set.status = 404;
      return { error: "Post not found" };
    }

    const token = noteRepository.getNtpmToken(postId);
    if (!token) {
      set.status = 404;
      return { error: "No NTPM token for this post" };
    }

    return { postId, token };
  });
