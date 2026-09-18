import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3";
import type { ObjectStorage, StorageObject } from "@/server/adapters/storage";

export function r2Endpoint(accountId: string, explicit?: string) {
  if (explicit) return explicit.replace(/\/$/, "");
  return `https://${accountId}.r2.cloudflarestorage.com`;
}

export function r2Configured(input: {
  accountId: string;
  bucket: string;
  accessKeyId: string;
  secretAccessKey: string;
}) {
  return Boolean(input.accountId && input.bucket && input.accessKeyId && input.secretAccessKey);
}

function assertKey(key: string) {
  if (!key || key.includes("..") || key.startsWith("/") || key.includes("\\")) {
    throw new Error("Invalid storage key.");
  }
}

export class R2ObjectStorage implements ObjectStorage {
  readonly driver = "r2";
  private client: S3Client;

  constructor(
    private bucket: string,
    config: { accountId: string; accessKeyId: string; secretAccessKey: string; endpoint?: string },
  ) {
    this.client = new S3Client({
      region: "auto",
      endpoint: r2Endpoint(config.accountId, config.endpoint),
      credentials: {
        accessKeyId: config.accessKeyId,
        secretAccessKey: config.secretAccessKey,
      },
    });
  }

  async put(object: StorageObject) {
    assertKey(object.key);
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: object.key,
        Body: object.body,
        ContentType: object.contentType,
      }),
    );
  }

  async get(key: string) {
    assertKey(key);
    const result = await this.client.send(new GetObjectCommand({ Bucket: this.bucket, Key: key }));
    if (!result.Body) throw new Error("Object was empty.");
    return Buffer.from(await result.Body.transformToByteArray());
  }

  async head(key: string) {
    assertKey(key);
    try {
      const result = await this.client.send(new HeadObjectCommand({ Bucket: this.bucket, Key: key }));
      return { size: result.ContentLength ?? 0 };
    } catch {
      return null;
    }
  }

  async delete(key: string) {
    assertKey(key);
    await this.client.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: key })).catch(() => undefined);
  }
}
