import { clientIp, errorResponse, originAllowed, AppError } from "@/server/http";
import { loadAuthContext, type AuthContext } from "@/server/auth/context";
import { applySecurityHeaders } from "@/server/security";

type Handler = (input: {
  request: Request;
  ctx: AuthContext | null;
  ip: string | undefined;
}) => Promise<Response>;

export async function handleApi(
  request: Request,
  handler: Handler,
  options: { auth?: boolean } = {},
) {
  try {
    if (request.method !== "GET" && request.method !== "HEAD" && !originAllowed(request)) {
      throw new AppError(403, "Invalid request origin.");
    }
    const ctx = await loadAuthContext(request);
    if (options.auth && !ctx) throw new AppError(401, "Not authenticated.");
    const response = await handler({
      request,
      ctx,
      ip: clientIp(request) ?? undefined,
    });
    return applySecurityHeaders(response, new URL(request.url).pathname);
  } catch (error) {
    return applySecurityHeaders(errorResponse(error), new URL(request.url).pathname);
  }
}
