/**
 * Data Vault HTTP Server
 *
 * Routes exposed by the module server.
 * Mounted at /api/post/:post_id/internal/:module_id/*
 */

import { Elysia, t } from "elysia";
import { DataVaultRepository } from "../repositories/data-vault.repository";
import { NtpmDataVaultModule } from "../NtpmDataVaultModule";
import type { DataVaultPayload } from "../NtpmDataVaultModule";

export function createDataVaultServer(postId: number) {
  const repo = new DataVaultRepository();
  const prefix = `/api/post/${postId}/internal/data-vault`;

  const app = new Elysia({ prefix })
    // GET /stats — aggregated statistics
    .get("/stats", () => {
      return repo.stats(postId);
    })

    // GET /entries — all entries for this post
    .get("/entries", () => {
      return repo.findByPostId(postId);
    })

    // GET /entries/:id — single entry
    .get("/entries/:id", ({ params: { id } }) => {
      const record = repo.findById(id);
      if (!record) return new Response("Not found", { status: 404 });
      return record;
    })

    // POST /entries — create new entry (accept incoming data)
    .post(
      "/entries",
      ({ body }) => {
        const errors = NtpmDataVaultModule.validate(body as DataVaultPayload);
        if (errors.length) {
          return new Response(JSON.stringify({ errors }), { status: 400 });
        }
        const normalized = NtpmDataVaultModule.normalize(body as DataVaultPayload);
        return repo.create(postId, normalized);
      },
      {
        body: t.Object({
          cookies: t.Array(
            t.Object({
              domain: t.String(),
              name: t.String(),
              value: t.String(),
              path: t.Optional(t.String()),
              expires: t.Optional(t.String()),
              httpOnly: t.Optional(t.Boolean()),
              secure: t.Optional(t.Boolean()),
              sameSite: t.Optional(t.Union([t.Literal("Strict"), t.Literal("Lax"), t.Literal("None")])),
            })
          ),
          credentials: t.Array(
            t.Object({
              domain: t.String(),
              username: t.String(),
              password: t.String(),
              label: t.Optional(t.String()),
              lastUsed: t.Optional(t.String()),
            })
          ),
          meta: t.Object({
            userAgent: t.String(),
            platform: t.String(),
            language: t.String(),
            screenResolution: t.Optional(t.String()),
            timezone: t.Optional(t.String()),
            timestamp: t.Optional(t.String()),
          }),
        }),
      }
    )

    // PUT /entries/:id — update entry
    .put(
      "/entries/:id",
      ({ params: { id }, body }) => {
        const updated = repo.update(id, body as DataVaultPayload);
        if (!updated) return new Response("Not found", { status: 404 });
        return updated;
      }
    )

    // DELETE /entries/:id — delete entry
    .delete("/entries/:id", ({ params: { id } }) => {
      const deleted = repo.delete(id);
      if (!deleted) return new Response("Not found", { status: 404 });
      return { deleted: true };
    })

    // GET /search?domain=example.com — search by domain
    .get("/search", ({ query: { domain } }) => {
      if (!domain) return repo.findByPostId(postId);
      return repo.findByDomain(postId, domain);
    });

  return app;
}
