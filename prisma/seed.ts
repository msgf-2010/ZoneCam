import { PrismaClient } from "@prisma/client";
import { ensureGlobalPermissions } from "../src/server/tenancy/provision";

const prisma = new PrismaClient();

async function main() {
  await ensureGlobalPermissions(prisma);
}

main()
  .finally(() => prisma.$disconnect());
