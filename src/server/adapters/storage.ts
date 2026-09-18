import { mkdir, writeFile, readFile, unlink, stat } from "fs/promises";
import path from "path";
import { getEnv } from "@/lib/env";
import { hmacSign, hmacVerify } from "@/server/crypto";
import { r2Configured, R2ObjectStorage } from "@/server/adapters/r2-storage";

export type StorageObject = {
  key: string;
  body: Buffer;
  contentType: string;
};

export interface ObjectStorage {
  readonly driver: string;
  put(object: StorageObject): Promise<void>;
  get(key: string): Promise<Buffer>;
  head(key: string): Promise<{ size: number } | null>;
  delete(key: string): Promise<void>;
}

export class LocalObjectStorage implements ObjectStorage {
  readonly driver = "local";
  constructor(private root: string) {}

  private resolve(key: string) {
    if (key.includes("..") || path.isAbsolute(key) || key.startsWith("/") || key.includes("\\")) {
      throw new Error("Invalid storage key.");
    }
    return path.join(this.root, key);
  }

  async put(object: StorageObject) {
    const full = this.resolve(object.key);
    await mkdir(path.dirname(full), { recursive: true });
    await writeFile(full, object.body);
  }

  async get(key: string) {
    return readFile(this.resolve(key));
  }

  async head(key: string) {
    try {
      const info = await stat(this.resolve(key));
      return { size: info.size };
    } catch {
      return null;
    }
  }

  async delete(key: string) {
    await unlink(this.resolve(key)).catch(() => undefined);
  }
}

class UnconfiguredCloudStorage implements ObjectStorage {
  constructor(
    readonly driver: "s3" | "azure" | "r2",
    private message: string,
  ) {}
  async put(): Promise<void> {
    throw new Error(this.message);
  }
  async get(): Promise<Buffer> {
    throw new Error(this.message);
  }
  async head(): Promise<{ size: number } | null> {
    throw new Error(this.message);
  }
  async delete(): Promise<void> {
    throw new Error(this.message);
  }
}

export function createObjectStorage(): ObjectStorage {
  const env = getEnv();
  if (env.STORAGE_DRIVER === "local") {
    return new LocalObjectStorage(env.STORAGE_LOCAL_DIR);
  }
  const docs = "Set credentials in the environment. See docs/DEPLOY.md.";
  if (env.STORAGE_DRIVER === "s3") {
    return new UnconfiguredCloudStorage("s3", `Amazon S3 is selected but not connected. ${docs}`);
  }
  if (env.STORAGE_DRIVER === "azure") {
    return new UnconfiguredCloudStorage("azure", `Azure Blob Storage is selected but not connected. ${docs}`);
  }
  if (
    r2Configured({
      accountId: env.R2_ACCOUNT_ID,
      bucket: env.R2_BUCKET,
      accessKeyId: env.R2_ACCESS_KEY_ID,
      secretAccessKey: env.R2_SECRET_ACCESS_KEY,
    })
  ) {
    return new R2ObjectStorage(env.R2_BUCKET, {
      accountId: env.R2_ACCOUNT_ID,
      accessKeyId: env.R2_ACCESS_KEY_ID,
      secretAccessKey: env.R2_SECRET_ACCESS_KEY,
      endpoint: env.R2_ENDPOINT || undefined,
    });
  }
  return new UnconfiguredCloudStorage("r2", `Cloudflare R2 is selected but not connected. ${docs}`);
}

export function signMediaAccess(mediaId: string, variant: string, expiresAt: number) {
  return hmacSign(`${mediaId}:${variant}:${expiresAt}`);
}

export function verifyMediaAccess(mediaId: string, variant: string, expiresAt: number, signature: string) {
  if (Date.now() > expiresAt) return false;
  return hmacVerify(`${mediaId}:${variant}:${expiresAt}`, signature);
}

export function signedMediaPath(mediaId: string, variant: "original" | "thumbnail" | "preview", ttlSeconds = 300) {
  const expiresAt = Date.now() + ttlSeconds * 1000;
  const sig = signMediaAccess(mediaId, variant, expiresAt);
  return `/api/v1/media/${mediaId}/content?variant=${variant}&exp=${expiresAt}&sig=${encodeURIComponent(sig)}`;
}
