export const PERMISSIONS = [
  { key: "customers.view", category: "Customers", description: "View customers" },
  { key: "customers.create", category: "Customers", description: "Create customers" },
  { key: "customers.edit", category: "Customers", description: "Edit customers" },
  { key: "customers.delete", category: "Customers", description: "Delete customers" },
  { key: "projects.view", category: "Projects", description: "View projects" },
  { key: "projects.create", category: "Projects", description: "Create projects" },
  { key: "projects.edit", category: "Projects", description: "Edit projects" },
  { key: "projects.delete", category: "Projects", description: "Delete projects" },
  { key: "media.view", category: "Media", description: "View photos and videos" },
  { key: "media.upload", category: "Media", description: "Upload media" },
  { key: "media.delete", category: "Media", description: "Delete media" },
  { key: "media.annotate", category: "Media", description: "Annotate photos" },
  { key: "tasks.view", category: "Tasks", description: "View tasks and checklists" },
  { key: "tasks.create", category: "Tasks", description: "Create tasks" },
  { key: "tasks.edit", category: "Tasks", description: "Edit tasks" },
  { key: "tasks.complete", category: "Tasks", description: "Complete tasks" },
  { key: "reports.view", category: "Reports", description: "View reports" },
  { key: "reports.create", category: "Reports", description: "Create reports" },
  { key: "reports.share", category: "Reports", description: "Share reports" },
  { key: "payments.view", category: "Payments", description: "View payments" },
  { key: "payments.create", category: "Payments", description: "Create payment requests" },
  { key: "users.view", category: "Users", description: "View company members" },
  { key: "users.manage", category: "Users", description: "Invite and manage members" },
  { key: "company.settings", category: "Company", description: "Change company settings" },
  { key: "audit.view", category: "Company", description: "View audit logs" },
  { key: "integrations.view", category: "Company", description: "View integrations" },
  { key: "integrations.manage", category: "Company", description: "Connect and disconnect integrations" },
] as const;

export type PermissionKey = (typeof PERMISSIONS)[number]["key"];

export const ALL_PERMISSION_KEYS = PERMISSIONS.map((p) => p.key);

export const SYSTEM_ROLES: Array<{
  key: string;
  name: string;
  description: string;
  permissions: readonly PermissionKey[] | "*";
}> = [
  {
    key: "owner",
    name: "Owner",
    description: "Full access, including company settings and billing later.",
    permissions: "*",
  },
  {
    key: "admin",
    name: "Admin",
    description: "Manage people, projects, and settings.",
    permissions: "*",
  },
  {
    key: "manager",
    name: "Manager",
    description: "Run jobs, assign work, and review field documentation.",
    permissions: [
      "customers.view",
      "customers.create",
      "customers.edit",
      "customers.delete",
      "projects.view",
      "projects.create",
      "projects.edit",
      "media.view",
      "media.upload",
      "media.delete",
      "media.annotate",
      "tasks.view",
      "tasks.create",
      "tasks.edit",
      "tasks.complete",
      "reports.view",
      "reports.create",
      "reports.share",
      "payments.view",
      "payments.create",
      "users.view",
      "integrations.view",
      "integrations.manage",
    ],
  },
  {
    key: "office",
    name: "Office",
    description: "Coordinate jobs from the office.",
    permissions: [
      "customers.view",
      "customers.create",
      "customers.edit",
      "projects.view",
      "projects.create",
      "projects.edit",
      "media.view",
      "media.upload",
      "media.annotate",
      "tasks.view",
      "tasks.create",
      "tasks.edit",
      "tasks.complete",
      "reports.view",
      "reports.create",
      "reports.share",
      "payments.view",
      "users.view",
      "integrations.view",
    ],
  },
  {
    key: "field_technician",
    name: "Field Technician",
    description: "Document jobs in the field.",
    permissions: [
      "customers.view",
      "projects.view",
      "media.view",
      "media.upload",
      "media.annotate",
      "tasks.view",
      "tasks.complete",
      "reports.view",
    ],
  },
  {
    key: "viewer",
    name: "Viewer",
    description: "Read-only access.",
    permissions: ["customers.view", "projects.view", "media.view", "tasks.view", "reports.view", "users.view"],
  },
];

export const DEFAULT_PROJECT_STATUSES = [
  { key: "new", name: "New", color: "#64748b", sortOrder: 10, isTerminal: false },
  { key: "scheduled", name: "Scheduled", color: "#2563eb", sortOrder: 20, isTerminal: false },
  { key: "in_progress", name: "In Progress", color: "#d97706", sortOrder: 30, isTerminal: false },
  { key: "on_hold", name: "On Hold", color: "#7c3aed", sortOrder: 40, isTerminal: false },
  { key: "completed", name: "Completed", color: "#15803d", sortOrder: 50, isTerminal: true },
  { key: "cancelled", name: "Cancelled", color: "#b91c1c", sortOrder: 60, isTerminal: true },
];

export const DEFAULT_PROJECT_TYPES = [
  { key: "service", name: "Service" },
  { key: "install", name: "Install" },
  { key: "inspection", name: "Inspection" },
  { key: "maintenance", name: "Maintenance" },
];
