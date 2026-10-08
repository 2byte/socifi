import { Elysia } from "elysia";
import { extname, join, normalize, resolve } from "node:path";
import { config } from "../config";

const SPA_INDEX_PATH = join(config.frontendDistDir, "index.html");
const API_PREFIXES = ["/auth", "/users", "/health", "/ntpm", "/post"];

function isApiPath(path: string) {
  const normalized = path.startsWith("/") ? path : `/${path}`;
  return API_PREFIXES.some((prefix) => normalized === prefix || normalized.startsWith(`${prefix}/`));
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

// Elysia drops the Content-Type Bun derives for a bare `new Response(file)`,
// and browsers refuse module scripts that arrive without one — the app would
// load as a blank page — so the type is set explicitly.
function fileResponse(file: ReturnType<typeof Bun.file>) {
  return new Response(file, { headers: { "Content-Type": file.type } });
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
    return fileResponse(staticFile);
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

  return fileResponse(indexFile);
}

export const productionRoutes = new Elysia()
  .get("/", ({ set }) => serveSpa("/", set))
  .get("/*", ({ path, set }) => serveSpa(path, set));
