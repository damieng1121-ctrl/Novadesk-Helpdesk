import { randomUUID } from "crypto";
import { mkdir, readFile, unlink, writeFile } from "fs/promises";
import path from "path";

/**
 * Local-disk file storage for ticket attachments. Fine for a single
 * container/dev use, but doesn't survive a redeploy and won't work across
 * multiple Cloud Run instances — swap this module for a Google Cloud
 * Storage-backed implementation (same three functions) before going to
 * production. Nothing outside this file needs to change to do that: callers
 * only deal in opaque storage keys, never filesystem paths directly.
 */

const STORAGE_ROOT = process.env.UPLOAD_STORAGE_DIR
  ? path.resolve(process.env.UPLOAD_STORAGE_DIR)
  : path.resolve(process.cwd(), "storage", "uploads");

const MAX_UPLOAD_BYTES = 15 * 1024 * 1024; // 15MB

export class UploadTooLargeError extends Error {}

function sanitizeFileName(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(-120) || "file";
}

/** Storage key is namespaced by tenant/ticket so a directory listing alone can't leak across tenants. */
function buildKey(tenantId: string, ticketId: string, fileName: string): string {
  return path.posix.join(tenantId, ticketId, `${randomUUID()}-${sanitizeFileName(fileName)}`);
}

const MAX_LOGO_BYTES = 2 * 1024 * 1024; // 2MB — a nav-bar/login logo, not a photo library

/** One logo per tenant — a fresh upload always replaces the previous file. */
export async function saveTenantLogo(tenantId: string, fileName: string, data: Buffer): Promise<{ key: string }> {
  if (data.byteLength > MAX_LOGO_BYTES) {
    throw new UploadTooLargeError(`File exceeds ${MAX_LOGO_BYTES / (1024 * 1024)}MB limit`);
  }
  const key = path.posix.join("tenant-logos", tenantId, sanitizeFileName(fileName));
  const onDisk = resolveOnDisk(key);
  await mkdir(path.dirname(onDisk), { recursive: true });
  await writeFile(onDisk, data);
  return { key };
}

function resolveOnDisk(key: string): string {
  const resolved = path.resolve(STORAGE_ROOT, key);
  // Defense in depth against a malformed/malicious key escaping the storage root.
  if (!resolved.startsWith(STORAGE_ROOT + path.sep)) {
    throw new Error("Invalid storage key");
  }
  return resolved;
}

const MAX_AVATAR_BYTES = 2 * 1024 * 1024; // 2MB — a profile photo, not a photo library

/** One avatar per user — a fresh upload always replaces the previous file. */
export async function saveUserAvatar(userId: string, fileName: string, data: Buffer): Promise<{ key: string }> {
  if (data.byteLength > MAX_AVATAR_BYTES) {
    throw new UploadTooLargeError(`File exceeds ${MAX_AVATAR_BYTES / (1024 * 1024)}MB limit`);
  }
  const key = path.posix.join("user-avatars", userId, sanitizeFileName(fileName));
  const onDisk = resolveOnDisk(key);
  await mkdir(path.dirname(onDisk), { recursive: true });
  await writeFile(onDisk, data);
  return { key };
}

export async function saveUpload(
  tenantId: string,
  ticketId: string,
  fileName: string,
  data: Buffer,
): Promise<{ key: string; size: number }> {
  if (data.byteLength > MAX_UPLOAD_BYTES) {
    throw new UploadTooLargeError(`File exceeds ${MAX_UPLOAD_BYTES / (1024 * 1024)}MB limit`);
  }
  const key = buildKey(tenantId, ticketId, fileName);
  const onDisk = resolveOnDisk(key);
  await mkdir(path.dirname(onDisk), { recursive: true });
  await writeFile(onDisk, data);
  return { key, size: data.byteLength };
}

export async function readUpload(key: string): Promise<Buffer> {
  return readFile(resolveOnDisk(key));
}

export async function deleteUpload(key: string): Promise<void> {
  await unlink(resolveOnDisk(key)).catch(() => {});
}
