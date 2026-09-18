import sharp from "sharp";

export const SMALL_THUMB_SUFFIX = ".thumb.jpg";
export const THUMB_MAX_EDGE = 240;
export const THUMB_QUALITY = 48;

export function isSmallJpegThumb(key: string | null | undefined) {
  return Boolean(key?.endsWith(SMALL_THUMB_SUFFIX));
}

export function smallThumbKey(storageKey: string) {
  return `${storageKey}${SMALL_THUMB_SUFFIX}`;
}

export async function makeJpegThumbnail(buffer: Buffer) {
  return sharp(buffer, { failOn: "none", animated: false })
    .rotate()
    .resize(THUMB_MAX_EDGE, THUMB_MAX_EDGE, { fit: "cover", withoutEnlargement: true })
    .jpeg({ quality: THUMB_QUALITY, mozjpeg: true, chromaSubsampling: "4:2:0" })
    .toBuffer();
}
