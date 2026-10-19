import { Elysia, t } from "elysia";
import { guestSettingsOf } from "../../../modules/note-post-modules/core/ntpm-guest";
import type {
  PublicNoteDto,
  PublicPostDto,
  PublicPostModuleDto,
  PublicShareDto,
} from "../contracts/share";
import type { JsonValue } from "../contracts/note";
import type { Attachment, NotePost, Share } from "../db/schema";
import { attachmentResponse } from "../lib/file-response";
import { fail } from "../lib/http";
import { visitorKey, isNewView } from "../lib/view-dedupe";
import { toPublicAttachmentDto } from "../mappers/share.mapper";
import { auth as authPlugin, resolveSession } from "../middleware/auth";
import { NtpmServiceManager } from "../note-post-module/NtpmServiceManager";
import { noteRepository } from "../repositories/note.repository";
import { targetRepository } from "../repositories/target.repository";

function parseJson(value: string, fallback: JsonValue): JsonValue {
  try {
    return JSON.parse(value) as JsonValue;
  } catch {
    return fallback;
  }
}

function parseTags(value: string) {
  const parsed = parseJson(value, []);
  return Array.isArray(parsed) ? parsed.filter((tag): tag is string => typeof tag === "string") : [];
}

/**
 * The module under a shared post. It holds live, token-guarded data: a module
 * that declares guest support is handed to the page (which then talks to it with
 * the share token); any other module is reduced to a hidden marker, so guests
 * only learn that one exists.
 */
function publicModule(post: NotePost): PublicPostModuleDto | null {
  if (!post.moduleSlug) {
    return null;
  }

  const policy = NtpmServiceManager.getModule(post.moduleSlug)?.config.guests;

  if (!policy?.read) {
    return { hidden: true };
  }

  return {
    slug: post.moduleSlug,
    guests: { read: true, write: policy.write && guestSettingsOf(post.props).write },
  };
}

function groupByTarget(rows: Attachment[]) {
  const groups = new Map<number, Attachment[]>();

  for (const row of rows) {
    const list = groups.get(row.attachableId) ?? [];
    list.push(row);
    groups.set(row.attachableId, list);
  }

  return groups;
}

function toPublicPost(post: NotePost, files: Attachment[] = []): PublicPostDto {
  return {
    id: post.id,
    format: post.format,
    content: parseJson(post.content, ""),
    module: publicModule(post),
    tags: parseTags(post.tags),
    createdAt: post.createdAt,
    attachments: files.map(toPublicAttachmentDto),
  };
}

/** Builds what the link shows, or `null` when its target no longer exists. */
function buildPublicShare(share: Share): PublicShareDto | null {
  if (share.shareableType === "post") {
    const post = noteRepository.findPostById(share.shareableId);

    if (!post) {
      return null;
    }

    return {
      kind: "post",
      note: null,
      posts: [toPublicPost(post, targetRepository.listAttachments("post", post.id))],
    };
  }

  const note = noteRepository.findById(share.shareableId);

  if (!note) {
    return null;
  }

  const posts = noteRepository.listPostsByNoteId(note.id);
  const postFiles = groupByTarget(
    targetRepository.listAttachmentsForMany(
      "post",
      posts.map((post) => post.id),
    ),
  );

  const noteDto: PublicNoteDto = {
    title: note.title,
    format: note.format,
    content: parseJson(note.content, ""),
    tags: parseTags(note.tags),
    createdAt: note.createdAt,
    updatedAt: note.updatedAt,
    attachments: targetRepository.listAttachments("note", note.id).map(toPublicAttachmentDto),
  };

  return {
    kind: "note",
    note: noteDto,
    posts: posts.map((post) => toPublicPost(post, postFiles.get(post.id))),
  };
}

/** Whether `attachment` is part of what `share` exposes (the shared object, or a post of a shared note). */
function isInScope(share: Share, attachment: Attachment) {
  if (share.shareableType === "post") {
    return attachment.attachableType === "post" && attachment.attachableId === share.shareableId;
  }

  if (attachment.attachableType === "note") {
    return attachment.attachableId === share.shareableId;
  }

  return noteRepository.findPostById(attachment.attachableId)?.noteId === share.shareableId;
}

/** Read-only access by link. No session: knowing the token is the permission. */
export const publicRoutes = new Elysia({ prefix: "/public" })
  .use(authPlugin)
  .get(
    "/:token",
    async ({ params: { token }, headers, accessAuth, set }) => {
      const share = targetRepository.findShareByToken(token);
      const view = share ? buildPublicShare(share) : null;

      if (!share || !view) {
        set.status = 404;
        return fail("Link not found");
      }

      // Count the visit unless the owner is only checking their own link, and
      // unless this visitor was just counted (a refresh is not a new view).
      const viewer = await resolveSession(headers.authorization, accessAuth);

      if (viewer?.id !== share.userId && isNewView(`${token}:${visitorKey(headers)}`)) {
        targetRepository.recordView(share.shareableType, share.shareableId);
      }

      return view;
    },
    { params: t.Object({ token: t.String() }) },
  )
  .get(
    "/:token/files/:attachmentId",
    async ({ params: { token, attachmentId }, set }) => {
      const share = targetRepository.findShareByToken(token);
      const attachment = targetRepository.findAttachment(Number(attachmentId));

      if (!share || !attachment || !isInScope(share, attachment)) {
        set.status = 404;
        return fail("File not found");
      }

      const response = await attachmentResponse(attachment);

      if (!response) {
        set.status = 404;
        return fail("File not found");
      }

      return response;
    },
    { params: t.Object({ token: t.String(), attachmentId: t.String() }) },
  );
