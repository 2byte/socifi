import { Elysia } from "elysia";
import { cors } from "@elysiajs/cors";
import { auth } from "./middleware/auth";
import { authRoutes } from "./routes/auth";
import { categoryRoutes } from "./routes/categories";
import { noteRoutes } from "./routes/notes";
import { postRoutes } from "./routes/posts";
import { productionRoutes } from "./routes/production";
import { userRoutes } from "./routes/users";
import { workspaceRoutes } from "./routes/workspaces";
import { config } from "./config";
import { NtpmServiceManager } from "./note-post-module/NtpmServiceManager";
import { ntpmAdminRoutes } from "./routes/ntpm-admin";

// Initialize NTPM modules before starting the server
await NtpmServiceManager.init();

const app = new Elysia()
  .use(
    cors({
      origin: config.frontendUrl,
      credentials: true,
      allowedHeaders: ["Content-Type", "Authorization"],
      methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    }),
  )
  .use(auth)
  .use(authRoutes)
  .use(categoryRoutes)
  .use(noteRoutes)
  .use(postRoutes)
  .use(userRoutes)
  .use(workspaceRoutes)
  .use(NtpmServiceManager.createPlugin())
  .use(ntpmAdminRoutes)
  .get("/health", () => ({ status: "ok" }))
  .use(productionRoutes)
  .listen(config.port);

console.log(`🔥 Elysia running at http://localhost:${app.server?.port}`);
