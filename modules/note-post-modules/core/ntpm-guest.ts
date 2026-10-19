/**
 * Guest access for NTPM modules.
 *
 * A guest is someone who opened a public share link of the post (or of its
 * note) without signing in. They authenticate with `Bearer share:<share token>`,
 * so turning the link off cuts their access at once.
 *
 * Two things decide what a guest may do, and both must agree:
 *
 *   1. The module's capability (`NtpmModuleConfig.guests`): what the module was
 *      *written* to support for guests. The default is nothing, so a module
 *      that never heard of guests (the data vault, say) stays closed.
 *   2. The post owner's choice, kept in the post's system `props`:
 *      `{ "guests": { "write": true } }`. Reading needs no per-post switch, since
 *      the owner already chose to share; writing does, because letting strangers
 *      change data is a decision about one particular post.
 *
 * Owners (their session, or the post's NTPM token) are never restricted here.
 */

/** What a module supports for guests. */
export interface NtpmGuestPolicy {
  /** Guests may fetch entries, stats and subscribe to live updates. */
  read: boolean;
  /** Guests may create, change and delete entries, if the post owner turns it on. */
  write: boolean;
}

export const NO_GUEST_ACCESS: NtpmGuestPolicy = { read: false, write: false };

export type NtpmRole = "owner" | "guest";

/** `read` covers every non-mutating call, `write` every mutating one. */
export type NtpmAction = "read" | "write";

/** Prefix that marks a share token in `Authorization: Bearer` and in the WS `?token=`. */
export const SHARE_TOKEN_PREFIX = "share:";

/** The owner's per-post guest settings, read from the post's `props` JSON. */
export function guestSettingsOf(propsJson: string | null | undefined): { write: boolean } {
  try {
    const props = JSON.parse(propsJson ?? "{}") as { guests?: { write?: unknown } };
    return { write: props?.guests?.write === true };
  } catch {
    return { write: false };
  }
}

/** Whether `role` may perform `action` on a module with this policy. */
export function isAllowed(
  role: NtpmRole,
  policy: NtpmGuestPolicy,
  guestWrite: boolean,
  action: NtpmAction,
) {
  if (role === "owner") {
    return true;
  }

  return action === "read" ? policy.read : policy.write && guestWrite;
}
