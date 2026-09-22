import { handleApi } from "@/server/api";
import { AppError, rateLimit } from "@/server/http";
import { subscribeCompany } from "@/server/realtime-bus";
import { loadScopedProject } from "@/server/tenancy/access";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  return handleApi(
    request,
    async ({ ctx }) => {
      if (!ctx) throw new AppError(401, "Not authenticated.");
      rateLimit(`sse:${ctx.user.id}`, 8, 60_000);
      const encoder = new TextEncoder();
      const stream = new ReadableStream({
        start(controller) {
          const send = (data: unknown) => {
            controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
          };
          send({ type: "hello", companyId: ctx.company.id });
          const unsubscribe = subscribeCompany(ctx.company.id, async (event) => {
            if (event.projectId) {
              try {
                await loadScopedProject(ctx, event.projectId);
              } catch {
                return;
              }
            }
            send(event);
          });
          const ping = setInterval(() => send({ type: "ping" }), 20000);
          request.signal.addEventListener("abort", () => {
            clearInterval(ping);
            unsubscribe();
            controller.close();
          });
        },
      });
      return new Response(stream, {
        headers: {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache, no-transform",
          "X-Accel-Buffering": "no",
        },
      });
    },
    { auth: true },
  );
}
