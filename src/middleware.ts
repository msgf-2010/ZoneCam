import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { securityHeaders, safeInternalPath } from "@/server/security";
import { originAllowed } from "@/server/http";

const PUBLIC_PREFIXES = [
  "/login",
  "/register",
  "/forgot-password",
  "/reset-password",
  "/verify-email",
  "/invite",
  "/share",
  "/api/v1/auth/login",
  "/api/v1/auth/register",
  "/api/v1/auth/forgot-password",
  "/api/v1/auth/reset-password",
  "/api/v1/auth/verify-email",
  "/api/v1/auth/invite",
  "/api/v1/health",
];

function withHeaders(response: NextResponse, pathname: string) {
  for (const [key, value] of Object.entries(securityHeaders(pathname))) {
    response.headers.set(key, value);
  }
  return response;
}

function withCors(response: NextResponse, request: NextRequest) {
  const origin = request.headers.get("origin");
  if (!origin || !request.nextUrl.pathname.startsWith("/api/") || !originAllowed(request)) return response;
  response.headers.set("Access-Control-Allow-Origin", origin);
  response.headers.set("Vary", "Origin");
  response.headers.set("Access-Control-Allow-Methods", "GET, POST, PATCH, PUT, DELETE, OPTIONS");
  response.headers.set("Access-Control-Allow-Headers", "Content-Type, Authorization");
  return response;
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (pathname.startsWith("/_next") || pathname.startsWith("/favicon")) {
    return NextResponse.next();
  }
  if (pathname.startsWith("/api/") && request.method === "OPTIONS") {
    const response = originAllowed(request) ? new NextResponse(null, { status: 204 }) : new NextResponse(null, { status: 403 });
    return withCors(withHeaders(response, pathname), request);
  }
  if (pathname.includes(".") && !pathname.startsWith("/api/")) {
    return NextResponse.next();
  }

  const isPublic =
    pathname === "/" ||
    PUBLIC_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));

  if (pathname === "/field" || pathname.startsWith("/field/")) {
    const url = request.nextUrl.clone();
    url.pathname = "/dashboard";
    url.search = "";
    return withHeaders(NextResponse.redirect(url), "/dashboard");
  }

  const session = request.cookies.get("zonecam_session")?.value;
  if (!isPublic && !pathname.startsWith("/api/") && !session) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.search = "";
    url.searchParams.set("next", safeInternalPath(`${pathname}${request.nextUrl.search}`, "/dashboard"));
    return withHeaders(NextResponse.redirect(url), "/login");
  }
  if (session && (pathname === "/login" || pathname === "/register" || pathname === "/")) {
    const url = request.nextUrl.clone();
    url.pathname = "/dashboard";
    url.search = "";
    return withHeaders(NextResponse.redirect(url), url.pathname);
  }
  return withCors(withHeaders(NextResponse.next(), pathname), request);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image).*)"],
};
