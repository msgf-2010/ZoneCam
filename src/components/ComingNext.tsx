import { EmptyState } from "@/components/ui/EmptyState";

export function ComingNext({ title, body }: { title: string; body: string }) {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">{title}</h1>
      <EmptyState title={`${title} is next`} body={body} />
    </div>
  );
}
