import { spawn } from "child_process";
import { sanitizeDatabaseUrl } from "./sanitize-database-url.mjs";

process.env.DATABASE_URL = sanitizeDatabaseUrl(process.env.DATABASE_URL ?? "");

const port = process.env.PORT || "3001";
const child = spawn("npx", ["next", "start", "--hostname", "0.0.0.0", "--port", String(port)], {
  stdio: "inherit",
  shell: true,
  env: process.env,
});

child.on("exit", (code) => {
  process.exit(code ?? 1);
});
