import { requireAuth } from "@/server/auth/context";
import { listMembers, listRoles } from "@/server/services/company-service";
import { Card } from "@/components/ui/Card";
import { StatusChip } from "@/components/ui/EmptyState";
import { InviteForm } from "@/components/settings-forms";

export default async function TeamPage() {
  const ctx = await requireAuth();
  if (!ctx.permissions.has("users.view")) {
    return (
      <div>
        <h1 className="text-2xl font-semibold">Team</h1>
        <p className="mt-2 text-[var(--muted)]">You do not have permission to view company members.</p>
      </div>
    );
  }
  const canManage = ctx.permissions.has("users.manage");
  const [members, roles] = await Promise.all([listMembers(ctx), listRoles(ctx)]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Team</h1>
        <p className="mt-1 text-[var(--muted)]">People with access to this company.</p>
      </div>
      {canManage ? <InviteForm roles={roles.map((r) => ({ key: r.key, name: r.name }))} /> : null}
      <Card title="Members">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-[var(--line)] text-[var(--muted)]">
                <th className="py-2 font-medium">Name</th>
                <th className="py-2 font-medium">Email</th>
                <th className="py-2 font-medium">Role</th>
                <th className="py-2 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {members.map((member) => (
                <tr key={member.id} className="border-b border-[var(--line)]">
                  <td className="py-3">
                    {member.user.firstName} {member.user.lastName}
                  </td>
                  <td className="py-3">{member.user.email}</td>
                  <td className="py-3">{member.role.name}</td>
                  <td className="py-3">
                    <StatusChip tone={member.status === "active" ? "ok" : "warn"}>{member.status}</StatusChip>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
