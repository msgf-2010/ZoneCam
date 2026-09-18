import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { securityHeaders, safeInternalPath } from "@/server/security";

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

const OFFICE_PREFIXES = [
  "/dashboard",
  "/projects",
  "/customers",
  "/calendar",
  "/tasks",
  "/reports",
  "/payments",
  "/team",
  "/messages",
  "/integrations",
  "/settings",
  "/search",
];

function isFieldClient(request: NextRequest) {
  const ua = request.headers.get("user-agent") ?? "";
  return /Android|iPhone|iPad|iPod|Mobile|webOS|IEMobile/i.test(ua);
}

function withHeaders(response: NextResponse, pathname: string) {
  for (const [key, value] of Object.entries(securityHeaders(pathname))) {
    response.headers.set(key, value);
  }
  return response;
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (pathname.startsWith("/_next") || pathname.startsWith("/favicon")) {
    return NextResponse.next();
  }
  if (pathname.includes(".") && !pathname.startsWith("/api/")) {
    return NextResponse.next();
  }

  const isPublic =
    pathname === "/" ||
    PUBLIC_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));

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
    url.pathname = isFieldClient(request) ? "/field" : "/dashboard";
    url.search = "";
    return withHeaders(NextResponse.redirect(url), url.pathname);
  }
  if (session && isFieldClient(request) && OFFICE_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`))) {
    const url = request.nextUrl.clone();
    url.pathname = "/field";
    url.search = "";
    return withHeaders(NextResponse.redirect(url), "/field");
  }
  return withHeaders(NextResponse.next(), pathname);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image).*)"],
};
