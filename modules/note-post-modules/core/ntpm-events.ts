/**
 * NTPM Event Bus
 *
 * Simple in-process event emitter for cross-server communication
 * (HTTP → WS). When HTTP stores data, it emits an event.
 * WS server listens and broadcasts to connected clients.
 */

type Handler = (...args: unknown[]) => void;

class NtpmEventBus {
  private listeners = new Map<string, Set<Handler>>();

  on(event: string, handler: Handler): () => void {
    if (!this.listeners.has(event)) this.listeners.set(event, new Set());
    this.listeners.get(event)!.add(handler);
    return () => this.listeners.get(event)?.delete(handler);
  }

  emit(event: string, ...args: unknown[]): void {
    const handlers = this.listeners.get(event);
    if (handlers) {
      for (const handler of handlers) {
        handler(...args);
      }
    }
  }
}

// Singleton — shared across all modules
export const ntpmEvents = new NtpmEventBus();
