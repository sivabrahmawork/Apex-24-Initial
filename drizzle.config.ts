import { defineConfig } from "drizzle-kit";
export default defineConfig({
  dialect: "postgresql",
  schema: ["./lib/schema.ts", "./lib/drafts-schema.ts"],
  out: "./drizzle",
});
