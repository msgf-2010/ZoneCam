import { ZodError } from "zod";

export class AppError extends Error {
  constructor(
    public status: number,
    message: string,
    public code?: string,
  ) {
    super(message);
  }
}

export function json(data: unknown, status = 200, init?: { headers?: HeadersInit }) {
  return Response.json(data, { status, headers: init?.headers });
}

export function withCors(response: Response, request: Request) {
  const origin = request.headers.get("origin");
  if (!origin || !originAllowed(request)) return response;
  const headers = new Headers(response.headers);
  headers.set("Access-Control-Allow-Origin", origin);
  headers.set("Vary", "Origin");
  headers.set("Access-Control-Allow-Methods", "GET, POST, PATCH, PUT, DELETE, OPTIONS");
  headers.set("Access-Control-Allow-Headers", "Content-Type, Authorization");
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

export function errorResponse(error: unknown) {
  if (error instanceof AppError) {
    const headers: HeadersInit | undefined =
      error.status === 429 ? { "Retry-After": "60", "Cache-Control": "no-store" } : undefined;
    return json({ error: error.message, code: error.code }, error.status, { headers });
  }
  if (error instanceof ZodError) {
    return json({ error: error.issues[0]?.message ?? "Invalid request." }, 400);
  }
  console.error(error);
  return json({ error: "Unexpected server error." }, 500);
}

export async function readJson<T>(request: Request): Promise<T> {
  const length = Number(request.headers.get("content-length") ?? 0);
  if (Number.isFinite(length) && length > 256 * 1024) {
    throw new AppError(413, "Request is too large.");
  }
  try {
    return (await request.json()) as T;
  } catch {
    throw new AppError(400, "Invalid JSON body.");
  }
}

export function clientIp(request: Request) {
  const env = process.env.TRUST_CLOUDFLARE;
  const trustCloudflare = env === "true" || env === "1";
  if (trustCloudflare) {
    const cf = request.headers.get("cf-connecting-ip")?.trim();
    if (cf) return cf;
  }
  return request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? request.headers.get("x-real-ip");
}

function extraAllowedOrigins() {
  return (process.env.ALLOWED_ORIGINS ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
}

function loopbackHosts() {
  return new Set(["localhost", "127.0.0.1", "[::1]", "::1", "10.0.2.2", "10.0.3.2"]);
}

function isPrivateHostname(hostname: string) {
  if (loopbackHosts().has(hostname)) return true;
  const ipv4 = hostname.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (!ipv4) return false;
  const [a, b] = [Number(ipv4[1]), Number(ipv4[2])];
  if (a === 10) return true;
  if (a === 127) return true;
  if (a === 192 && b === 168) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 100 && b >= 64 && b <= 127) return true;
  return false;
}

function forwardedPublicOrigin(request: Request) {
  const host = (request.headers.get("x-forwarded-host") ?? request.headers.get("host") ?? "")
    .split(",")[0]
    .trim();
  if (!host) return null;
  const proto = (request.headers.get("x-forwarded-proto") ?? "https").split(",")[0].trim();
  return `${proto}://${host}`;
}

export function originAllowed(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin) return true;
  const appUrl = process.env.APP_URL ?? "http://localhost:3001";
  try {
    const incoming = new URL(origin);
    const app = new URL(appUrl);
    if (incoming.origin === app.origin) return true;
    const forwarded = forwardedPublicOrigin(request);
    if (forwarded && incoming.origin === forwarded) return true;
    try {
      if (incoming.origin === new URL(request.url).origin) return true;
    } catch {
      /* ignore invalid request URL */
    }
    if (extraAllowedOrigins().includes(incoming.origin)) return true;
    if (
      process.env.NODE_ENV !== "production" &&
      loopbackHosts().has(incoming.hostname) &&
      incoming.protocol === app.protocol
    ) {
      return true;
    }
    const samePort = incoming.port === app.port || (!incoming.port && !app.port);
    const sameProtocol = incoming.protocol === app.protocol;
    if (!samePort || !sameProtocol) return false;
    if (loopbackHosts().has(incoming.hostname)) return true;
    if (process.env.NODE_ENV !== "production" && isPrivateHostname(incoming.hostname)) return true;
    return false;
  } catch {
    return false;
  }
}

const attempts = new Map<string, { count: number; resetAt: number }>();

function pruneRateLimits(now: number) {
  if (attempts.size < 2000) return;
  for (const [key, value] of attempts) {
    if (value.resetAt < now) attempts.delete(key);
  }
}

export function rateLimit(key: string, limit: number, windowMs: number) {
  const now = Date.now();
  pruneRateLimits(now);
  const current = attempts.get(key);
  if (!current || current.resetAt < now) {
    attempts.set(key, { count: 1, resetAt: now + windowMs });
    return;
  }
  current.count += 1;
  if (current.count > limit) {
    throw new AppError(429, "Too many attempts. Try again shortly.");
  }
}
