import { Elysia, t } from "elysia";
import { fail, ok } from "../lib/http";
import { auth as authPlugin, resolveSession } from "../middleware/auth";
import { toNotePostDto } from "../mappers/note.mapper";
import { noteRepository } from "../repositories/note.repository";
import { targetRepository } from "../repositories/target.repository";
import { NtpmServiceManager } from "../note-post-module/NtpmServiceManager";

const contentFormat = t.Union([t.Literal("markdown"), t.Literal("text")]);

function stringifyJson(value: unknown, fallback: string) {
  if (value === undefined) {
    return fallback;
  }

  return JSON.stringify(value);
}

export const postRoutes = new Elysia({ prefix: "/notes/:id/posts" })
  .use(authPlugin)
  .get(
    "/",
    async ({ params: { id }, headers, accessAuth, set }) => {
      const session = await resolveSession(headers.authorization, accessAuth);

      if (!session) {
        set.status = 401;
        return fail("Unauthorized");
      }

      const note = noteRepository.findByIdForUser(Number(id), session.id);

      if (!note) {
        set.status = 404;
        return fail("Note not found");
      }

      const posts = noteRepository.listPostsByNoteId(note.id);

      const views = targetRepository.viewCountsForMany(
        "post",
        posts.map((post) => post.id),
      );

      return ok({ posts: posts.map((post) => toNotePostDto(post, views.get(post.id) ?? 0)) });
    },
    {
      params: t.Object({ id: t.String() }),
    },
  )
  .get(
    "/:postId",
    async ({ params: { id, postId }, headers, accessAuth, set }) => {
      const session = await resolveSession(headers.authorization, accessAuth);

      if (!session) {
        set.status = 401;
        return fail("Unauthorized");
      }

      const note = noteRepository.findByIdForUser(Number(id), session.id);

      if (!note) {
        set.status = 404;
        return fail("Note not found");
      }

      const post = noteRepository.findPostById(Number(postId));

      if (!post || post.noteId !== note.id) {
        set.status = 404;
        return fail("Post not found");
      }

      return ok({ post: toNotePostDto(post) });
    },
    {
      params: t.Object({ id: t.String(), postId: t.String() }),
    },
  )
  .post(
    "/",
    async ({ params: { id }, body, headers, accessAuth, set }) => {
      const session = await resolveSession(headers.authorization, accessAuth);

      if (!session) {
        set.status = 401;
        return fail("Unauthorized");
      }

      const note = noteRepository.findByIdForUser(Number(id), session.id);

      if (!note) {
        set.status = 404;
        return fail("Note not found");
      }

      const moduleSlug = body.moduleSlug ?? null;

      if (moduleSlug !== null && !NtpmServiceManager.getModule(moduleSlug)) {
        set.status = 400;
        return fail("Module not found");
      }

      const now = new Date().toISOString();
      const post = noteRepository.createPost({
        noteId: note.id,
        format: body.format ?? "markdown",
        moduleSlug,
        content: stringifyJson(body.content, JSON.stringify("")),
        tags: stringifyJson(body.tags ?? [], "[]"),
        props: stringifyJson(body.props ?? {}, "{}"),
        createdAt: now,
      });

      return ok({ post: toNotePostDto(post) });
    },
    {
      params: t.Object({ id: t.String() }),
      body: t.Object({
        format: t.Optional(contentFormat),
        moduleSlug: t.Optional(t.Union([t.String(), t.Null()])),
        content: t.Optional(t.Any()),
        tags: t.Optional(t.Array(t.String())),
        props: t.Optional(t.Any()),
      }),
    },
  )
  .patch(
    "/:postId",
    async ({ params: { id, postId }, body, headers, accessAuth, set }) => {
      const session = await resolveSession(headers.authorization, accessAuth);

      if (!session) {
        set.status = 401;
        return fail("Unauthorized");
      }

      const note = noteRepository.findByIdForUser(Number(id), session.id);

      if (!note) {
        set.status = 404;
        return fail("Note not found");
      }

      const existing = noteRepository.findPostById(Number(postId));

      if (!existing || existing.noteId !== note.id) {
        set.status = 404;
        return fail("Post not found");
      }

      const post = noteRepository.updatePost(Number(postId), {
        format: body.format,
        content:
          body.content !== undefined
            ? stringifyJson(body.content, existing.content)
            : undefined,
        tags:
          body.tags !== undefined
            ? stringifyJson(body.tags, existing.tags)
            : undefined,
        props:
          body.props !== undefined
            ? stringifyJson(body.props, existing.props)
            : undefined,
      });

      return ok({ post: toNotePostDto(post) });
    },
    {
      params: t.Object({ id: t.String(), postId: t.String() }),
      body: t.Object({
        format: t.Optional(contentFormat),
        content: t.Optional(t.Any()),
        tags: t.Optional(t.Array(t.String())),
        props: t.Optional(t.Any()),
      }),
    },
  )
  .delete(
    "/:postId",
    async ({ params: { id, postId }, headers, accessAuth, set }) => {
      const session = await resolveSession(headers.authorization, accessAuth);

      if (!session) {
        set.status = 401;
        return fail("Unauthorized");
      }

      const note = noteRepository.findByIdForUser(Number(id), session.id);

      if (!note) {
        set.status = 404;
        return fail("Note not found");
      }

      const existing = noteRepository.findPostById(Number(postId));

      if (!existing || existing.noteId !== note.id) {
        set.status = 404;
        return fail("Post not found");
      }

      await targetRepository.cleanupTargets("post", [existing.id]);
      noteRepository.deletePost(Number(postId));
      return ok({ success: true });
    },
    {
      params: t.Object({ id: t.String(), postId: t.String() }),
    },
  );
