import { fileURLToPath } from "node:url";

function parseNumber(value: string | undefined, fallback: number) {
  if (!value) {
    return fallback;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function parseBoolean(value: string | undefined, fallback: boolean) {
  if (!value) {
    return fallback;
  }

  return value === "true";
}

export const config = {
  port: parseNumber(process.env.PORT, 4000),
  frontendUrl: process.env.FRONTEND_URL || "http://localhost:9001",
  frontendDistDir:
    process.env.FRONTEND_DIST_DIR ||
    fileURLToPath(new URL("../../front/dist/spa", import.meta.url)),
  databaseUrl: process.env.DATABASE_URL || "./database/socifi.sqlite",
  jwtSecret: process.env.JWT_SECRET || "change-me-in-production",
  jwtRefreshSecret: process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET || "change-me-in-production",
  cookieSecure: parseBoolean(process.env.COOKIE_SECURE, false),
};
