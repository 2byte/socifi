import type { SessionDto } from "./session";
import type { UserDto } from "./user";

export type RegisterDto = {
  login: string;
  email?: string;
  password: string;
  name?: string;
};

export type LoginDto = {
  login: string;
  password: string;
};

export type AuthResponseDto = {
  accessToken: string;
  user: UserDto;
};

export type MeResponseDto = {
  user: UserDto;
};

export type SessionsResponseDto = {
  sessions: SessionDto[];
};
