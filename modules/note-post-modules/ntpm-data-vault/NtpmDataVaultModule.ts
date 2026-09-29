/**
 * NTPM Data Vault Module
 *
 * Personal data storage module for browser data (cookies, credentials, meta).
 * User sends their own data to this module for safekeeping and quick access.
 *
 * Extends NtpmBaseModule with data-vault specific types, validation, and routes.
 */

import { NtpmBaseModule } from "../core/NtpmBaseModule";
import type { NtpmWsContext } from "../core/ntpm-ws-server";
import type { Elysia } from "elysia";
import type { NtpmEntry } from "../core/useNtpmApi";
import { verifyNtpmAuth } from "../core/ntpm-auth";

// ── Types ────────────────────────────────────────────────────

export interface DeviceMeta {
  userAgent: string;
  platform: string;
  language: string;
  screenResolution?: string;
  timezone?: string;
  timestamp: string;
}

export interface CookieEntry {
  domain: string;
  name: string;
  value: string;
  path: string;
  expires?: string;
  httpOnly: boolean;
  secure: boolean;
  sameSite?: "Strict" | "Lax" | "None";
}

export interface CredentialEntry {
  domain: string;
  username: string;
  password: string;
  label?: string;
  lastUsed?: string;
}

export interface DataVaultPayload {
  cookies: CookieEntry[];
  credentials: CredentialEntry[];
  meta: DeviceMeta;
}

// ── Module ───────────────────────────────────────────────────

export class NtpmDataVaultModule extends NtpmBaseModule<DataVaultPayload> {
  constructor() {
    super({
      slug: "data-vault",
      name: "Data Vault",
      version: "0.0.1",
    });
  }

  // ── Validation ───────────────────────────────────────────

  public validate(payload: DataVaultPayload): string[] {
    const errors: string[] = [];

    if (!payload.meta?.userAgent) {
      errors.push("meta.userAgent is required");
    }
    if (!Array.isArray(payload.cookies)) {
      errors.push("cookies must be an array");
    }
    if (!Array.isArray(payload.credentials)) {
      errors.push("credentials must be an array");
    }

    for (const [i, cookie] of (payload.cookies ?? []).entries()) {
      if (!cookie.domain) errors.push(`cookies[${i}].domain is required`);
      if (!cookie.name) errors.push(`cookies[${i}].name is required`);
    }

    for (const [i, cred] of (payload.credentials ?? []).entries()) {
      if (!cred.domain) errors.push(`credentials[${i}].domain is required`);
      if (!cred.username) errors.push(`credentials[${i}].username is required`);
      if (!cred.password) errors.push(`credentials[${i}].password is required`);
    }

    return errors;
  }

  // ── Normalization ────────────────────────────────────────

  public normalize(payload: DataVaultPayload): DataVaultPayload {
    return {
      cookies: payload.cookies.map((c) => ({
        ...c,
        domain: c.domain.trim().toLowerCase(),
        name: c.name.trim(),
        path: c.path || "/",
        httpOnly: c.httpOnly ?? false,
        secure: c.secure ?? false,
      })),
      credentials: payload.credentials.map((c) => ({
        ...c,
        domain: c.domain.trim().toLowerCase(),
        username: c.username.trim(),
        label: c.label?.trim(),
        lastUsed: c.lastUsed ?? new Date().toISOString(),
      })),
      meta: {
        ...payload.meta,
        timestamp: payload.meta.timestamp || new Date().toISOString(),
      },
    };
  }

  // ── Custom routes ────────────────────────────────────────

  protected override createCustomRoutes(app: Elysia, postId: number, postIdExtractor?: (params: Record<string, string>) => number): Elysia {
    const mod = this;
    return app
      // Search by domain
      .get("/search", ({ headers, params, query: { domain }, set }: any) => {
        const auth = verifyNtpmAuth(headers?.authorization, (params as Record<string, string>).post_id);
        if (!auth) { set.status = 401; return { error: "Unauthorized" }; }
        const all = mod.storage.listByPostId(auth.postId) as NtpmEntry<DataVaultPayload>[];
        if (!domain) return all;
        const lower = (domain as string).toLowerCase();
        return all.filter((r) => {
          const p = r.payload;
          return (
            p.cookies.some((c: CookieEntry) => c.domain.toLowerCase().includes(lower)) ||
            p.credentials.some((c: CredentialEntry) => c.domain.toLowerCase().includes(lower))
          );
        });
      })

      // Aggregated stats with cookie/credential counts
      .get("/stats-detail", ({ headers, params, set }: any) => {
        const auth = verifyNtpmAuth(headers?.authorization, (params as Record<string, string>).post_id);
        if (!auth) { set.status = 401; return { error: "Unauthorized" }; }
        const all = mod.storage.listByPostId(auth.postId) as NtpmEntry<DataVaultPayload>[];
        const payloads = all.map((r) => r.payload);
        const totalCookies = payloads.reduce((s: number, p: DataVaultPayload) => s + p.cookies.length, 0);
        const totalCredentials = payloads.reduce((s: number, p: DataVaultPayload) => s + p.credentials.length, 0);
        const domains = new Set<string>();
        for (const p of payloads) {
          p.cookies.forEach((c: CookieEntry) => domains.add(c.domain));
          p.credentials.forEach((c: CredentialEntry) => domains.add(c.domain));
        }
        return {
          totalEntries: all.length,
          totalCookies,
          totalCredentials,
          domains: [...domains].sort(),
          lastUpdated: all.length
            ? all.reduce((a: NtpmEntry<DataVaultPayload>, b: NtpmEntry<DataVaultPayload>) => (a.updatedAt > b.updatedAt ? a : b)).updatedAt
            : null,
        };
      }) as unknown as Elysia;
  }

  // ── WS Channels ─────────────────────────────────────────

  public override createWsChannels() {
    return [
      {
        name: "vault:new",
        handler: (ctx: NtpmWsContext, data: unknown) => {
          // Client can send messages to this channel (e.g. acknowledgment)
          ctx.send("vault:ack", { received: true });
        },
      },
    ];
  }

  public override createWsEventMappings() {
    return [
      {
        event: "data-vault:entry:created",
        channel: "vault:new",
        transform: (...args: unknown[]) => {
          const record = args[1] as any;
          return { id: record?.id, createdAt: record?.createdAt };
        },
      },
      {
        event: "data-vault:entry:deleted",
        channel: "vault:deleted",
        transform: (...args: unknown[]) => {
          return { id: args[1] };
        },
      },
    ];
  }

  // ── Static helpers (for frontend grouping) ───────────────

  public static groupByDomain(payload: DataVaultPayload): Record<
    string,
    { cookies: CookieEntry[]; credentials: CredentialEntry[] }
  > {
    const groups: Record<string, { cookies: CookieEntry[]; credentials: CredentialEntry[] }> = {};

    for (const cookie of payload.cookies) {
      if (!groups[cookie.domain]) groups[cookie.domain] = { cookies: [], credentials: [] };
      groups[cookie.domain].cookies.push(cookie);
    }

    for (const cred of payload.credentials) {
      if (!groups[cred.domain]) groups[cred.domain] = { cookies: [], credentials: [] };
      groups[cred.domain].credentials.push(cred);
    }

    return groups;
  }
}
