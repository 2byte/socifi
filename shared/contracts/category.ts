export type CategoryDto = {
  id: number;
  userId: number;
  workspaceId: number | null;
  name: string;
  props: string | null;
  createdAt: string;
  updatedAt: string;
};

export type CreateCategoryDto = {
  name: string;
  workspaceId?: number | null;
  props?: string;
};

export type UpdateCategoryDto = {
  name?: string;
  workspaceId?: number | null;
  props?: string;
};

export type CategoryListResponseDto = {
  categories: CategoryDto[];
};

export type CategoryResponseDto = {
  category: CategoryDto;
};
