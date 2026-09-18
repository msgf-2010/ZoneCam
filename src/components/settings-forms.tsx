"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Field, Input } from "@/components/ui/Field";

export function InviteForm({ roles }: { roles: Array<{ key: string; name: string }> }) {
  const [email, setEmail] = useState("");
  const [roleKey, setRoleKey] = useState(roles[0]?.key ?? "field_technician");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    setError(null);
    setMessage(null);
    const res = await fetch("/api/v1/company/invites", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, roleKey }),
    });
    const json = await res.json();
    setPending(false);
    if (!res.ok) {
      setError(json.error ?? "Invite failed.");
      return;
    }
    setEmail("");
    setMessage("Invite created. In development the accept link is printed in the server log.");
  }

  return (
    <form onSubmit={onSubmit} className="rounded-[var(--radius)] border border-[var(--line)] bg-[var(--bg-elevated)] p-5">
      <h2 className="mb-4 text-lg font-semibold">Invite teammate</h2>
      <div className="grid gap-4 md:grid-cols-[1fr_200px_auto] md:items-end">
        <Field label="Email" error={error ?? undefined}>
          <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </Field>
        <Field label="Role">
          <select
            className="w-full rounded-[10px] border border-[var(--line)] bg-white px-3 py-2.5"
            value={roleKey}
            onChange={(e) => setRoleKey(e.target.value)}
          >
            {roles.map((role) => (
              <option key={role.key} value={role.key}>
                {role.name}
              </option>
            ))}
          </select>
        </Field>
        <Button type="submit" disabled={pending} className="mb-4">
          {pending ? "Sending…" : "Send invite"}
        </Button>
      </div>
      {message ? <p className="text-sm text-[var(--ok)]">{message}</p> : null}
    </form>
  );
}

export function CompanySettingsForm({ company }: { company: { name: string; timezone: string } }) {
  const [name, setName] = useState(company.name);
  const [timezone, setTimezone] = useState(company.timezone);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    const res = await fetch("/api/v1/company", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, timezone }),
    });
    setPending(false);
    if (res.ok) setMessage("Company updated.");
  }

  return (
    <form onSubmit={onSubmit} className="rounded-[var(--radius)] border border-[var(--line)] bg-[var(--bg-elevated)] p-5">
      <h2 className="mb-4 text-lg font-semibold">Company</h2>
      <Field label="Name">
        <Input value={name} onChange={(e) => setName(e.target.value)} required />
      </Field>
      <Field label="Timezone">
        <Input value={timezone} onChange={(e) => setTimezone(e.target.value)} required />
      </Field>
      <Button type="submit" disabled={pending}>
        Save
      </Button>
      {message ? <p className="mt-3 text-sm text-[var(--ok)]">{message}</p> : null}
    </form>
  );
}

export function ProfileForm({
  user,
}: {
  user: { firstName: string; lastName: string; phone: string | null; email: string };
}) {
  const router = useRouter();
  const [firstName, setFirstName] = useState(user.firstName);
  const [lastName, setLastName] = useState(user.lastName);
  const [phone, setPhone] = useState(user.phone ?? "");
  const [pending, setPending] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    await fetch("/api/v1/users/me", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ firstName, lastName, phone }),
    });
    setPending(false);
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="rounded-[var(--radius)] border border-[var(--line)] bg-[var(--bg-elevated)] p-5">
      <h2 className="mb-4 text-lg font-semibold">Your profile</h2>
      <p className="mb-4 text-sm text-[var(--muted)]">{user.email}</p>
      <div className="grid gap-4 md:grid-cols-2">
        <Field label="First name">
          <Input value={firstName} onChange={(e) => setFirstName(e.target.value)} required />
        </Field>
        <Field label="Last name">
          <Input value={lastName} onChange={(e) => setLastName(e.target.value)} required />
        </Field>
      </div>
      <Field label="Phone">
        <Input value={phone} onChange={(e) => setPhone(e.target.value)} />
      </Field>
      <Button type="submit" disabled={pending}>
        Save profile
      </Button>
    </form>
  );
}
