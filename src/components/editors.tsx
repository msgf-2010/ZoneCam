"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Field, Input, Textarea } from "@/components/ui/Field";

type CustomerForm = {
  name: string;
  customerNumber: string;
  email: string;
  phone: string;
  addressLine1: string;
  city: string;
  region: string;
  postalCode: string;
  country: string;
  notes: string;
  contactFirstName: string;
  contactLastName: string;
  contactEmail: string;
  contactPhone: string;
};

const empty: CustomerForm = {
  name: "",
  customerNumber: "",
  email: "",
  phone: "",
  addressLine1: "",
  city: "",
  region: "",
  postalCode: "",
  country: "",
  notes: "",
  contactFirstName: "",
  contactLastName: "",
  contactEmail: "",
  contactPhone: "",
};

export function CustomerEditor({
  customerId,
  initial,
}: {
  customerId?: string;
  initial?: Partial<CustomerForm>;
}) {
  const router = useRouter();
  const [form, setForm] = useState<CustomerForm>({ ...empty, ...initial });
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  function set<K extends keyof CustomerForm>(key: K, value: CustomerForm[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    setError(null);
    const payload: Record<string, unknown> = {
      name: form.name,
      customerNumber: form.customerNumber || null,
      email: form.email || null,
      phone: form.phone || null,
      addressLine1: form.addressLine1 || null,
      city: form.city || null,
      region: form.region || null,
      postalCode: form.postalCode || null,
      country: form.country || null,
      notes: form.notes || null,
    };
    if (!customerId && (form.contactFirstName || form.contactLastName)) {
      payload.contact = {
        firstName: form.contactFirstName,
        lastName: form.contactLastName,
        email: form.contactEmail || null,
        phone: form.contactPhone || null,
      };
    }
    const res = await fetch(customerId ? `/api/v1/customers/${customerId}` : "/api/v1/customers", {
      method: customerId ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const json = await res.json();
    setPending(false);
    if (!res.ok) {
      setError(json.error ?? "Could not save customer.");
      return;
    }
    router.push(`/customers/${json.data.id}`);
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="max-w-2xl">
      <Field label="Customer name">
        <Input value={form.name} onChange={(e) => set("name", e.target.value)} required />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Account number">
          <Input value={form.customerNumber} onChange={(e) => set("customerNumber", e.target.value)} />
        </Field>
        <Field label="Phone">
          <Input value={form.phone} onChange={(e) => set("phone", e.target.value)} />
        </Field>
      </div>
      <Field label="Email">
        <Input type="email" value={form.email} onChange={(e) => set("email", e.target.value)} />
      </Field>
      <Field label="Address">
        <Input value={form.addressLine1} onChange={(e) => set("addressLine1", e.target.value)} />
      </Field>
      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="City">
          <Input value={form.city} onChange={(e) => set("city", e.target.value)} />
        </Field>
        <Field label="Region">
          <Input value={form.region} onChange={(e) => set("region", e.target.value)} />
        </Field>
        <Field label="Postal code">
          <Input value={form.postalCode} onChange={(e) => set("postalCode", e.target.value)} />
        </Field>
      </div>
      <Field label="Country">
        <Input value={form.country} onChange={(e) => set("country", e.target.value)} />
      </Field>
      <Field label="Notes">
        <Textarea value={form.notes} onChange={(e) => set("notes", e.target.value)} />
      </Field>
      {!customerId ? (
        <>
          <h2 className="mb-3 mt-6 text-base font-semibold">Primary contact</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="First name">
              <Input value={form.contactFirstName} onChange={(e) => set("contactFirstName", e.target.value)} />
            </Field>
            <Field label="Last name">
              <Input value={form.contactLastName} onChange={(e) => set("contactLastName", e.target.value)} />
            </Field>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Contact email">
              <Input type="email" value={form.contactEmail} onChange={(e) => set("contactEmail", e.target.value)} />
            </Field>
            <Field label="Contact phone">
              <Input value={form.contactPhone} onChange={(e) => set("contactPhone", e.target.value)} />
            </Field>
          </div>
        </>
      ) : null}
      {error ? <p className="mb-3 text-sm text-[var(--danger)]">{error}</p> : null}
      <Button type="submit" disabled={pending}>
        {pending ? "Saving…" : "Save customer"}
      </Button>
    </form>
  );
}

export function ProjectEditor({ projectId }: { projectId?: string }) {
  const router = useRouter();
  const [meta, setMeta] = useState<{
    statuses: Array<{ id: string; key: string; name: string }>;
    types: Array<{ id: string; name: string }>;
    members: Array<{ id: string; firstName: string; lastName: string }>;
  } | null>(null);
  const [customers, setCustomers] = useState<Array<{ id: string; name: string; contacts: Array<{ id: string; firstName: string; lastName: string }> }>>([]);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [form, setForm] = useState({
    name: "",
    number: "",
    customerId: "",
    customerContactId: "",
    projectTypeId: "",
    projectStatusKey: "new",
    description: "",
    internalNotes: "",
    customerNotes: "",
    addressLine1: "",
    city: "",
    region: "",
    postalCode: "",
    latitude: "",
    longitude: "",
    startDate: "",
    expectedCompletionDate: "",
    memberIds: [] as string[],
  });

  useEffect(() => {
    Promise.all([
      fetch("/api/v1/projects/meta").then((r) => r.json()),
      fetch("/api/v1/customers").then((r) => r.json()),
      projectId ? fetch(`/api/v1/projects/${projectId}`).then((r) => r.json()) : Promise.resolve(null),
    ]).then(([metaJson, customerJson, projectJson]) => {
      setMeta(metaJson.data);
      setCustomers(customerJson.data ?? []);
      if (projectJson?.data) {
        const p = projectJson.data;
        setForm({
          name: p.name,
          number: p.number,
          customerId: p.customerId ?? "",
          customerContactId: p.customerContactId ?? "",
          projectTypeId: p.projectTypeId ?? "",
          projectStatusKey: p.projectStatus?.key ?? "new",
          description: p.description ?? "",
          internalNotes: p.internalNotes ?? "",
          customerNotes: p.customerNotes ?? "",
          addressLine1: p.addressLine1 ?? "",
          city: p.city ?? "",
          region: p.region ?? "",
          postalCode: p.postalCode ?? "",
          latitude: p.latitude != null ? String(p.latitude) : "",
          longitude: p.longitude != null ? String(p.longitude) : "",
          startDate: p.startDate ? String(p.startDate).slice(0, 10) : "",
          expectedCompletionDate: p.expectedCompletionDate ? String(p.expectedCompletionDate).slice(0, 10) : "",
          memberIds: (p.members ?? []).map((m: { userId: string }) => m.userId),
        });
      }
    });
  }, [projectId]);

  const contacts = customers.find((c) => c.id === form.customerId)?.contacts ?? [];

  function toggleMember(id: string) {
    setForm((current) => ({
      ...current,
      memberIds: current.memberIds.includes(id)
        ? current.memberIds.filter((x) => x !== id)
        : [...current.memberIds, id],
    }));
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    setError(null);
    const payload = {
      ...form,
      customerId: form.customerId || null,
      customerContactId: form.customerContactId || null,
      projectTypeId: form.projectTypeId || null,
      number: form.number || null,
      latitude: form.latitude === "" ? null : Number(form.latitude),
      longitude: form.longitude === "" ? null : Number(form.longitude),
    };
    const res = await fetch(projectId ? `/api/v1/projects/${projectId}` : "/api/v1/projects", {
      method: projectId ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const json = await res.json();
    if (!res.ok) {
      setPending(false);
      setError(json.error ?? "Could not save project.");
      return;
    }
    if (projectId) {
      await fetch(`/api/v1/projects/${projectId}/members`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userIds: form.memberIds }),
      });
    }
    setPending(false);
    router.push(`/projects/${json.data.id}`);
    router.refresh();
  }

  if (!meta) return <p className="text-sm text-[var(--muted)]">Loading form…</p>;

  return (
    <form onSubmit={onSubmit} className="max-w-3xl">
      <Field label="Job name">
        <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Job number">
          <Input value={form.number} onChange={(e) => setForm({ ...form, number: e.target.value })} placeholder="Auto if empty" />
        </Field>
        <Field label="Status">
          <select
            className="w-full rounded-[10px] border border-[var(--line)] bg-white px-3 py-2.5"
            value={form.projectStatusKey}
            onChange={(e) => setForm({ ...form, projectStatusKey: e.target.value })}
          >
            {meta.statuses.map((s) => (
              <option key={s.key} value={s.key}>
                {s.name}
              </option>
            ))}
          </select>
        </Field>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Customer">
          <select
            className="w-full rounded-[10px] border border-[var(--line)] bg-white px-3 py-2.5"
            value={form.customerId}
            onChange={(e) => setForm({ ...form, customerId: e.target.value, customerContactId: "" })}
          >
            <option value="">None</option>
            {customers.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Customer contact">
          <select
            className="w-full rounded-[10px] border border-[var(--line)] bg-white px-3 py-2.5"
            value={form.customerContactId}
            onChange={(e) => setForm({ ...form, customerContactId: e.target.value })}
          >
            <option value="">None</option>
            {contacts.map((c) => (
              <option key={c.id} value={c.id}>
                {c.firstName} {c.lastName}
              </option>
            ))}
          </select>
        </Field>
      </div>
      <Field label="Job type">
        <select
          className="w-full rounded-[10px] border border-[var(--line)] bg-white px-3 py-2.5"
          value={form.projectTypeId}
          onChange={(e) => setForm({ ...form, projectTypeId: e.target.value })}
        >
          <option value="">None</option>
          {meta.types.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Site address">
        <Input value={form.addressLine1} onChange={(e) => setForm({ ...form, addressLine1: e.target.value })} />
      </Field>
      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="City">
          <Input value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} />
        </Field>
        <Field label="Region">
          <Input value={form.region} onChange={(e) => setForm({ ...form, region: e.target.value })} />
        </Field>
        <Field label="Postal code">
          <Input value={form.postalCode} onChange={(e) => setForm({ ...form, postalCode: e.target.value })} />
        </Field>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Latitude">
          <Input value={form.latitude} onChange={(e) => setForm({ ...form, latitude: e.target.value })} />
        </Field>
        <Field label="Longitude">
          <Input value={form.longitude} onChange={(e) => setForm({ ...form, longitude: e.target.value })} />
        </Field>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Start date">
          <Input type="date" value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} />
        </Field>
        <Field label="Expected completion">
          <Input type="date" value={form.expectedCompletionDate} onChange={(e) => setForm({ ...form, expectedCompletionDate: e.target.value })} />
        </Field>
      </div>
      <Field label="Description">
        <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
      </Field>
      <Field label="Internal notes">
        <Textarea value={form.internalNotes} onChange={(e) => setForm({ ...form, internalNotes: e.target.value })} />
      </Field>
      <Field label="Customer-facing notes">
        <Textarea value={form.customerNotes} onChange={(e) => setForm({ ...form, customerNotes: e.target.value })} />
      </Field>
      <fieldset className="mb-4">
        <legend className="mb-2 text-sm font-medium">Assigned team</legend>
        <div className="grid gap-2 sm:grid-cols-2">
          {meta.members.map((m) => (
            <label key={m.id} className="flex min-h-11 items-center gap-2 rounded-[10px] border border-[var(--line)] bg-white px-3">
              <input type="checkbox" checked={form.memberIds.includes(m.id)} onChange={() => toggleMember(m.id)} />
              {m.firstName} {m.lastName}
            </label>
          ))}
        </div>
      </fieldset>
      {error ? <p className="mb-3 text-sm text-[var(--danger)]">{error}</p> : null}
      <Button type="submit" disabled={pending}>
        {pending ? "Saving…" : projectId ? "Save job" : "Create job"}
      </Button>
    </form>
  );
}
