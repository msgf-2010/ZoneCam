export const FIELD_PHOTO_CATEGORIES = [
  { key: "Before", name: "Before", hint: "Site when you arrived", tone: "#2dd4bf" },
  { key: "Damage", name: "Damage", hint: "Problems to document", tone: "#fb7185" },
  { key: "Materials", name: "Materials", hint: "What was delivered", tone: "#fbbf24" },
  { key: "Progress", name: "Progress", hint: "Work underway", tone: "#38bdf8" },
  { key: "Safety", name: "Safety", hint: "Hazards and protection", tone: "#c4b5fd" },
  { key: "After", name: "After", hint: "Finished work", tone: "#86efac" },
] as const;

export type FieldSession = {
  user: { id: string; firstName: string; lastName: string };
  company: { name: string };
  role?: { key: string; name: string };
  permissions?: string[];
  token?: string;
};

export type FieldJob = {
  id: string;
  name: string;
  number: string;
  addressLine1?: string | null;
  city?: string | null;
  region?: string | null;
  postalCode?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  startDate?: string | null;
  photoCount?: number;
  lastMessage?: string | null;
  thumbs?: Array<{ id: string; url: string; name: string }>;
  customer?: { name: string } | null;
  projectStatus?: { name: string; key: string; color?: string; isTerminal?: boolean };
};

export function jobAddress(job: FieldJob) {
  return [job.addressLine1, [job.city, job.region, job.postalCode].filter(Boolean).join(", ")].filter(Boolean).join(" · ");
}

export function directionsUrl(job: FieldJob) {
  const address = jobAddress(job);
  const destination =
    job.latitude != null && job.longitude != null ? `${job.latitude},${job.longitude}` : address;
  if (!destination) return null;
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(destination)}`;
}

export function absoluteUrl(base: string, path: string) {
  if (!path) return path;
  if (path.startsWith("http")) return path;
  return `${base}${path}`;
}
