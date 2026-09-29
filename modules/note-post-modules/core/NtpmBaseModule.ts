/**
 * NTPM Base Module
 *
 * Abstract base class for all Note Post Modules.
 * Every module receives data from outside, stores it in SQLite,
 * and presents it via frontend component.
 *
 * Subclasses define: payload type, validation, normalization, custom routes.
 */

import { Elysia, t } from "elysia";
import { NtpmModuleStorage } from "./ntpm-storage";
import { createNtpmWsRoute } from "./ntpm-ws-server";
import type { NtpmWsContext } from "./ntpm-ws-server";
import { ntpmEvents } from "./ntpm-events";
import { verifyNtpmAuth } from "./ntpm-auth";

export interface NtpmModuleConfig {
  /** Unique module slug (e.g. "data-vault", "cookie-keeper") */
  slug: string;
  /** Human-readable name */
  name: string;
  /** Module version */
  version: string;
}

export abstract class NtpmBaseModule<TPayload> {
  public readonly config: NtpmModuleConfig;
  protected storage: NtpmModuleStorage;

  constructor(config: NtpmModuleConfig) {
    this.config = config;
    this.storage = new NtpmModuleStorage(config.slug);
  }

  // ── Lifecycle ──────────────────────────────────────────────

  /**
   * Called once when the module is loaded by the backend.
   * Override to perform initialization (migrations, etc).
   */
  public async onInit(): Promise<void> {
    this.storage.migrate();
  }

  /**
   * Called when the module is unloaded.
   */
  public async onDestroy(): Promise<void> {}

  // ── Payload contract ───────────────────────────────────────

  /**
   * Validate incoming payload. Return array of error messages.
   */
  public abstract validate(payload: TPayload): string[];

  /**
   * Normalize incoming payload (trim, defaults, etc).
   */
  public abstract normalize(payload: TPayload): TPayload;

  // ── HTTP Server ────────────────────────────────────────────

  /**
   * Create Elysia plugin with dynamic :post_id param.
   * Used by NtpmServiceManager to mount modules into the main app.
   * Routes: POST/GET/PUT/DELETE /entries, GET /stats, + custom routes.
   */
  public createPlugin(): Elysia {
    const slug = this.config.slug;
    const mod = this;
    const prefix = `/api/post/:post_id/internal/${slug}`;

    const base = new Elysia({ prefix })
      .post("/entries", ({ headers, params, body, set }: any) => {
        const auth = verifyNtpmAuth(headers?.authorization, (params as Record<string, string>).post_id);
        if (!auth) { set.status = 401; return { error: "Unauthorized" }; }
        const errors = mod.validate(body as TPayload);
        if (errors.length) {
          set.status = 400;
          return { errors };
        }
        const normalized = mod.normalize(body as TPayload);
        const record = mod.storage.insert(auth.postId, normalized);
        ntpmEvents.emit(`${slug}:entry:created`, auth.postId, record);
        return record;
      })
      .get("/entries", ({ headers, params, set }: any) => {
        const auth = verifyNtpmAuth(headers?.authorization, (params as Record<string, string>).post_id);
        if (!auth) { set.status = 401; return { error: "Unauthorized" }; }
        return mod.storage.listByPostId(auth.postId);
      })
      .get("/entries/:id", ({ headers, params, set }: any) => {
        const auth = verifyNtpmAuth(headers?.authorization, (params as Record<string, string>).post_id);
        if (!auth) { set.status = 401; return { error: "Unauthorized" }; }
        const record = mod.storage.findById((params as Record<string, string>).id);
        if (!record) {
          set.status = 404;
          return { error: "Not found" };
        }
        return record;
      })
      .put("/entries/:id", ({ headers, params, body, set }: any) => {
        const auth = verifyNtpmAuth(headers?.authorization, (params as Record<string, string>).post_id);
        if (!auth) { set.status = 401; return { error: "Unauthorized" }; }
        const updated = mod.storage.update((params as Record<string, string>).id, body as TPayload);
        if (!updated) {
          set.status = 404;
          return { error: "Not found" };
        }
        return updated;
      })
      .delete("/entries/:id", ({ headers, params, set }: any) => {
        const auth = verifyNtpmAuth(headers?.authorization, (params as Record<string, string>).post_id);
        if (!auth) { set.status = 401; return { error: "Unauthorized" }; }
        const deleted = mod.storage.delete((params as Record<string, string>).id);
        if (!deleted) {
          set.status = 404;
          return { error: "Not found" };
        }
        ntpmEvents.emit(`${slug}:entry:deleted`, auth.postId, (params as Record<string, string>).id);
        return { deleted: true };
      })
      .get("/stats", ({ headers, params, set }: any) => {
        const auth = verifyNtpmAuth(headers?.authorization, (params as Record<string, string>).post_id);
        if (!auth) { set.status = 401; return { error: "Unauthorized" }; }
        return mod.storage.stats(auth.postId);
      });

    return this.createCustomRoutes(base as Elysia, -1, (params) => Number(params.post_id)) as unknown as Elysia;
  }

