import { Elysia, t } from "elysia";
import { fail, ok } from "../lib/http";
import { auth as authPlugin, resolveSession } from "../middleware/auth";
import { toNoteDto } from "../mappers/note.mapper";
import { noteRepository } from "../repositories/note.repository";
import { workspaceRepository } from "../repositories/workspace.repository";
import { categoryRepository } from "../repositories/category.repository";

function stringifyJson(value: unknown, fallback: string) {
  if (value === undefined) {
    return fallback;
  }

  return JSON.stringify(value);
}

function parsePositiveInteger(value: string | undefined, fallback: number) {
  const parsed = Number(value);

  if (!Number.isFinite(parsed) || parsed < 0) {
    return fallback;
  }

  return Math.floor(parsed);
}

export const noteRoutes = new Elysia({ prefix: "/notes" })
  .use(authPlugin)
  .get(
    "/",
    async ({ headers, accessAuth, query, set }) => {
      const session = await resolveSession(headers.authorization, accessAuth);

      if (!session) {
        set.status = 401;
        return fail("Unauthorized");
      }

      const limit = Math.min(parsePositiveInteger(query.limit, 20), 50);
      const offset = parsePositiveInteger(query.offset, 0);
      const categoryId = query.categoryId ? Number(query.categoryId) : null;

      if (query.categoryId && !Number.isFinite(categoryId)) {
        set.status = 400;
        return fail("Invalid category id");
      }

      const rows = noteRepository.listByUserId(session.id, {
        categoryId,
        limit,
        offset,
      });

      const hasMore = rows.length > limit;
      const notes = rows.slice(0, limit).map(toNoteDto);

      return ok({
        notes,
        pagination: {
          limit,
          offset,
          nextOffset: hasMore ? offset + notes.length : null,
          hasMore,
        },
      });
    },
    {
      query: t.Object({
        limit: t.Optional(t.String()),
        offset: t.Optional(t.String()),
        categoryId: t.Optional(t.String()),
      }),
    },
  )
  .get(
    "/:id",
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

      return ok({ note: toNoteDto(note) });
    },
    {
      params: t.Object({ id: t.String() }),
    },
  )
  .post(
    "/",
    async ({ body, headers, accessAuth, set }) => {
      const session = await resolveSession(headers.authorization, accessAuth);

      if (!session) {
        set.status = 401;
        return fail("Unauthorized");
      }

      let workspaceId = body.workspaceId ?? null;
      const categoryId = body.categoryId ?? null;

      if (workspaceId == null) {
        workspaceId = workspaceRepository.findDefaultByUserId(session.id)?.id ?? null;
      }

      if (workspaceId != null) {
        const workspace = workspaceRepository.findByIdForUser(workspaceId, session.id);

        if (!workspace) {
          set.status = 400;
          return fail("Workspace not found");
        }
      }

      if (categoryId != null) {
        const category = categoryRepository.findByIdForUser(categoryId, session.id);

        if (!category) {
          set.status = 400;
          return fail("Category not found");
        }
      }

      const now = new Date().toISOString();
      const note = noteRepository.create({
        userId: session.id,
        categoryId,
        workspaceId,
        title: body.title.trim(),
        content: stringifyJson(body.content, JSON.stringify("")),
        tags: stringifyJson(body.tags ?? [], "[]"),
        props: stringifyJson(body.props ?? {}, "{}"),
        createdAt: now,
        updatedAt: now,
      });

      return ok({ note: toNoteDto(note) });
    },
    {
      body: t.Object({
        title: t.String({ minLength: 1 }),
        categoryId: t.Optional(t.Union([t.Number(), t.Null()])),
        workspaceId: t.Optional(t.Union([t.Number(), t.Null()])),
        content: t.Optional(t.Any()),
        tags: t.Optional(t.Array(t.String())),
        props: t.Optional(t.Any()),
      }),
    },
  )
  .patch(
    "/:id",
    async ({ params: { id }, body, headers, accessAuth, set }) => {
      const session = await resolveSession(headers.authorization, accessAuth);

      if (!session) {
        set.status = 401;
        return fail("Unauthorized");
      }

      const existing = noteRepository.findByIdForUser(Number(id), session.id);

      if (!existing) {
        set.status = 404;
        return fail("Note not found");
      }

      const nextWorkspaceId =
        body.workspaceId !== undefined ? body.workspaceId : existing.workspaceId;
      const nextCategoryId =
        body.categoryId !== undefined ? body.categoryId : existing.categoryId;

      if (nextWorkspaceId != null) {
        const workspace = workspaceRepository.findByIdForUser(nextWorkspaceId, session.id);

        if (!workspace) {
          set.status = 400;
          return fail("Workspace not found");
        }
      }

      if (nextCategoryId != null) {
        const category = categoryRepository.findByIdForUser(nextCategoryId, session.id);

        if (!category) {
          set.status = 400;
          return fail("Category not found");
        }
      }

      const note = noteRepository.update(Number(id), session.id, {
        title: body.title !== undefined ? body.title.trim() : existing.title,
        categoryId: nextCategoryId,
        workspaceId: nextWorkspaceId,
        content:
          body.content !== undefined
            ? stringifyJson(body.content, existing.content)
            : existing.content,
        tags:
          body.tags !== undefined
            ? stringifyJson(body.tags, existing.tags)
            : existing.tags,
        props:
          body.props !== undefined
            ? stringifyJson(body.props, existing.props)
            : existing.props,
        updatedAt: new Date().toISOString(),
      });

      return ok({ note: toNoteDto(note) });
    },
    {
      params: t.Object({ id: t.String() }),
      body: t.Object({
        title: t.Optional(t.String({ minLength: 1 })),
        categoryId: t.Optional(t.Union([t.Number(), t.Null()])),
        workspaceId: t.Optional(t.Union([t.Number(), t.Null()])),
        content: t.Optional(t.Any()),
        tags: t.Optional(t.Array(t.String())),
        props: t.Optional(t.Any()),
      }),
    },
  )
  .delete(
    "/:id",
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

      noteRepository.delete(Number(id), session.id);
      return ok({ success: true });
    },
    {
      params: t.Object({ id: t.String() }),
    },
  );
