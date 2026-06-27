import { Elysia } from "elysia";
import { cors } from "@elysiajs/cors";
import { auth } from "./middleware/auth";
import { authRoutes } from "./routes/auth";
import { userRoutes } from "./routes/users";

const app = new Elysia()
  .use(cors())
  .use(auth)
  .use(authRoutes)
  .use(userRoutes)
  .get("/health", () => ({ status: "ok" }))
  .listen(4000);

console.log(`🔥 Elysia running at http://localhost:${app.server?.port}`);
