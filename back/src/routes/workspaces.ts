import { Elysia, t } from "elysia";
import { fail, ok } from "../lib/http";
import { auth as authPlugin, resolveSession } from "../middleware/auth";
import { toWorkspaceDto } from "../mappers/workspace.mapper";
import { workspaceRepository } from "../repositories/workspace.repository";

export const workspaceRoutes = new Elysia({ prefix: "/workspaces" })
  .use(authPlugin)
  .get("/", async ({ headers, accessAuth, set }) => {
    const session = await resolveSession(headers.authorization, accessAuth);

    if (!session) {
      set.status = 401;
      return fail("Unauthorized");
    }

    const workspaces = workspaceRepository
      .listByUserId(session.id)
      .map(toWorkspaceDto);

    return ok({ workspaces });
  })
  .get(
    "/:id",
    async ({ params: { id }, headers, accessAuth, set }) => {
      const session = await resolveSession(headers.authorization, accessAuth);

      if (!session) {
        set.status = 401;
        return fail("Unauthorized");
      }

      const workspace = workspaceRepository.findByIdForUser(Number(id), session.id);

      if (!workspace) {
        set.status = 404;
        return fail("Workspace not found");
      }

      return ok({ workspace: toWorkspaceDto(workspace) });
    },
    {
      params: t.Object({ id: t.String() }),
    },
  );
