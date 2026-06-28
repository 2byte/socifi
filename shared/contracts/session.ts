export type SessionDto = {
  id: string;
  userAgent: string | null;
  ipAddress: string | null;
  createdAt: string;
  updatedAt: string;
  lastUsedAt: string;
  expiresAt: string;
  revokedAt: string | null;
  current: boolean;
};
