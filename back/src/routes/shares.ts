import { Elysia, t } from "elysia";
import { fail, ok } from "../lib/http";
import { auth as authPlugin, resolveSession } from "../middleware/auth";
import { toShareDto } from "../mappers/share.mapper";
import { targetRepository } from "../repositories/target.repository";

const targetType = t.Union([t.Literal("note"), t.Literal("post")]);

function newToken() {
  return Buffer.from(crypto.getRandomValues(new Uint8Array(24))).toString("base64url");
}

/** Owner-side management of a public link for a note or a post. */
export const shareRoutes = new Elysia({ prefix: "/shares" })
  .use(authPlugin)
  .get(
    "/",
    async ({ query, headers, accessAuth, set }) => {
      const session = await resolveSession(headers.authorization, accessAuth);

      if (!session) {
        set.status = 401;
        return fail("Unauthorized");
      }

      if (!targetRepository.findOwned(query.type, query.id, session.id)) {
        set.status = 404;
        return fail("Not found");
      }

      const share = targetRepository.findShare(query.type, query.id);
      return ok({ share: share ? toShareDto(share) : null });
    },
    { query: t.Object({ type: targetType, id: t.Numeric() }) },
  )
  // Idempotent: asking again returns the existing link rather than minting a new one.
  .put(
    "/",
    async ({ body, headers, accessAuth, set }) => {
      const session = await resolveSession(headers.authorization, accessAuth);

      if (!session) {
        set.status = 401;
        return fail("Unauthorized");
      }

      if (!targetRepository.findOwned(body.type, body.id, session.id)) {
        set.status = 404;
        return fail("Not found");
      }

      const share =
        targetRepository.findShare(body.type, body.id) ??
        targetRepository.createShare(session.id, body.type, body.id, newToken());

      return ok({ share: toShareDto(share) });
    },
    { body: t.Object({ type: targetType, id: t.Number() }) },
  )
  .delete(
    "/",
    async ({ query, headers, accessAuth, set }) => {
      const session = await resolveSession(headers.authorization, accessAuth);

      if (!session) {
        set.status = 401;
        return fail("Unauthorized");
      }

      if (!targetRepository.findOwned(query.type, query.id, session.id)) {
        set.status = 404;
        return fail("Not found");
      }

      targetRepository.deleteShare(query.type, query.id);
      return ok({ share: null });
    },
    { query: t.Object({ type: targetType, id: t.Numeric() }) },
  );
