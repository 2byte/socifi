export type NoteDto = {
  id: number;
  userId: number;
  categoryId: number | null;
  workspaceId: number | null;
  title: string;
  content: string | null;
  tags: string | null;
  props: string | null;
  createdAt: string;
  updatedAt: string;
};

export type CreateNoteDto = {
  categoryId?: number | null;
  workspaceId?: number | null;
  title: string;
  content?: string;
  tags?: string;
  props?: string;
};

export type UpdateNoteDto = {
  categoryId?: number | null;
  workspaceId?: number | null;
  title?: string;
  content?: string;
  tags?: string;
  props?: string;
};

export type NoteListResponseDto = {
  notes: NoteDto[];
};

export type NoteResponseDto = {
  note: NoteDto;
};
