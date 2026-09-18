import Link from "next/link";
import { requireAuth } from "@/server/auth/context";
import { listFieldJobs } from "@/server/services/project-service";
import { formatAddress } from "@/lib/format";
import { FieldNewJob } from "@/components/field/FieldNewJob";

export const dynamic = "force-dynamic";

export default async function FieldJobsPage() {
  const ctx = await requireAuth();
  const all = await listFieldJobs(ctx);
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);

  const open = all.filter((job) => !job.projectStatus.isTerminal);
  const today = open.filter((job) => {
    if (!job.startDate) return false;
    const at = new Date(job.startDate).getTime();
    return at >= start.getTime() && at < end.getTime();
  });
  const rest = open.filter((job) => !today.some((row) => row.id === job.id));
  const canCreate = ctx.permissions.has("projects.create");

  return (
    <div className="field-stack">
      <h1 className="field-title">Your jobs</h1>
      <p className="field-lead">Tap a job to add photos. Thumbnails are the latest shots on that site.</p>
      {open.length === 0 && !canCreate ? (
        <p className="field-empty">No jobs on your list yet. Ask the office to assign you.</p>
      ) : null}
      {today.length > 0 ? <h2 className="field-sub">Today</h2> : null}
      {today.map((job) => (
        <JobCard key={job.id} job={job} spotlight />
      ))}
      {rest.length > 0 ? <h2 className="field-sub">{today.length ? "Other open jobs" : "Open jobs"}</h2> : null}
      {rest.map((job) => (
        <JobCard key={job.id} job={job} />
      ))}
      {canCreate ? <FieldNewJob userId={ctx.user.id} compact={open.length > 0} /> : null}
    </div>
  );
}

function JobCard({
  job,
  spotlight,
}: {
  spotlight?: boolean;
  job: {
    id: string;
    name: string;
    number: string;
    city?: string | null;
    addressLine1?: string | null;
    region?: string | null;
    postalCode?: string | null;
    photoCount: number;
    thumbs: Array<{ id: string; url: string; name: string }>;
    lastMessage?: string | null;
    projectStatus: { name: string; color: string };
    customer?: { name: string } | null;
  };
}) {
  const address = formatAddress(job);
  const extra = Math.max(0, job.photoCount - job.thumbs.length);
  return (
    <Link href={`/field/${job.id}`} className={spotlight ? "field-job field-job-hot" : "field-job"}>
      {job.thumbs.length > 0 ? (
        <div className="field-job-photos">
          {job.thumbs.map((thumb) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img key={thumb.id} src={thumb.url} alt={thumb.name} />
          ))}
          {extra > 0 ? <span className="field-job-more">+{extra}</span> : null}
        </div>
      ) : (
        <div className="field-job-photos field-job-photos-empty">No photos yet</div>
      )}
      <div className="field-job-body">
        <div className="field-job-kicker">
          {job.number} · {job.photoCount} photo{job.photoCount === 1 ? "" : "s"}
        </div>
        <div className="field-job-name">{job.name}</div>
        <div className="field-job-meta">
          {job.customer?.name ?? "No customer"} {address ? `· ${address}` : ""}
        </div>
        <span className="field-chip" style={{ background: `${job.projectStatus.color}33`, color: "#fff" }}>
          {job.projectStatus.name}
        </span>
        {job.lastMessage ? <div className="field-job-msg">{job.lastMessage}</div> : null}
      </div>
    </Link>
  );
}
