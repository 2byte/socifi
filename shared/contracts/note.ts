export type JsonPrimitive = string | number | boolean | null;

export type JsonValue =
  | JsonPrimitive
  | { [key: string]: JsonValue }
  | JsonValue[];

export type JsonObject = {
  [key: string]: JsonValue;
};

/** How the text is written: rendered as Markdown, or shown exactly as typed. */
export type ContentFormat = "markdown" | "text";

export type NoteDto = {
  id: number;
  userId: number;
  categoryId: number | null;
  workspaceId: number | null;
  title: string;
  format: ContentFormat;
  content: JsonValue;
  tags: string[];
  props: JsonObject;
  createdAt: string;
  updatedAt: string;
  /** Opens of the note's public link by others; only set when a single note is fetched. */
  viewCount?: number;
};

export type CreateNoteDto = {
  categoryId?: number | null;
  workspaceId?: number | null;
  title: string;
  /** Defaults to `markdown`. */
  format?: ContentFormat;
  content?: JsonValue;
  tags?: string[];
  props?: JsonObject;
};

export type UpdateNoteDto = {
  categoryId?: number | null;
  workspaceId?: number | null;
  title?: string;
  format?: ContentFormat;
  content?: JsonValue;
  tags?: string[];
  props?: JsonObject;
};

export type NotePostDto = {
  id: number;
  noteId: number;
  format: ContentFormat;
  /** Slug of the module attached under the text, or `null` for a plain post. */
  moduleSlug: string | null;
  content: JsonValue;
  tags: string[];
  props: JsonObject;
  createdAt: string;
  /** Opens of the post's public link by others. */
  viewCount?: number;
};

export type CreateNotePostDto = {
  /** Defaults to `markdown`. */
  format?: ContentFormat;
  /** A loaded module to attach; the post may have text, a module, or both. */
  moduleSlug?: string | null;
  content?: JsonValue;
  tags?: string[];
  props?: JsonObject;
};

export type UpdateNotePostDto = {
  format?: ContentFormat;
  content?: JsonValue;
  tags?: string[];
  props?: JsonObject;
};

export type ListNotesQueryDto = {
  limit?: number;
  offset?: number;
  categoryId?: number | null;
};

export type NoteListPaginationDto = {
  limit: number;
  offset: number;
  nextOffset: number | null;
  hasMore: boolean;
};

export type NoteListResponseDto = {
  notes: NoteDto[];
  pagination: NoteListPaginationDto;
};

export type NoteResponseDto = {
  note: NoteDto;
};

export type NotePostListResponseDto = {
  posts: NotePostDto[];
};

export type NotePostResponseDto = {
  post: NotePostDto;
};
