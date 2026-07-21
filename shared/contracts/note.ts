export type JsonPrimitive = string | number | boolean | null;

export type JsonValue =
  | JsonPrimitive
  | { [key: string]: JsonValue }
  | JsonValue[];

export type JsonObject = {
  [key: string]: JsonValue;
};

export type NoteDto = {
  id: number;
  userId: number;
  categoryId: number | null;
  workspaceId: number | null;
  title: string;
  content: JsonValue;
  tags: string[];
  props: JsonObject;
  createdAt: string;
  updatedAt: string;
};

export type CreateNoteDto = {
  categoryId?: number | null;
  workspaceId?: number | null;
  title: string;
  content?: JsonValue;
  tags?: string[];
  props?: JsonObject;
};

export type UpdateNoteDto = {
  categoryId?: number | null;
  workspaceId?: number | null;
  title?: string;
  content?: JsonValue;
  tags?: string[];
  props?: JsonObject;
};

export type NotePostDto = {
  id: number;
  noteId: number;
  content: JsonValue;
  tags: string[];
  props: JsonObject;
  createdAt: string;
};

export type CreateNotePostDto = {
  content?: JsonValue;
  tags?: string[];
  props?: JsonObject;
};

export type UpdateNotePostDto = {
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
