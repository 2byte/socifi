import type { User } from "../db/schema";
import type { UserDto } from "../contracts/user";

export function toUserDto(user: User): UserDto {
  return {
    id: user.id,
    login: user.login,
    email: user.email ?? null,
    name: user.name ?? null,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}
