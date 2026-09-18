export const ALLOWED_MEDIA_TYPES: Record<string, "photo" | "video"> = {
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
};

export function mediaKindFromMime(mime: string) {
  return ALLOWED_MEDIA_TYPES[mime.toLowerCase()] ?? null;
}
