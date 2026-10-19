import { Elysia, t } from "elysia";
import { config } from "../config";
import { attachmentResponse } from "../lib/file-response";
import { fail, ok } from "../lib/http";
import { storage } from "../lib/storage";
import { toAttachmentDto } from "../mappers/share.mapper";
import { auth as authPlugin, resolveSession } from "../middleware/auth";
import { targetRepository } from "../repositories/target.repository";

const targetType = t.Union([t.Literal("note"), t.Literal("post")]);

/** Files attached to a note or a post (polymorphic target), owner side. */
export const attachmentRoutes = new Elysia({ prefix: "/attachments" })
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

      const rows = targetRepository.listAttachments(query.type, query.id);
      return ok({ attachments: rows.map(toAttachmentDto) });
    },
    { query: t.Object({ type: targetType, id: t.Numeric() }) },
  )
  .post(
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

      const files = Array.isArray(body.files) ? body.files : [body.files];

      if (files.some((file) => file.size > config.maxUploadBytes)) {
        set.status = 413;
        return fail(`File is larger than ${Math.floor(config.maxUploadBytes / 1024 / 1024)} MB`);
      }

      const created = [];

      for (const file of files) {
        const storageKey = await storage.save(file);

        created.push(
          targetRepository.createAttachment({
            userId: session.id,
            attachableType: body.type,
            attachableId: body.id,
            originalName: file.name || "file",
            mimeType: file.type || "application/octet-stream",
            size: file.size,
            storageKey,
          }),
        );
      }

      return ok({ attachments: created.map(toAttachmentDto) });
    },
    {
      body: t.Object({
        type: targetType,
        id: t.Numeric(),
        files: t.Union([t.File(), t.Files()]),
      }),
    },
  )
  .get(
    "/:id/file",
    async ({ params: { id }, headers, accessAuth, set }) => {
      const session = await resolveSession(headers.authorization, accessAuth);

      if (!session) {
        set.status = 401;
        return fail("Unauthorized");
      }

      const attachment = targetRepository.findAttachment(Number(id));

      if (!attachment || attachment.userId !== session.id) {
        set.status = 404;
        return fail("Not found");
      }

      const response = await attachmentResponse(attachment);

      if (!response) {
        set.status = 404;
        return fail("File is missing");
      }

      return response;
    },
    { params: t.Object({ id: t.String() }) },
  )
  .delete(
    "/:id",
    async ({ params: { id }, headers, accessAuth, set }) => {
      const session = await resolveSession(headers.authorization, accessAuth);

      if (!session) {
        set.status = 401;
        return fail("Unauthorized");
      }

      const attachment = targetRepository.findAttachment(Number(id));

      if (!attachment || attachment.userId !== session.id) {
        set.status = 404;
        return fail("Not found");
      }

      targetRepository.deleteAttachment(attachment.id);
      await storage.remove(attachment.storageKey);
      return ok({ success: true });
    },
    { params: t.Object({ id: t.String() }) },
  );
