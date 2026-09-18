import { existsSync, readFileSync, writeFileSync } from "fs";
import path from "path";

const schemaPath = path.join(process.cwd(), "prisma", "schema.prisma");
const url = process.env.DATABASE_URL ?? "";
const provider = url.startsWith("postgres") ? "postgresql" : "sqlite";

if (!existsSync(schemaPath)) {
  throw new Error("prisma/schema.prisma is missing.");
}

const current = readFileSync(schemaPath, "utf8");
const next = current.replace(/provider = "(sqlite|postgresql)"/, `provider = "${provider}"`);
if (next === current) {
  console.info(`[prisma-for-env] datasource already ${provider}`);
} else {
  writeFileSync(schemaPath, next);
  console.info(`[prisma-for-env] datasource provider set to ${provider}`);
}
