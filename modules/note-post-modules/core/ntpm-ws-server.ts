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
import ws from "@elysiajs/websocket";
import { resolvePostAuth } from "../../../back/src/middleware/post-auth";
import { ntpmEvents } from "./ntpm-events";

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

  // Helper: broadcast to all subscribed clients of a post
  function broadcastToPost(postId: number, channel: string, data: unknown) {
    const key = String(postId);
    const postClients = clients.get(key);
    if (!postClients) return;
    const payload = JSON.stringify({ type: "message", channel, data });
    for (const client of postClients) {
      if ((client as any).__ntpmSubscribed?.has(channel)) {
        client.send(payload);
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
    .use(ws())
    .ws(`/api/post/:post_id/internal/${slug}/ws`, {
      async open(ws: any) {
        const url = new URL(ws.data.request.url);
        const token = url.searchParams.get("token") ?? undefined;
        const postIdRaw = (ws.data.params as Record<string, string>).post_id;

        const auth = await resolvePostAuth(token, postIdRaw);

        if (!auth) {
          ws.send(JSON.stringify({ type: "error", message: "Unauthorized" }));
          ws.close();
          return;
        }

        const clientId = `${auth.postId}:${auth.session.id}:${crypto.randomUUID()}`;
        const key = String(auth.postId);

        if (!clients.has(key)) clients.set(key, new Set());
        clients.get(key)!.add(ws);

        // Store auth info on ws for later use
        (ws as any).__ntpmAuth = auth;
        (ws as any).__ntpmClientId = clientId;
        (ws as any).__ntpmSubscribed = new Set<string>();

        ws.send(JSON.stringify({ type: "connected", postId: auth.postId }));
      },

      message(ws: any, raw: unknown) {
        const auth = (ws as any).__ntpmAuth;
        if (!auth) return;

        let msg: NtpmWsMessage;
        try {
          msg = JSON.parse(String(raw));
        } catch {
          ws.send(JSON.stringify({ type: "error", message: "Invalid JSON" }));
          return;
        }

        const subscribed: Set<string> = (ws as any).__ntpmSubscribed;

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
              const key = String(auth.postId);
              const postClients = clients.get(key);
              if (!postClients) return;
              const payload = JSON.stringify({ type: "message", channel, data });
              for (const client of postClients) {
                if ((client as any).__ntpmSubscribed?.has(channel)) {
                  client.send(payload);
                }
              }
            },
          };

          handler(ctx, msg.data);
        }
      },

      close(ws: any) {
        const auth = (ws as any).__ntpmAuth;
        if (!auth) return;
        const key = String(auth.postId);
        clients.get(key)?.delete(ws);
        if (clients.get(key)?.size === 0) clients.delete(key);
      },
    }) as unknown as Elysia;
}
