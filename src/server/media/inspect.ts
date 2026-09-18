/** Lightweight image header readers — original bytes are never rewritten. */

export function readImageSize(buffer: Buffer): { width: number; height: number } | null {
  if (buffer.length < 24) return null;
  if (buffer[0] === 0xff && buffer[1] === 0xd8) return jpegSize(buffer);
  if (buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47) {
    return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) };
  }
  if (buffer[0] === 0x52 && buffer[1] === 0x49 && buffer[2] === 0x46 && buffer[8] === 0x57) {
    return webpSize(buffer);
  }
  return null;
}

function jpegSize(buffer: Buffer) {
  let offset = 2;
  while (offset < buffer.length) {
    if (buffer[offset] !== 0xff) break;
    const marker = buffer[offset + 1];
    const size = buffer.readUInt16BE(offset + 2);
    if (marker >= 0xc0 && marker <= 0xc3) {
      return { height: buffer.readUInt16BE(offset + 5), width: buffer.readUInt16BE(offset + 7) };
    }
    offset += 2 + size;
  }
  return null;
}

function webpSize(buffer: Buffer) {
  if (buffer.toString("ascii", 12, 16) === "VP8X") {
    return {
      width: 1 + buffer.readUIntLE(24, 3),
      height: 1 + buffer.readUIntLE(27, 3),
    };
  }
  if (buffer.toString("ascii", 12, 16) === "VP8 ") {
    return {
      width: buffer.readUInt16LE(26) & 0x3fff,
      height: buffer.readUInt16LE(28) & 0x3fff,
    };
  }
  return null;
}

  // Lightweight header readers only — pixel resize lives in thumbnail.ts.

export function mp4DurationMs(buffer: Buffer): number | null {
  // Very small ISO-BMFF scan for mvhd timescale/duration.
  let offset = 0;
  while (offset + 8 < Math.min(buffer.length, 2_000_000)) {
    const size = buffer.readUInt32BE(offset);
    const type = buffer.toString("ascii", offset + 4, offset + 8);
    if (!size || size < 8) break;
    if (type === "moov" || type === "trak" || type === "mdia") {
      offset += 8;
      continue;
    }
    if (type === "mvhd") {
      const version = buffer[offset + 8];
      if (version === 0 && offset + 32 < buffer.length) {
        const timescale = buffer.readUInt32BE(offset + 20);
        const duration = buffer.readUInt32BE(offset + 24);
        if (timescale) return Math.round((duration / timescale) * 1000);
      }
      if (version === 1 && offset + 44 < buffer.length) {
        const timescale = buffer.readUInt32BE(offset + 28);
        const duration = Number(buffer.readBigUInt64BE(offset + 32));
        if (timescale) return Math.round((duration / timescale) * 1000);
      }
      return null;
    }
    offset += size;
  }
  return null;
}
