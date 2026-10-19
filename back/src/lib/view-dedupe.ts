/**
 * Keeps a refresh, a prefetch or a bot loop from inflating the view counter:
 * the same visitor opening the same link again within the window is not a new
 * view. The visitor is an IP + user-agent hash, kept in memory only (a restart
 * merely forgets the window), so nothing identifying is stored.
 */
const WINDOW_MS = 30 * 60 * 1000;
const MAX_ENTRIES = 10_000;
const seen = new Map<string, number>();

export function visitorKey(headers: Record<string, string | undefined>) {
  const ip =
    headers["cf-connecting-ip"] ??
    headers["x-forwarded-for"]?.split(",")[0]?.trim() ??
    headers["x-real-ip"] ??
    "unknown";

  return String(Bun.hash(`${ip}|${headers["user-agent"] ?? ""}`));
}

/** `true` the first time `key` is seen in the window, and starts the window. */
export function isNewView(key: string) {
  const now = Date.now();

  if (seen.size >= MAX_ENTRIES) {
    for (const [entry, at] of seen) {
      if (now - at >= WINDOW_MS) {
        seen.delete(entry);
      }
    }

    if (seen.size >= MAX_ENTRIES) {
      seen.clear();
    }
  }

  const last = seen.get(key);

  if (last !== undefined && now - last < WINDOW_MS) {
    return false;
  }

  seen.set(key, now);
  return true;
}
