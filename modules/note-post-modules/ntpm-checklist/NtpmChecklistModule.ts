/**
 * NTPM Checklist Module
 *
 * The smallest useful NTPM: a to-do list that lives inside a note post.
 * One entry per item, so the base class's CRUD is the whole API — the module
 * only says what a valid item is and announces changes over WebSocket so that
 * two open tabs stay in sync.
 */

import { NtpmBaseModule } from "../core/NtpmBaseModule";

export interface ChecklistItem {
  text: string;
  done: boolean;
}

const MAX_TEXT_LENGTH = 500;

export class NtpmChecklistModule extends NtpmBaseModule<ChecklistItem> {
  constructor() {
    super({
      slug: "checklist",
      name: "Checklist",
      version: "0.1.0",
      // Readable by anyone with the link; editable too once the post owner allows it.
      guests: { read: true, write: true },
    });
  }

  public validate(payload: ChecklistItem): string[] {
    const errors: string[] = [];

    if (typeof payload?.text !== "string" || !payload.text.trim()) {
      errors.push("text is required");
    } else if (payload.text.length > MAX_TEXT_LENGTH) {
      errors.push(`text must be at most ${MAX_TEXT_LENGTH} characters`);
    }

    if (typeof payload?.done !== "boolean") {
      errors.push("done must be a boolean");
    }

    return errors;
  }

  public normalize(payload: ChecklistItem): ChecklistItem {
    return { text: payload.text.trim(), done: payload.done };
  }

  // ── WebSocket ────────────────────────────────────────────

  /** One channel; clients subscribe and refetch when it fires. */
  public override createWsChannels() {
    return [{ name: "checklist:changed", handler: () => {} }];
  }

  public override createWsEventMappings() {
    const channel = "checklist:changed";
    // Events carry (postId, record) or, for deletes, (postId, id).
    const change = (kind: string) => (...args: unknown[]) => {
      const subject = args[1];
      return { kind, id: typeof subject === "string" ? subject : (subject as { id?: string })?.id };
    };

    return [
      { event: "checklist:entry:created", channel, transform: change("created") },
      { event: "checklist:entry:updated", channel, transform: change("updated") },
      { event: "checklist:entry:deleted", channel, transform: change("deleted") },
    ];
  }
}
