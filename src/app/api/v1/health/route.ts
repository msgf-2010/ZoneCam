import { handleApi } from "@/server/api";
import { json, rateLimit, clientIp } from "@/server/http";
import { prisma } from "@/server/db";

export async function GET(request: Request) {
  return handleApi(request, async ({ request: req }) => {
    rateLimit(`health:${clientIp(req) ?? "unknown"}`, 60, 60_000);
    let db: "up" | "down" = "up";
    try {
      await prisma.$queryRaw`SELECT 1`;
    } catch {
      db = "down";
    }
    return json(
      {
        ok: db === "up",
        db,
        storage: process.env.STORAGE_DRIVER || "local",
        time: new Date().toISOString(),
      },
      db === "up" ? 200 : 503,
    );
  });
}
