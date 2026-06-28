import type { Workspace } from "../db/schema";
import type { WorkspaceDto } from "../contracts/workspace";

export function toWorkspaceDto(workspace: Workspace): WorkspaceDto {
  return {
    id: workspace.id,
    userId: workspace.userId,
    name: workspace.name,
    props: workspace.props ?? null,
    createdAt: workspace.createdAt,
    updatedAt: workspace.updatedAt,
  };
}
