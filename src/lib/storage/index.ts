import "server-only";
import { promises as fs } from "node:fs";
import path from "node:path";
import { DeleteObjectCommand, GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { env } from "../env";
import { randomToken } from "../crypto";

/**
 * Object storage abstraction. Files never touch PostgreSQL — only the object key is stored.
 * Add a provider by implementing StorageProvider and returning it from `getStorage`.
 */
export interface StorageProvider {
  put(key: string, body: Buffer, contentType: string): Promise<void>;
  get(key: string): Promise<{ body: Buffer; contentType: string } | null>;
  delete(key: string): Promise<void>;
}

const EXT_TYPES: Record<string, string> = { png: "image/png", jpg: "image/jpeg", webp: "image/webp" };

export function contentTypeForKey(key: string) {
  return EXT_TYPES[key.split(".").pop() ?? ""] ?? "application/octet-stream";
}

class LocalStorage implements StorageProvider {
  private root = path.resolve(/* turbopackIgnore: true */ process.cwd(), env.LOCAL_STORAGE_DIR);

  private resolve(key: string) {
    const full = path.resolve(this.root, key);
    if (!full.startsWith(this.root + path.sep)) throw new Error("Invalid storage key");
    return full;
  }

  async put(key: string, body: Buffer) {
    const file = this.resolve(key);
    await fs.mkdir(path.dirname(file), { recursive: true });
    await fs.writeFile(file, body);
  }

  async get(key: string) {
    try {
      return { body: await fs.readFile(this.resolve(key)), contentType: contentTypeForKey(key) };
    } catch {
      return null;
    }
  }

  async delete(key: string) {
    await fs.rm(this.resolve(key), { force: true });
  }
}

class S3Storage implements StorageProvider {
  private client = new S3Client({
    region: env.S3_REGION,
    endpoint: env.S3_ENDPOINT,
    forcePathStyle: env.S3_FORCE_PATH_STYLE,
    credentials: { accessKeyId: env.S3_ACCESS_KEY_ID!, secretAccessKey: env.S3_SECRET_ACCESS_KEY! },
  });

  async put(key: string, body: Buffer, contentType: string) {
    await this.client.send(new PutObjectCommand({ Bucket: env.S3_BUCKET!, Key: key, Body: body, ContentType: contentType }));
  }

  async get(key: string) {
    try {
      const res = await this.client.send(new GetObjectCommand({ Bucket: env.S3_BUCKET!, Key: key }));
      const bytes = await res.Body!.transformToByteArray();
      return { body: Buffer.from(bytes), contentType: res.ContentType ?? contentTypeForKey(key) };
    } catch (err: unknown) {
      if ((err as { name?: string }).name === "NoSuchKey") return null;
      throw err;
    }
  }

  async delete(key: string) {
    await this.client.send(new DeleteObjectCommand({ Bucket: env.S3_BUCKET!, Key: key }));
  }
}

let instance: StorageProvider | undefined;
export function getStorage(): StorageProvider {
  instance ??= env.STORAGE_DRIVER === "s3" ? new S3Storage() : new LocalStorage();
  return instance;
}

export const MAX_IMAGE_BYTES = 2 * 1024 * 1024;

/** Identify an image by its magic bytes. The client-supplied MIME type is never trusted. */
export function sniffImage(buf: Buffer): "png" | "jpg" | "webp" | null {
  if (buf.length > 12 && buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return "png";
  if (buf.length > 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return "jpg";
  if (buf.length > 12 && buf.subarray(0, 4).toString("ascii") === "RIFF" && buf.subarray(8, 12).toString("ascii") === "WEBP") return "webp";
  return null;
}

export type UploadKind = "logos" | "signatures";

export async function saveImage(kind: UploadKind, businessId: string, file: File) {
  if (file.size === 0) throw new UploadError("Choose an image to upload.");
  if (file.size > MAX_IMAGE_BYTES) throw new UploadError("Image must be 2 MB or smaller.");
  const buf = Buffer.from(await file.arrayBuffer());
  const ext = sniffImage(buf);
  if (!ext) throw new UploadError("Only PNG, JPEG or WebP images are allowed.");
  const key = `${kind}/${businessId}/${randomToken(18)}.${ext}`;
  await getStorage().put(key, buf, EXT_TYPES[ext]!);
  return key;
}

export class UploadError extends Error {}

export const PUBLIC_ASSET_KEY = /^(logos|signatures)\/[0-9a-f-]{36}\/[A-Za-z0-9_-]{20,}\.(png|jpg|webp)$/;

export function assetUrl(key: string | null | undefined) {
  return key ? `/api/assets/${key}` : null;
}
