/**
 * NTPM admin routes.
 * Provides endpoints for inspecting loaded NTPM modules
 * and managing post-specific NTPM tokens.
 */

import { Elysia } from "elysia";
import { randomBytes } from "node:crypto";
import { NtpmServiceManager } from "../note-post-module/NtpmServiceManager";
import { noteRepository } from "../repositories/note.repository";

export const ntpmAdminRoutes = new Elysia()
  // List loaded modules
  .get("/ntpm/modules", () => ({
    modules: NtpmServiceManager.getLoadedSlugs(),
  }))

  // Generate NTPM token for a specific post
  .post("/ntpm/posts/:post_id/token", ({ params, set }: any) => {
    const postId = Number(params.post_id);
    if (!Number.isFinite(postId) || postId <= 0) {
      set.status = 400;
      return { error: "Invalid post id" };
    }

    const post = noteRepository.findPostById(postId);
    if (!post) {
      set.status = 404;
      return { error: "Post not found" };
    }

    const token = `ntpm_${randomBytes(32).toString("hex")}`;
    noteRepository.setNtpmToken(postId, token);

    return { postId, token };
  })

  // Get current NTPM token for a post
  .get("/ntpm/posts/:post_id/token", ({ params, set }: any) => {
    const postId = Number(params.post_id);
    if (!Number.isFinite(postId) || postId <= 0) {
      set.status = 400;
      return { error: "Invalid post id" };
    }

    const token = noteRepository.getNtpmToken(postId);
    if (!token) {
      set.status = 404;
      return { error: "No NTPM token for this post" };
    }

    return { postId, token };
  });
