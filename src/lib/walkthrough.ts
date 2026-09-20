export const WALKTHROUGH_TAG = "Walkthrough";
export const WALKTHROUGH_MAX_MS = 6 * 60 * 1000;
export const WALKTHROUGH_MAX_SCREENSHOTS = 14;
export const WALKTHROUGH_FRAME_INTERVAL_MS = 6000;

export type WalkthroughSegment = {
  startMs: number;
  endMs: number;
  text: string;
  screenshotIndex?: number | null;
};

export function formatWalkthroughClock(ms: number) {
  const total = Math.max(0, Math.floor(ms / 1000));
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

export function extensionForMime(mime: string, fallback: string) {
  if (mime.includes("mp4") || mime.includes("quicktime")) return "mp4";
  if (mime.includes("webm")) return "webm";
  if (mime.includes("ogg")) return "ogg";
  if (mime.includes("mpeg") || mime.includes("mp3")) return "mp3";
  if (mime.includes("jpeg") || mime.includes("jpg")) return "jpg";
  return fallback;
}

export function pickRecorderMime(kind: "video" | "audio") {
  if (typeof MediaRecorder === "undefined") return "";
  const candidates =
    kind === "video"
      ? ["video/webm;codecs=vp8,opus", "video/webm;codecs=vp9,opus", "video/webm", "video/mp4"]
      : ["audio/webm;codecs=opus", "audio/webm", "audio/mp4"];
  return candidates.find((type) => MediaRecorder.isTypeSupported(type)) ?? "";
}
