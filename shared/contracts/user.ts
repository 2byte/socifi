export type UserDto = {
  id: number;
  login: string;
  email: string | null;
  name: string | null;
  createdAt: string;
  updatedAt: string;
};

export type UpdateProfileDto = {
  email?: string;
  name?: string;
};
