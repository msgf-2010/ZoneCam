import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { loadAuthContext } from "@/server/auth/context";

export default async function HomePage() {
  const ctx = await loadAuthContext();
  if (!ctx) redirect("/login");
  const ua = (await headers()).get("user-agent") ?? "";
  const field = ctx.role.key === "field_technician" || /Android|iPhone|iPad|iPod|Mobile|webOS/i.test(ua);
  redirect(field ? "/field" : "/dashboard");
}
