import type { Category } from "../db/schema";
import type { CategoryDto } from "../contracts/category";

export function toCategoryDto(category: Category): CategoryDto {
  return {
    id: category.id,
    userId: category.userId,
    workspaceId: category.workspaceId ?? null,
    name: category.name,
    props: category.props ?? null,
    createdAt: category.createdAt,
    updatedAt: category.updatedAt,
  };
}
