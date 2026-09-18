import { notFound } from "next/navigation";
import { getPublicReport } from "@/server/services/report-service";
import { AppError } from "@/server/http";
import { SignaturePad } from "@/components/SignaturePad";

export const dynamic = "force-dynamic";

export default async function PublicReportPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  let report;
  try {
    report = await getPublicReport(token);
  } catch (error) {
    if (error instanceof AppError && error.status === 404) notFound();
    throw error;
  }
  const snap = report.snapshot;

  return (
    <div className="mx-auto min-h-screen max-w-3xl px-4 py-10">
      <div className="text-xs uppercase tracking-[0.18em] text-[var(--brand)]">ZoneCam</div>
      <h1 className="mt-2 text-3xl font-semibold">{report.title}</h1>
      <p className="mt-2 text-[var(--muted)]">
        {snap.project.number} · {snap.project.name} · {snap.project.status}
      </p>
      <section className="mt-8 rounded-[12px] border border-[var(--line)] bg-white p-5">
        <h2 className="text-lg font-semibold">Job</h2>
        <p className="mt-2 text-sm">{snap.project.description || "Site documentation."}</p>
        <p className="mt-2 text-sm text-[var(--muted)]">
          {snap.project.customer} {snap.project.address ? `· ${snap.project.address}` : ""}
        </p>
        {snap.project.customerNotes ? <p className="mt-3 text-sm">{snap.project.customerNotes}</p> : null}
      </section>
      <section className="mt-6 rounded-[12px] border border-[var(--line)] bg-white p-5">
        <h2 className="text-lg font-semibold">Photos</h2>
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
          {snap.photos.map((photo) => (
            <figure key={photo.id}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={`/api/v1/public/reports/${token}/media/${photo.id}`}
                alt={photo.filename}
                className="aspect-square w-full rounded-lg object-cover"
              />
              <figcaption className="mt-1 text-xs text-[var(--muted)]">{photo.category}</figcaption>
            </figure>
          ))}
        </div>
      </section>
      {snap.checklists.length > 0 ? (
        <section className="mt-6 rounded-[12px] border border-[var(--line)] bg-white p-5">
          <h2 className="text-lg font-semibold">Checklists</h2>
          <ul className="mt-2 text-sm">
            {snap.checklists.map((list) => (
              <li key={list.name}>
                {list.name}: {list.done}/{list.total}
              </li>
            ))}
          </ul>
        </section>
      ) : null}
      <section className="mt-6 rounded-[12px] border border-[var(--line)] bg-white p-5">
        <h2 className="text-lg font-semibold">Sign</h2>
        {report.signatures.length > 0 ? (
          <p className="mt-2 text-sm">
            Signed by {report.signatures[0].signerName}
            {report.signatures[0].signedAt ? ` on ${new Date(report.signatures[0].signedAt).toLocaleString()}` : ""}.
          </p>
        ) : (
          <div className="mt-4">
            <SignaturePad token={token} />
          </div>
        )}
      </section>
    </div>
  );
}
