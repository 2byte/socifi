import { jwt } from "@elysiajs/jwt";

export const auth = jwt({
  name: "auth",
  secret: process.env.JWT_SECRET || "change-me-in-production",
});
