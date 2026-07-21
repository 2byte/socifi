import { Elysia } from "elysia";
import { cors } from "@elysiajs/cors";
import { auth } from "./middleware/auth";
import { authRoutes } from "./routes/auth";
import { categoryRoutes } from "./routes/categories";
import { noteRoutes } from "./routes/notes";
import { productionRoutes } from "./routes/production";
import { userRoutes } from "./routes/users";
import { workspaceRoutes } from "./routes/workspaces";
import { config } from "./config";

const app = new Elysia()
  .use(
    cors({
      origin: config.frontendUrl,
      credentials: true,
      allowedHeaders: ["Content-Type", "Authorization"],
      methods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
    }),
  )
  .use(auth)
  .use(authRoutes)
  .use(categoryRoutes)
  .use(noteRoutes)
  .use(userRoutes)
  .use(workspaceRoutes)
  .use(productionRoutes)
  .get("/health", () => ({ status: "ok" }))
  .listen(config.port);

console.log(`🔥 Elysia running at http://localhost:${app.server?.port}`);
