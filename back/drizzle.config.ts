import { defineConfig, type Config } from "drizzle-kit";

export default defineConfig({
  dialect: "sqlite",
  schema: "./src/db/schema.ts",
  out: "./database/migrations",
  dbCredentials: {
    url: process.env.DATABASE_URL || "./database/socifi.sqlite",
  },
} satisfies Config);
