import { requireAuth } from "@/server/auth/context";
import { listRoles } from "@/server/services/company-service";
import { listChecklistTemplates } from "@/server/services/checklist-service";
import { Card } from "@/components/ui/Card";
import { CompanySettingsForm, ProfileForm } from "@/components/settings-forms";
import { TemplateEditor } from "@/components/TaskDetail";
import { NotificationPrefs } from "@/components/NotificationPrefs";
import { listNotificationPreferences } from "@/server/services/notification-service";

export default async function SettingsPage() {
  const ctx = await requireAuth();
  const canSettings = ctx.permissions.has("company.settings");
  const [roles, templates, prefs] = await Promise.all([
    listRoles(ctx),
    listChecklistTemplates(ctx),
    listNotificationPreferences(ctx),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Settings</h1>
        <p className="mt-1 text-[var(--muted)]">Account, company, and roles.</p>
      </div>
      <ProfileForm user={ctx.user} />
      {canSettings ? (
        <CompanySettingsForm company={ctx.company} />
      ) : (
        <Card title="Company">
          <p className="text-sm text-[var(--muted)]">
            {ctx.company.name} · {ctx.company.slug}
          </p>
        </Card>
      )}
      <Card title="Notifications" description="In-app alerts are stored in the database. Email uses the console adapter until a mail provider is connected.">
        <NotificationPrefs initial={prefs} />
      </Card>
      <Card title="Checklist templates" description="Reusable field lists applied to jobs. Completing items writes to the job timeline.">
        <ul className="mb-4 space-y-3 text-sm">
          {templates.map((template) => (
            <li key={template.id}>
              <div className="font-medium">{template.name}</div>
              <p className="text-[var(--muted)]">{template.items.map((item) => item.title).join(" · ")}</p>
            </li>
          ))}
        </ul>
        <TemplateEditor canCreate={ctx.permissions.has("tasks.create")} />
      </Card>
      <Card title="Roles" description="Permissions are enforced on the server for every request.">
        <div className="space-y-4">
          {roles.map((role) => (
            <div key={role.id} className="rounded-lg border border-[var(--line)] p-4">
              <div className="font-medium">{role.name}</div>
              <p className="mt-1 text-sm text-[var(--muted)]">{role.description}</p>
              <p className="mt-2 text-xs text-[var(--muted)]">{role.permissions.join(" · ")}</p>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
