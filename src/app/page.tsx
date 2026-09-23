import { redirect } from "next/navigation";
import { loadAuthContext } from "@/server/auth/context";

export default async function HomePage() {
  const ctx = await loadAuthContext();
  if (!ctx) redirect("/login");
  redirect("/dashboard");
}
