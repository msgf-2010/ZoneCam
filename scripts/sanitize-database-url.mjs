/** Neon’s default URL includes channel_binding=require, which Prisma rejects (P1012). */
export function sanitizeDatabaseUrl(url) {
  if (!url) return url;
  let next = url.trim().replace(/^["']|["']$/g, "");
  next = next.replace(/[?&]channel_binding=[^&]*/gi, "");
  if (next.includes("neon.tech") && !next.includes("-pooler.")) {
    next = next.replace(/(@ep-[a-z0-9-]+)(\.)/i, "$1-pooler$2");
  }
  if (next.includes("-pooler.") && !/[?&]pgbouncer=/i.test(next)) {
    next += next.includes("?") ? "&pgbouncer=true" : "?pgbouncer=true";
  }
  if (next.includes("neon.tech") && !/[?&]connection_limit=/i.test(next)) {
    next += next.includes("?") ? "&connection_limit=10" : "?connection_limit=10";
  }
  next = next.replace(/\?&/g, "?").replace(/[?&]$/g, "");
  return next;
}

const current = process.env.DATABASE_URL ?? "";
const cleaned = sanitizeDatabaseUrl(current);
if (cleaned !== current) {
  process.env.DATABASE_URL = cleaned;
  console.info("[sanitize-database-url] stripped channel_binding from DATABASE_URL");
}
