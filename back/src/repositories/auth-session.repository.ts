import { and, desc, eq, gt, isNull } from "drizzle-orm";
import { db } from "../db";
import { authSessions, type NewAuthSession } from "../db/schema";

type CreateAuthSessionInput = Pick<
  NewAuthSession,
  | "id"
  | "userId"
  | "tokenHash"
  | "userAgent"
  | "ipAddress"
  | "createdAt"
  | "updatedAt"
  | "lastUsedAt"
  | "expiresAt"
>;

type RotateAuthSessionInput = {
  tokenHash: string;
  userAgent: string | null;
  ipAddress: string | null;
  lastUsedAt: string;
  updatedAt: string;
  expiresAt: string;
};

export const authSessionRepository = {
  create(data: CreateAuthSessionInput) {
    return db.insert(authSessions).values(data).returning().get();
  },

  findActiveByTokenHash(tokenHash: string) {
    return db
      .select()
      .from(authSessions)
      .where(
        and(
          eq(authSessions.tokenHash, tokenHash),
          isNull(authSessions.revokedAt),
          gt(authSessions.expiresAt, new Date().toISOString()),
        ),
      )
      .get();
  },

  rotateById(sessionId: string, data: RotateAuthSessionInput) {
    return db
      .update(authSessions)
      .set(data)
      .where(eq(authSessions.id, sessionId))
      .returning()
      .get();
  },

  revokeById(sessionId: string) {
    const now = new Date().toISOString();

    return db
      .update(authSessions)
      .set({
        revokedAt: now,
        updatedAt: now,
      })
      .where(eq(authSessions.id, sessionId))
      .run();
  },

  revokeAllByUserId(userId: number) {
    const now = new Date().toISOString();

    return db
      .update(authSessions)
      .set({
        revokedAt: now,
        updatedAt: now,
      })
      .where(and(eq(authSessions.userId, userId), isNull(authSessions.revokedAt)))
      .run();
  },

  listActiveByUserId(userId: number) {
    return db
      .select()
      .from(authSessions)
      .where(
        and(
          eq(authSessions.userId, userId),
          isNull(authSessions.revokedAt),
          gt(authSessions.expiresAt, new Date().toISOString()),
        ),
      )
      .orderBy(desc(authSessions.lastUsedAt))
      .all();
  },

  findActiveByUserIdAndSessionId(userId: number, sessionId: string) {
    return db
      .select()
      .from(authSessions)
      .where(
        and(
          eq(authSessions.id, sessionId),
          eq(authSessions.userId, userId),
          isNull(authSessions.revokedAt),
        ),
      )
      .get();
  },
};
