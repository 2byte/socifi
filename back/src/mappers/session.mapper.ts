import type { AuthSession } from "../db/schema";
import type { SessionDto } from "../contracts/session";

export function toSessionDto(session: AuthSession, current: boolean): SessionDto {
  return {
    id: session.id,
    userAgent: session.userAgent ?? null,
    ipAddress: session.ipAddress ?? null,
    createdAt: session.createdAt,
    updatedAt: session.updatedAt,
    lastUsedAt: session.lastUsedAt,
    expiresAt: session.expiresAt,
    revokedAt: session.revokedAt ?? null,
    current,
  };
}
