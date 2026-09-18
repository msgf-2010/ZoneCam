import { safeInternalPath, safeDownloadFilename } from "@/lib/safe-path";

export { safeInternalPath, safeDownloadFilename };

export function securityHeaders(pathname = "/") {
  const scriptSrc =
    process.env.NODE_ENV === "production"
      ? "script-src 'self' 'unsafe-inline'"
      : "script-src 'self' 'unsafe-inline' 'unsafe-eval'";
  const headers: Record<string, string> = {
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    "Referrer-Policy": "strict-origin-when-cross-origin",
    "Permissions-Policy": "camera=(self), microphone=(), geolocation=(self), payment=()",
    "X-DNS-Prefetch-Control": "off",
    "Cross-Origin-Opener-Policy": "same-origin",
    "Content-Security-Policy": [
      "default-src 'self'",
      scriptSrc,
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' blob: data:",
      "font-src 'self' data:",
      "connect-src 'self'",
      "media-src 'self' blob:",
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      "frame-ancestors 'none'",
    ].join("; "),
  };
  if (process.env.NODE_ENV === "production") {
    headers["Strict-Transport-Security"] = "max-age=63072000; includeSubDomains";
  }
  if (pathname.startsWith("/share/") || pathname.startsWith("/login") || pathname.startsWith("/register")) {
    headers["Cache-Control"] = headers["Cache-Control"] ?? "no-store";
  }
  return headers;
}

export function applySecurityHeaders(response: Response, pathname?: string) {
  const next = new Headers(response.headers);
  const extras = securityHeaders(pathname);
  for (const [key, value] of Object.entries(extras)) {
    if (!next.has(key)) next.set(key, value);
  }
  next.delete("X-Powered-By");
  const contentType = next.get("content-type") ?? "";
  if (contentType.includes("application/json") && !next.has("Cache-Control")) {
    next.set("Cache-Control", "no-store");
  }
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: next,
  });
}
