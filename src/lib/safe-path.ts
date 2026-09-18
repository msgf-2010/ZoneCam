const BLOCKED_NEXT = new Set(["", "/", "\\"]);

export function safeInternalPath(value: string | null | undefined, fallback: string) {
  if (!value) return fallback;
  const trimmed = value.trim();
  if (BLOCKED_NEXT.has(trimmed)) return fallback;
  if (!trimmed.startsWith("/")) return fallback;
  if (trimmed.startsWith("//") || trimmed.startsWith("/\\")) return fallback;
  if (trimmed.includes("\\") || trimmed.includes("://")) return fallback;
  if (/[\0\r\n]/.test(trimmed)) return fallback;
  if (/^\/[a-z][a-z0-9+.-]*:/i.test(trimmed)) return fallback;
  return trimmed;
}

export function safeDownloadFilename(name: string) {
  const cleaned = name.replace(/[\r\n"\\]/g, " ").replace(/\s+/g, " ").trim().slice(0, 120);
  return cleaned || "file";
}
