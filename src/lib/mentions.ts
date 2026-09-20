export type Mentionable = { id: string; firstName: string; lastName: string };

export function parseMentionIds(body: string, people: Mentionable[]) {
  const text = body.toLowerCase();
  const ids = new Set<string>();
  for (const person of people) {
    const full = `@${person.firstName} ${person.lastName}`.toLowerCase();
    if (text.includes(full)) ids.add(person.id);
  }
  return [...ids];
}

export const NOTIFICATION_EVENTS = [
  { key: "project.message", label: "Job messages" },
  { key: "mention", label: "Mentions" },
  { key: "media.uploaded", label: "New photos" },
  { key: "task.assigned", label: "Task assignments" },
  { key: "project.note", label: "Job notes" },
  { key: "project.status", label: "Job started / completed" },
  { key: "walkthrough.ready", label: "Walkthrough checklists" },
] as const;
