import type {
  JsonObject,
  JsonValue,
  NoteDto,
  NotePostDto,
} from "../contracts/note";
import type { Note, NotePost } from "../db/schema";

function parseJsonValue(value: string, fallback: JsonValue): JsonValue {
  try {
    return JSON.parse(value) as JsonValue;
  } catch {
    return fallback;
  }
}

function parseJsonObject(value: string, fallback: JsonObject): JsonObject {
  const parsed = parseJsonValue(value, fallback);

  if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
    return parsed as JsonObject;
  }

  return fallback;
}

function parseTags(value: string): string[] {
  const parsed = parseJsonValue(value, []);
  return Array.isArray(parsed)
    ? parsed.filter((tag): tag is string => typeof tag === "string")
    : [];
}

export function toNoteDto(note: Note): NoteDto {
  return {
    id: note.id,
    userId: note.userId,
    categoryId: note.categoryId ?? null,
    workspaceId: note.workspaceId ?? null,
    title: note.title,
    content: parseJsonValue(note.content, {}),
    tags: parseTags(note.tags),
    props: parseJsonObject(note.props, {}),
    createdAt: note.createdAt,
    updatedAt: note.updatedAt,
  };
}

export function toNotePostDto(post: NotePost): NotePostDto {
  return {
    id: post.id,
    noteId: post.noteId,
    content: parseJsonValue(post.content, {}),
    tags: parseTags(post.tags),
    props: parseJsonObject(post.props, {}),
    createdAt: post.createdAt,
  };
}
