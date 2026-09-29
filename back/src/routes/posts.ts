import { Elysia, t } from "elysia";
import { fail, ok } from "../lib/http";
import { auth as authPlugin, resolveSession } from "../middleware/auth";
import { toNotePostDto } from "../mappers/note.mapper";
import { noteRepository } from "../repositories/note.repository";

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

      return ok({ posts: posts.map(toNotePostDto) });
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

      const now = new Date().toISOString();
      const post = noteRepository.createPost({
        noteId: note.id,
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

      noteRepository.deletePost(Number(postId));
      return ok({ success: true });
    },
    {
      params: t.Object({ id: t.String(), postId: t.String() }),
    },
  );
