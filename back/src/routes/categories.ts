import { Elysia, t } from "elysia";
import { fail, ok } from "../lib/http";
import { resolveSession, auth as authPlugin } from "../middleware/auth";
import { toCategoryDto } from "../mappers/category.mapper";
import { categoryRepository } from "../repositories/category.repository";
import { workspaceRepository } from "../repositories/workspace.repository";

export const categoryRoutes = new Elysia({ prefix: "/categories" })
  .use(authPlugin)
  .get("/", async ({ headers, accessAuth, set }) => {
    const session = await resolveSession(headers.authorization, accessAuth);

    if (!session) {
      set.status = 401;
      return fail("Unauthorized");
    }

    const categories = categoryRepository
      .listByUserId(session.id)
      .map(toCategoryDto);

    return ok({ categories });
  })
  .get(
    "/:id",
    async ({ params: { id }, headers, accessAuth, set }) => {
      const session = await resolveSession(headers.authorization, accessAuth);

      if (!session) {
        set.status = 401;
        return fail("Unauthorized");
      }

      const category = categoryRepository.findByIdForUser(Number(id), session.id);

      if (!category) {
        set.status = 404;
        return fail("Category not found");
      }

      return ok({ category: toCategoryDto(category) });
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

      if (workspaceId == null) {
        workspaceId = workspaceRepository.findDefaultByUserId(session.id)?.id ?? null;
      }

      if (workspaceId != null) {
        const workspace = categoryRepository.findWorkspaceByIdForUser(
          workspaceId,
          session.id,
        );

        if (!workspace) {
          set.status = 400;
          return fail("Workspace not found");
        }
      }

      const now = new Date().toISOString();
      const category = categoryRepository.create({
        userId: session.id,
        workspaceId,
        name: body.name.trim(),
        props: body.props?.trim() || "{}",
        createdAt: now,
        updatedAt: now,
      });

      return ok({ category: toCategoryDto(category) });
    },
    {
      body: t.Object({
        name: t.String({ minLength: 1 }),
        workspaceId: t.Optional(t.Union([t.Number(), t.Null()])),
        props: t.Optional(t.String()),
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

      const existing = categoryRepository.findByIdForUser(Number(id), session.id);

      if (!existing) {
        set.status = 404;
        return fail("Category not found");
      }

      const nextWorkspaceId =
        body.workspaceId !== undefined ? body.workspaceId : existing.workspaceId;

      if (nextWorkspaceId != null) {
        const workspace = categoryRepository.findWorkspaceByIdForUser(
          nextWorkspaceId,
          session.id,
        );

        if (!workspace) {
          set.status = 400;
          return fail("Workspace not found");
        }
      }

      const category = categoryRepository.update(Number(id), session.id, {
        name: body.name?.trim() || existing.name,
        workspaceId: nextWorkspaceId,
        props: body.props !== undefined ? body.props.trim() || "{}" : existing.props,
        updatedAt: new Date().toISOString(),
      });

      return ok({ category: toCategoryDto(category) });
    },
    {
      params: t.Object({ id: t.String() }),
      body: t.Object({
        name: t.Optional(t.String({ minLength: 1 })),
        workspaceId: t.Optional(t.Union([t.Number(), t.Null()])),
        props: t.Optional(t.String()),
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

      const category = categoryRepository.findByIdForUser(Number(id), session.id);

      if (!category) {
        set.status = 404;
        return fail("Category not found");
      }

      categoryRepository.delete(Number(id), session.id);

      return ok({ success: true });
    },
    {
      params: t.Object({ id: t.String() }),
    },
  );
