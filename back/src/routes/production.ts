import { Elysia } from "elysia";
import { extname, join, normalize, resolve } from "node:path";
import { config } from "../config";

const SPA_INDEX_PATH = join(config.frontendDistDir, "index.html");
const API_PREFIXES = ["/auth", "/users", "/health"];

function isApiPath(path: string) {
  return API_PREFIXES.some((prefix) => path === prefix || path.startsWith(`${prefix}/`));
}

function resolveStaticPath(path: string) {
  const sanitizedPath = path === "/" ? "index.html" : path.replace(/^\/+/, "");
  const normalizedPath = normalize(sanitizedPath);
  const resolvedPath = resolve(config.frontendDistDir, normalizedPath);

  if (!resolvedPath.startsWith(resolve(config.frontendDistDir))) {
    return null;
  }

  return resolvedPath;
}

async function serveSpa(path: string, set: { status?: number | string }) {
  if (isApiPath(path)) {
    set.status = 404;
    return { error: "Not found" };
  }

  const staticFilePath = resolveStaticPath(path);

  if (!staticFilePath) {
    set.status = 403;
    return { error: "Forbidden" };
  }

  const staticFile = Bun.file(staticFilePath);

  if (await staticFile.exists()) {
    return new Response(staticFile);
  }

  if (extname(path)) {
    set.status = 404;
    return { error: "File not found" };
  }

  const indexFile = Bun.file(SPA_INDEX_PATH);

  if (!(await indexFile.exists())) {
    set.status = 503;
    return {
      error: `Frontend build not found. Expected index.html at ${SPA_INDEX_PATH}`,
    };
  }

  return new Response(indexFile);
}

export const productionRoutes = new Elysia()
  .get("/", ({ set }) => serveSpa("/", set))
  .get("/*", ({ path, set }) => serveSpa(path, set));
