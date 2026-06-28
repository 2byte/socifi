import type { ApiErrorDto, ApiSuccess } from "../../../shared/contracts";

export function ok<T>(payload: T): ApiSuccess<T> {
  return payload;
}

export function fail(error: string): ApiErrorDto {
  return { error };
}