  /**
   * Create Elysia HTTP server for this module.
   * Base routes: POST /entries, GET /entries, GET /entries/:id,
   *   PUT /entries/:id, DELETE /entries/:id, GET /stats.
   *
   * Override `createCustomRoutes()` to add module-specific endpoints.
   */
  public createServer(postId: number): Elysia {
    const prefix = `/api/post/${postId}/internal/${this.config.slug}`;
    const mod = this;

    const base = new Elysia({ prefix })
      // Store incoming data
      .post("/entries", ({ body, set }) => {
        const errors = mod.validate(body as TPayload);
        if (errors.length) {
          set.status = 400;
          return { errors };
        }
        const normalized = mod.normalize(body as TPayload);
        const record = mod.storage.insert(postId, normalized);
        ntpmEvents.emit(`${mod.config.slug}:entry:created`, postId, record);
        return record;
      })

      // List all entries
      .get("/entries", () => {
        return mod.storage.listByPostId(postId);
      })

      // Get single entry
      .get("/entries/:id", ({ params: { id }, set }) => {
        const record = mod.storage.findById(id);
        if (!record) {
          set.status = 404;
          return { error: "Not found" };
        }
        return record;
      })

      // Update entry
      .put("/entries/:id", ({ params: { id }, body, set }) => {
        const updated = mod.storage.update(id, body as TPayload);
        if (!updated) {
          set.status = 404;
          return { error: "Not found" };
        }
        return updated;
      })

      // Delete entry
      .delete("/entries/:id", ({ params: { id }, set }) => {
        const deleted = mod.storage.delete(id);
        if (!deleted) {
          set.status = 404;
          return { error: "Not found" };
        }
        ntpmEvents.emit(`${mod.config.slug}:entry:deleted`, postId, id);
        return { deleted: true };
      })

      // Stats
      .get("/stats", () => {
        return mod.storage.stats(postId);
      });

    // Attach module-specific routes
    return this.createCustomRoutes(base as Elysia, postId) as Elysia;
  }

  /**
   * Override to add module-specific HTTP routes.
   * Use `postIdExtractor` to get postId from request params in your handlers.
   * Example: `.get("/search", ({ params }) => { const pid = postIdExtractor(params); ... })`
   */
  protected createCustomRoutes(app: Elysia, postId: number, postIdExtractor?: (params: Record<string, string>) => number): Elysia {
    return app;
  }

  // ── WebSocket ─────────────────────────────────────────────

  /**
   * Override to define WS channels for this module.
   * Each channel has a name and a handler.
   */
  public createWsChannels(): Array<{ name: string; handler: (ctx: NtpmWsContext, data: unknown) => void }> {
    return [];
  }

  /**
   * Override to define event bus → WS channel mappings.
   * When HTTP stores data, the event fires and WS broadcasts to subscribed clients.
   */
  public createWsEventMappings(): Array<{
    event: string;
    channel: string;
    transform?: (...args: unknown[]) => unknown;
  }> {
    return [];
  }

  /**
   * Create WebSocket route for this module.
   * Returns an Elysia app with WS endpoint at /api/post/:post_id/internal/:slug/ws
   */
  public createWsServer(): Elysia {
    const channels = this.createWsChannels();
    const eventMappings = this.createWsEventMappings();
    if (!channels.length && !eventMappings.length) return new Elysia();
    return createNtpmWsRoute(this.config.slug, channels, eventMappings) as unknown as Elysia;
  }
}
