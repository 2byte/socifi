/**
 * NTPM WebSocket Server
 *
 * Generic WebSocket server for NTPM modules.
 * Handles authentication, channel routing, and message broadcasting.
 *
 * Protocol:
 *   Client → Server: { "type": "subscribe", "channel": "name" }
 *   Client → Server: { "type": "message", "channel": "name", "data": {...} }
 *   Server → Client: { "type": "message", "channel": "name", "data": {...} }
 *   Server → Client: { "type": "error", "message": "..." }
 *   Server → Client: { "type": "subscribed", "channel": "name" }
 */

import { Elysia } from "elysia";
import { resolvePostAuth } from "../../../back/src/middleware/post-auth";
import { ntpmEvents } from "./ntpm-events";
import { verifyNtpmAuth } from "./ntpm-auth";

export interface NtpmWsMessage {
  type: "subscribe" | "message" | "unsubscribe";
  channel: string;
  data?: unknown;
}

export interface NtpmWsContext {
  postId: number;
  userId: number;
  login: string;
  send: (channel: string, data: unknown) => void;
  broadcast: (channel: string, data: unknown) => void;
}

type WsHandler = (ctx: NtpmWsContext, data: unknown) => void | Promise<void>;

interface ChannelDef {
  name: string;
  handler: WsHandler;
}

interface EventMapping {
  /** Event name on the event bus (e.g. "data-vault:entry:created") */
  event: string;
  /** WS channel to broadcast to (e.g. "vault:new") */
  channel: string;
  /** Optional transform: receives event args, returns data to broadcast */
  transform?: (...args: unknown[]) => unknown;
}

/**
 * Creates a WebSocket route for an NTPM module.
 *
 * @param slug Module slug (e.g. "data-vault")
 * @param channels Channel definitions with handlers
 * @param eventMappings Event bus → WS channel mappings for auto-broadcast
 * @returns Elysia app with WS route mounted
 */
export function createNtpmWsRoute(
  slug: string,
  channels: ChannelDef[],
  eventMappings: EventMapping[] = [],
): Elysia {
  const channelMap = new Map(channels.map((c) => [c.name, c.handler]));

  // Track connected clients per post
  const clients = new Map<string, Set<any>>();

  // Per-connection state. Elysia hands each handler a fresh wrapper object, so
  // anything stashed on `ws` in `open` is gone by `message`; the underlying
  // socket (`ws.raw`) is the one object that stays the same.
  interface Conn {
    auth: { postId: number; session: { id: number; login: string }; isNtpmToken: boolean };
    subscribed: Set<string>;
    send: (payload: string) => void;
  }
  const conns = new Map<unknown, Conn>();
  const connKey = (ws: any) => ws.raw ?? ws;

  // Helper: broadcast to all subscribed clients of a post
  function broadcastToPost(postId: number, channel: string, data: unknown) {
    const key = String(postId);
    const postClients = clients.get(key);
    if (!postClients) return;
    const payload = JSON.stringify({ type: "message", channel, data });
    for (const client of postClients) {
      const conn = conns.get(client);
      if (conn?.subscribed.has(channel)) {
        conn.send(payload);
      }
    }
  }

  // Listen to event bus and auto-broadcast
  for (const mapping of eventMappings) {
    ntpmEvents.on(mapping.event, (...args: unknown[]) => {
      const postId = args[0] as number;
      const data = mapping.transform ? mapping.transform(...args) : args[1];
      broadcastToPost(postId, mapping.channel, data);
    });
  }

  return new Elysia()
    .ws(`/post/:post_id/internal/${slug}/ws`, {
      async open(ws: any) {
        const url = new URL(ws.data.request.url);
        const token = url.searchParams.get("token") ?? undefined;
        const postIdRaw = (ws.data.params as Record<string, string>).post_id;
        const postId = Number(postIdRaw);

        if (!Number.isFinite(postId) || postId <= 0) {
          ws.send(JSON.stringify({ type: "error", message: "Invalid post id" }));
          ws.close();
          return;
        }

        let session: { id: number; login: string } | null = null;
        let isNtpmToken = false;

        // Try NTPM post-specific token first
        const authResult = verifyNtpmAuth(token ? `Bearer ${token}` : undefined, postIdRaw);
        if (authResult) {
          session = authResult.session;
          isNtpmToken = authResult.isNtpmToken;
        } else {
          // Fall back to JWT auth
          const jwtAuth = await resolvePostAuth(token, postIdRaw);
          if (!jwtAuth) {
            ws.send(JSON.stringify({ type: "error", message: "Unauthorized" }));
            ws.close();
            return;
          }
          session = jwtAuth.session;
        }

        const userId = session?.id ?? 0;
        const login = session?.login ?? "ntpm-token";
        const clientId = `${postId}:${userId}:${crypto.randomUUID()}`;
        const key = String(postId);

        if (!clients.has(key)) clients.set(key, new Set());
        clients.get(key)!.add(connKey(ws));

        conns.set(connKey(ws), {
          auth: { postId, session: { id: userId, login }, isNtpmToken },
          subscribed: new Set<string>(),
          send: (payload) => ws.send(payload),
        });
        void clientId;

        ws.send(JSON.stringify({ type: "connected", postId }));
      },

      message(ws: any, raw: unknown) {
        const conn = conns.get(connKey(ws));
        if (!conn) return;
        const { auth } = conn;

        // Elysia parses JSON frames for us; fall back to parsing text ones.
        let msg: NtpmWsMessage;
        try {
          msg = typeof raw === "object" && raw !== null ? (raw as NtpmWsMessage) : JSON.parse(String(raw));
        } catch {
          ws.send(JSON.stringify({ type: "error", message: "Invalid JSON" }));
          return;
        }

        const subscribed = conn.subscribed;

        if (msg.type === "subscribe") {
          if (!channelMap.has(msg.channel)) {
            ws.send(JSON.stringify({ type: "error", message: `Unknown channel: ${msg.channel}` }));
            return;
          }
          subscribed.add(msg.channel);
          ws.send(JSON.stringify({ type: "subscribed", channel: msg.channel }));
          return;
        }

        if (msg.type === "unsubscribe") {
          subscribed.delete(msg.channel);
          ws.send(JSON.stringify({ type: "unsubscribed", channel: msg.channel }));
          return;
        }

        if (msg.type === "message") {
          if (!subscribed.has(msg.channel)) {
            ws.send(JSON.stringify({ type: "error", message: `Not subscribed to: ${msg.channel}` }));
            return;
          }

          const handler = channelMap.get(msg.channel);
          if (!handler) return;

          const ctx: NtpmWsContext = {
            postId: auth.postId,
            userId: auth.session.id,
            login: auth.session.login,
            send: (channel: string, data: unknown) => {
              ws.send(JSON.stringify({ type: "message", channel, data }));
            },
            broadcast: (channel: string, data: unknown) => {
              broadcastToPost(auth.postId, channel, data);
            },
          };

          handler(ctx, msg.data);
        }
      },

      close(ws: any) {
        const conn = conns.get(connKey(ws));
        if (!conn) return;
        const key = String(conn.auth.postId);
        clients.get(key)?.delete(connKey(ws));
        if (clients.get(key)?.size === 0) clients.delete(key);
        conns.delete(connKey(ws));
      },
    }) as unknown as Elysia;
}
