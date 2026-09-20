import Link from "next/link";
import { cn } from "@/lib/cn";
import { formatAddress } from "@/lib/format";
import { signedMediaPath } from "@/server/adapters/storage";

export function ProjectStatusChip({ name, color }: { name: string; color: string }) {
  return (
    <span
      className="inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium"
      style={{ background: `${color}22`, color }}
    >
      {name}
    </span>
  );
}

export function ProjectRow({
  project,
}: {
  project: {
    id: string;
    name: string;
    number: string;
    city?: string | null;
    addressLine1?: string | null;
    region?: string | null;
    postalCode?: string | null;
    startDate?: Date | string | null;
    projectStatus: { name: string; color: string };
    customer?: { name: string } | null;
    media?: Array<{ id: string; originalFilename: string; type: string }>;
  };
}) {
  const when = project.startDate ? new Date(project.startDate).toLocaleDateString() : "No date";
  const address = formatAddress(project);
  const thumbs = (project.media ?? []).filter((item) => item.type === "photo").slice(0, 4);
  return (
    <Link
      href={`/projects/${project.id}`}
      className="flex flex-col gap-2 border-b border-[var(--line)] py-3 last:border-0 hover:bg-[#fafafa] sm:flex-row sm:items-center sm:justify-between"
    >
      <div className="flex min-w-0 items-center gap-3">
        {thumbs.length > 0 ? (
          <div className="flex shrink-0 gap-1">
            {thumbs.map((item) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                key={item.id}
                src={signedMediaPath(item.id, "thumbnail")}
                alt=""
                className="h-12 w-12 rounded-md object-cover"
              />
            ))}
          </div>
        ) : null}
        <div className="min-w-0">
          <div className="font-medium">
            {project.number} · {project.name}
          </div>
          <div className="text-sm text-[var(--muted)]">
            {project.customer?.name ?? "No customer"} {address ? `· ${address}` : ""}
          </div>
        </div>
      </div>
      <div className="flex items-center gap-3 text-sm">
        <span className="text-[var(--muted)]">{when}</span>
        <ProjectStatusChip name={project.projectStatus.name} color={project.projectStatus.color} />
      </div>
    </Link>
  );
}

export function PageHeader({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className={cn("mb-6 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between")}>
      <div>
        <h1 className="text-2xl font-bold text-[var(--ink)]">{title}</h1>
        {description ? <p className="mt-1 text-[var(--muted)]">{description}</p> : null}
      </div>
      {action}
    </div>
  );
}
