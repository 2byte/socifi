/**
 * useNtpmWs — Vue composable for NTPM module WebSocket.
 *
 * Handles connection, auth, channel subscription, and message handling.
 */

import { ref, onUnmounted, type Ref } from "vue";

export interface NtpmWsOptions {
  postId: number;
  moduleSlug: string;
  token: string;
  /** API root the app is served behind; `/api` unless configured otherwise. */
  apiRoot?: string;
}

export interface NtpmWsMessage {
  type: "message" | "error" | "connected" | "subscribed" | "unsubscribed";
  channel?: string;
  data?: unknown;
  message?: string;
}

export function useNtpmWs(options: NtpmWsOptions) {
  const { postId, moduleSlug, token, apiRoot = "/api" } = options;

  const connected = ref(false);
  const error = ref<string | null>(null);
  const socket: Ref<WebSocket | null> = ref(null);

  // Channel handlers: channelName → Set<callback>
  const handlers = new Map<string, Set<(data: unknown) => void>>();

  function connect() {
    // `apiRoot` is either a path on this origin ("/api") or an absolute URL.
    const root = /^https?:///.test(apiRoot)
      ? apiRoot.replace(/^http/, "ws")
      : `${window.location.protocol === "https:" ? "wss:" : "ws:"}//${window.location.host}${apiRoot}`;
    const url = `${root}/post/${postId}/internal/${moduleSlug}/ws?token=${encodeURIComponent(token)}`;

    // A socket that cannot open must never take the module page down with it.
    let ws: WebSocket;
    try {
      ws = new WebSocket(url);
    } catch (e) {
      error.value = String(e);
      return;
    }
    socket.value = ws;

    ws.onopen = () => {
      connected.value = true;
      error.value = null;
    };

    ws.onmessage = (event) => {
      let msg: NtpmWsMessage;
      try {
        msg = JSON.parse(event.data);
      } catch {
        return;
      }

      if (msg.type === "error") {
        error.value = msg.message ?? "Unknown error";
        return;
      }

      if (msg.type === "message" && msg.channel) {
        const channelHandlers = handlers.get(msg.channel);
        if (channelHandlers) {
          for (const cb of channelHandlers) {
            cb(msg.data);
          }
        }
      }
    };

    ws.onerror = () => {
      error.value = "Connection error";
    };

    ws.onclose = () => {
      connected.value = false;
      socket.value = null;
    };
  }

  function disconnect() {
    socket.value?.close();
    socket.value = null;
    connected.value = false;
  }

  /**
   * Subscribe to a channel and register a handler.
   */
  function onChannel(channel: string, callback: (data: unknown) => void) {
    if (!handlers.has(channel)) {
      handlers.set(channel, new Set());
      // Send subscribe message if already connected
      if (socket.value?.readyState === WebSocket.OPEN) {
        socket.value.send(JSON.stringify({ type: "subscribe", channel }));
      }
    }
    handlers.get(channel)!.add(callback);
  }

  /**
   * Remove a handler from a channel.
   */
  function offChannel(channel: string, callback: (data: unknown) => void) {
    handlers.get(channel)?.delete(callback);
  }

  /**
   * Send a message to a channel.
   */
  function send(channel: string, data: unknown) {
    if (socket.value?.readyState === WebSocket.OPEN) {
      socket.value.send(JSON.stringify({ type: "message", channel, data }));
    }
  }

  /**
   * Subscribe to a channel (send subscribe message).
   */
  function subscribe(channel: string) {
    if (socket.value?.readyState === WebSocket.OPEN) {
      socket.value.send(JSON.stringify({ type: "subscribe", channel }));
    }
  }

  // Auto-connect
  connect();

  // Auto-disconnect on unmount
  onUnmounted(() => {
    disconnect();
  });

  return {
    connected,
    error,
    socket,
    connect,
    disconnect,
    onChannel,
    offChannel,
    send,
    subscribe,
  };
}
