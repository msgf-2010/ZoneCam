import sharp from "sharp";

export type PhotoInspection = {
  width: number | null;
  height: number | null;
  format: string | null;
  megabytes: number;
  exposure: "dark" | "normal" | "bright";
  meanLuma: number;
};

export async function inspectPhotoBuffer(buffer: Buffer): Promise<PhotoInspection> {
  const image = sharp(buffer, { failOn: "none", animated: false });
  const meta = await image.metadata();
  const stats = await image.stats();
  const meanLuma = stats.channels.reduce((sum, channel) => sum + channel.mean, 0) / Math.max(stats.channels.length, 1);
  let exposure: PhotoInspection["exposure"] = "normal";
  if (meanLuma < 55) exposure = "dark";
  if (meanLuma > 200) exposure = "bright";
  return {
    width: meta.width ?? null,
    height: meta.height ?? null,
    format: meta.format ?? null,
    megabytes: Math.round((buffer.length / (1024 * 1024)) * 10) / 10,
    exposure,
    meanLuma,
  };
}

export function captionFromInspection(
  inspection: PhotoInspection,
  extra: { filename?: string; tags?: string[]; hasGps?: boolean },
) {
  const size =
    inspection.width && inspection.height ? `${inspection.width}×${inspection.height}` : "unknown size";
  const tags = extra.tags?.filter(Boolean).join(", ") || "untagged";
  const light =
    inspection.exposure === "dark"
      ? "The frame looks dark."
      : inspection.exposure === "bright"
        ? "The frame looks very bright."
        : "Exposure looks usable.";
  const gps = extra.hasGps ? " GPS is attached." : "";
  return `Inspector: ${extra.filename ?? "photo"} · ${size} ${inspection.format ?? "image"} · ${inspection.megabytes} MB · ${tags}. ${light}${gps}`;
}
