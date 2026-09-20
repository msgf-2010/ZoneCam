export const ALLOWED_MEDIA_TYPES: Record<string, "photo" | "video" | "file"> = {
  "image/jpeg": "photo",
  "image/jpg": "photo",
  "image/png": "photo",
  "image/webp": "photo",
  "image/heic": "photo",
  "image/heif": "photo",
  "image/gif": "photo",
  "video/mp4": "video",
  "video/quicktime": "video",
  "video/webm": "video",
  "audio/webm": "file",
  "audio/mp4": "file",
  "audio/mpeg": "file",
  "audio/ogg": "file",
  "audio/wav": "file",
};

export function mediaKindFromMime(mime: string) {
  const base = mime.toLowerCase().split(";")[0]?.trim() ?? "";
  return ALLOWED_MEDIA_TYPES[base] ?? null;
}
