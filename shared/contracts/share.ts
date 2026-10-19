import type { ContentFormat, JsonValue } from "./note";

/** Kinds of object a share or an attachment can point at (polymorphic target). */
export type TargetType = "note" | "post";

export type ShareDto = {
  targetType: TargetType;
  targetId: number;
  /** Secret part of the public link (`/s/<token>`). */
  token: string;
  createdAt: string;
};

export type ShareResponseDto = {
  /** `null` when the object is not shared. */
  share: ShareDto | null;
};

export type AttachmentDto = {
  id: number;
  targetType: TargetType;
  targetId: number;
  name: string;
  mimeType: string;
  size: number;
  createdAt: string;
};

export type AttachmentListResponseDto = {
  attachments: AttachmentDto[];
};

/** What a visitor with a link sees. Never carries `props`, owner ids or module tokens. */
export type PublicAttachmentDto = Omit<AttachmentDto, "targetType" | "targetId">;

/** The module under a shared post, as far as a guest may use it. */
export type PublicPostModuleDto =
  | { hidden: true }
  | { hidden?: false; slug: string; guests: { read: boolean; write: boolean } };

export type PublicPostDto = {
  id: number;
  format: ContentFormat;
  content: JsonValue;
  /**
   * The attached module: `null` for a plain post, `{ hidden: true }` when the
   * module does not support guests (the guest only learns that there is one),
   * otherwise what the page needs to run it with the share token.
   */
  module: PublicPostModuleDto | null;
  tags: string[];
  createdAt: string;
  attachments: PublicAttachmentDto[];
};

export type PublicNoteDto = {
  title: string;
  format: ContentFormat;
  content: JsonValue;
  tags: string[];
  createdAt: string;
  updatedAt: string;
  attachments: PublicAttachmentDto[];
};

export type PublicShareDto = {
  kind: TargetType;
  /** Set for a shared note; `null` when a single post is shared. */
  note: PublicNoteDto | null;
  posts: PublicPostDto[];
};
