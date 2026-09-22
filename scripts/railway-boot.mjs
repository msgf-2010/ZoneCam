import { spawnSync } from "child_process";
import { sanitizeDatabaseUrl } from "./sanitize-database-url.mjs";

process.env.DATABASE_URL = sanitizeDatabaseUrl(process.env.DATABASE_URL ?? "");

function run(command) {
  const result = spawnSync(command, { stdio: "inherit", shell: true, env: process.env });
  if (result.status !== 0) process.exit(result.status ?? 1);
}

run("node scripts/prisma-for-env.mjs");
run("npx prisma generate");
run("npx prisma db push");
run("node scripts/start.mjs");
