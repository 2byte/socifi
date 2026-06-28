import { authSessionRepository } from "../repositories/auth-session.repository";

const REFRESH_TOKEN_BYTES = 32;
const REFRESH_TOKEN_TTL_MS = 1000 * 60 * 60 * 24 * 7;

type SessionMeta = {
  userAgent?: string | null;
  ipAddress?: string | null;
};

export function getSessionMeta(headers: Record<string, string | undefined>): SessionMeta {
  const forwardedFor = headers["x-forwarded-for"];
  const ipAddress = forwardedFor?.split(",")[0]?.trim() || headers["x-real-ip"] || null;

  return {
    userAgent: headers["user-agent"] || null,
    ipAddress,
  };
}

export function getExpirationDate() {
  return new Date(Date.now() + REFRESH_TOKEN_TTL_MS).toISOString();
}

export function isExpired(expiresAt: string) {
  return new Date(expiresAt).getTime() <= Date.now();
}

export async function generateRefreshToken() {
  const bytes = crypto.getRandomValues(new Uint8Array(REFRESH_TOKEN_BYTES));
  return Buffer.from(bytes).toString("base64url");
}

export async function hashRefreshToken(token: string) {
  const encoded = new TextEncoder().encode(token);
  const digest = await crypto.subtle.digest("SHA-256", encoded);
  return Buffer.from(digest).toString("hex");
}

export async function createRefreshSession(userId: number, meta: SessionMeta) {
  const rawToken = await generateRefreshToken();
  const tokenHash = await hashRefreshToken(rawToken);
  const now = new Date().toISOString();
  const expiresAt = getExpirationDate();

  const session = authSessionRepository.create({
      id: crypto.randomUUID(),
      userId,
      tokenHash,
      userAgent: meta.userAgent || null,
      ipAddress: meta.ipAddress || null,
      createdAt: now,
      updatedAt: now,
      lastUsedAt: now,
      expiresAt,
    });

  return { session, rawToken };
}

export async function findRefreshSession(rawToken: string) {
  const tokenHash = await hashRefreshToken(rawToken);
  return authSessionRepository.findActiveByTokenHash(tokenHash);
}

export async function rotateRefreshSession(sessionId: string, meta: SessionMeta) {
  const rawToken = await generateRefreshToken();
  const tokenHash = await hashRefreshToken(rawToken);
  const now = new Date().toISOString();
  const expiresAt = getExpirationDate();

  const session = authSessionRepository.rotateById(sessionId, {
      tokenHash,
      userAgent: meta.userAgent || null,
      ipAddress: meta.ipAddress || null,
      lastUsedAt: now,
      updatedAt: now,
      expiresAt,
    });

  return { session, rawToken };
}

export function revokeRefreshSession(sessionId: string) {
  return authSessionRepository.revokeById(sessionId);
}

export function revokeAllUserSessions(userId: number) {
  return authSessionRepository.revokeAllByUserId(userId);
}

export function listUserSessions(userId: number) {
  return authSessionRepository.listActiveByUserId(userId);
}

export function findUserSessionById(userId: number, sessionId: string) {
  return authSessionRepository.findActiveByUserIdAndSessionId(userId, sessionId);
}
