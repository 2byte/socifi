export type WorkspaceDto = {
  id: number;
  userId: number;
  name: string;
  props: string | null;
  createdAt: string;
  updatedAt: string;
};

export type CreateWorkspaceDto = {
  name: string;
  props?: string;
};

export type UpdateWorkspaceDto = {
  name?: string;
  props?: string;
};

export type WorkspaceListResponseDto = {
  workspaces: WorkspaceDto[];
};

export type WorkspaceResponseDto = {
  workspace: WorkspaceDto;
};
