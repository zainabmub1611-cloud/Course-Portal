import { promises as fs } from "fs";
import path from "path";
import crypto from "crypto";
import { db, isRealDatabase } from "@/lib/db";

const UPLOAD_DIR = path.resolve(process.cwd(), "public", "uploads");
const FALLBACK_UPLOAD_DIR = path.resolve(process.cwd(), "uploads");
const PUBLIC_PREFIX = "/api/uploads";
const MAX_RAM_CACHE_FILE_BYTES = 10 * 1024 * 1024; // 10 MB

export const MIME_BY_EXT: Record<string, string> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".gif": "image/gif",
  ".svg": "image/svg+xml",
  ".pdf": "application/pdf",
  ".doc": "application/msword",
  ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ".ppt": "application/vnd.ms-powerpoint",
  ".pptx": "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  ".txt": "text/plain; charset=utf-8",
  ".mp4": "video/mp4",
  ".webm": "video/webm",
  ".mov": "video/quicktime",
  ".mkv": "video/x-matroska",
};

interface CachedUpload {
  buffer: Buffer;
  mimeType: string;
  originalName: string;
  size: number;
}

export interface StoredUpload {
  url: string;
  filePath: string | null;
  buffer: Buffer | null;
  mimeType: string;
  originalName: string | null;
  size: number;
}

const globalForStorage = globalThis as unknown as {
  uploadedFilesCache?: Map<string, CachedUpload>;
  uploadedFilesTableReadyPromise?: Promise<void> | null;
};

function getMemoryCache(): Map<string, CachedUpload> {
  if (!globalForStorage.uploadedFilesCache) {
    globalForStorage.uploadedFilesCache = new Map();
  }
  return globalForStorage.uploadedFilesCache;
}

function setMemoryCache(url: string, entry: CachedUpload) {
  if (entry.size > MAX_RAM_CACHE_FILE_BYTES) return;
  const cache = getMemoryCache();
  if (cache.size >= 100) {
    const oldestKey = cache.keys().next().value;
    if (oldestKey) cache.delete(oldestKey);
  }
  cache.set(url, entry);
}

async function ensureUploadTable(): Promise<boolean> {
  if (!isRealDatabase()) return false;
  if (!globalForStorage.uploadedFilesTableReadyPromise) {
    globalForStorage.uploadedFilesTableReadyPromise = (async () => {
      await (db as unknown as {
        $executeRawUnsafe: (sql: string, ...values: unknown[]) => Promise<unknown>;
      }).$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS "uploaded_files" (
          "url" TEXT PRIMARY KEY,
          "originalName" TEXT NOT NULL,
          "mimeType" TEXT NOT NULL,
          "size" INTEGER NOT NULL,
          "data" BYTEA NOT NULL,
          "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
      `);
    })();
  }
  try {
    await globalForStorage.uploadedFilesTableReadyPromise;
    return true;
  } catch (err) {
    globalForStorage.uploadedFilesTableReadyPromise = null;
    console.warn("[storage] failed to ensure uploaded_files table:", err);
    return false;
  }
}

export function getMimeTypeForFilename(filename: string, fallbackType?: string): string {
  const ext = path.extname(filename || "").toLowerCase();
  if (ext && MIME_BY_EXT[ext]) {
    return MIME_BY_EXT[ext];
  }
  if (fallbackType && fallbackType !== "application/octet-stream") {
    return fallbackType;
  }
  return "application/octet-stream";
}

export async function ensureUploadDir() {
  await fs.mkdir(UPLOAD_DIR, { recursive: true });
}

export function isAbsoluteUrl(url: string): boolean {
  return /^https?:\/\//i.test(url);
}

function parseUploadSegments(urlOrPath: string): string[] | null {
  if (!urlOrPath || isAbsoluteUrl(urlOrPath) || urlOrPath.startsWith("data:")) {
    return null;
  }

  const cleanUrl = urlOrPath.split("?")[0].split("#")[0];
  let rel = cleanUrl;
  if (rel.startsWith("/api/uploads/")) {
    rel = rel.slice("/api/uploads/".length);
  } else if (rel.startsWith("/uploads/")) {
    rel = rel.slice("/uploads/".length);
  } else {
    rel = rel.replace(/^\/+/, "");
  }

  let decodedRel: string;
  try {
    decodedRel = decodeURIComponent(rel);
  } catch {
    decodedRel = rel;
  }

  const segments = decodedRel.split(/[/\\]+/).filter(Boolean);
  if (segments.length === 0 || segments.some((s) => s === "." || s === ".." || s.includes("\0"))) {
    return null;
  }
  return segments;
}

/**
 * Safely resolves an uploaded asset URL (`/api/uploads/...` or legacy `/uploads/...`)
 * to an existing file path on disk inside `public/uploads` (or `uploads/`).
 * Returns null if the URL is external, invalid, or the file does not exist on disk.
 */
export async function resolveUploadFilePath(urlOrPath: string): Promise<string | null> {
  const segments = parseUploadSegments(urlOrPath);
  if (!segments) return null;

  for (const root of [UPLOAD_DIR, FALLBACK_UPLOAD_DIR]) {
    const candidate = path.resolve(root, ...segments);
    if (!candidate.startsWith(root + path.sep)) continue;
    try {
      const stat = await fs.stat(candidate);
      if (stat.isFile()) {
        return candidate;
      }
    } catch {
      // Try next root
    }
  }

  return null;
}

async function queryDbUploadRow(
  canonicalUrl: string,
  legacyUrl: string,
  includeData: boolean
): Promise<{
  originalName: string;
  mimeType: string;
  size: number;
  data?: Uint8Array | Buffer;
} | null> {
  if (!(await ensureUploadTable())) return null;
  try {
    const selectCols = includeData
      ? `"originalName", "mimeType", "size", "data"`
      : `"originalName", "mimeType", "size"`;
    const rows = (await (db as unknown as {
      $queryRawUnsafe: (sql: string, ...values: unknown[]) => Promise<Array<{
        originalName: string;
        mimeType: string;
        size: number;
        data?: Uint8Array | Buffer;
      }>>;
    }).$queryRawUnsafe(
      `SELECT ${selectCols} FROM "uploaded_files" WHERE "url" = $1 OR "url" = $2 LIMIT 1`,
      canonicalUrl,
      legacyUrl
    )) as Array<{
      originalName: string;
      mimeType: string;
      size: number;
      data?: Uint8Array | Buffer;
    }>;
    return rows?.[0] ?? null;
  } catch (err) {
    console.warn("[storage] failed reading uploaded_files row:", err);
    return null;
  }
}

/**
 * Reads an uploaded file from local disk, in-memory cache, or PostgreSQL `uploaded_files`.
 * When `skipBufferIfOnDisk` is true and the file exists on disk, `buffer` is omitted so
 * callers can stream/range-read directly from `filePath`.
 */
export async function readUploadedFile(
  urlOrPath: string,
  options?: { skipBufferIfOnDisk?: boolean }
): Promise<StoredUpload | null> {
  const segments = parseUploadSegments(urlOrPath);
  if (!segments) return null;

  const canonicalUrl = `${PUBLIC_PREFIX}/${segments.join("/")}`;
  const legacyUrl = `/uploads/${segments.join("/")}`;
  const fallbackName = segments[segments.length - 1] || "file";
  const cache = getMemoryCache();
  const cached = cache.get(canonicalUrl) || cache.get(legacyUrl);

  const diskPath = await resolveUploadFilePath(canonicalUrl);
  if (diskPath) {
    try {
      const stat = await fs.stat(diskPath);
      if (stat.size > 0 || (cached && cached.size === 0)) {
        let originalName: string | null = cached?.originalName ?? null;
        let mimeType = cached?.mimeType ?? getMimeTypeForFilename(diskPath);

        if (!originalName && isRealDatabase()) {
          const meta = await queryDbUploadRow(canonicalUrl, legacyUrl, false);
          if (meta) {
            originalName = meta.originalName || null;
            if (meta.mimeType) mimeType = meta.mimeType;
          }
        }

        const buffer = options?.skipBufferIfOnDisk ? null : await fs.readFile(diskPath);
        return {
          url: canonicalUrl,
          filePath: diskPath,
          buffer,
          mimeType,
          originalName,
          size: stat.size,
        };
      }
    } catch {
      // Fall through to memory/DB lookup
    }
  }

  if (cached) {
    return {
      url: canonicalUrl,
      filePath: null,
      buffer: cached.buffer,
      mimeType: cached.mimeType,
      originalName: cached.originalName,
      size: cached.size,
    };
  }

  const dbRow = await queryDbUploadRow(canonicalUrl, legacyUrl, true);
  if (dbRow && dbRow.data) {
    const buffer = Buffer.isBuffer(dbRow.data)
      ? dbRow.data
      : Buffer.from(dbRow.data);
    const mimeType = dbRow.mimeType || getMimeTypeForFilename(dbRow.originalName || fallbackName);
    const originalName = dbRow.originalName || null;

    setMemoryCache(canonicalUrl, {
      buffer,
      mimeType,
      originalName: originalName || fallbackName,
      size: buffer.length,
    });

    // Warm local disk cache asynchronously/best-effort
    try {
      const diskTarget = path.resolve(UPLOAD_DIR, ...segments);
      if (diskTarget.startsWith(UPLOAD_DIR + path.sep)) {
        await fs.mkdir(path.dirname(diskTarget), { recursive: true });
        await fs.writeFile(diskTarget, buffer);
      }
    } catch {
      // Non-fatal if container filesystem is read-only
    }

    return {
      url: canonicalUrl,
      filePath: null,
      buffer,
      mimeType,
      originalName,
      size: buffer.length,
    };
  }

  return null;
}

export async function saveUploadedFile(
  file: File,
  subDir: string = ""
): Promise<{ url: string; size: number; ext: string; originalName: string; mimeType: string }> {
  const safeSubDir = subDir.replace(/^\/+|\/+$/g, "");
  const originalName = path.basename(file.name || "file").replace(/[\r\n\0]+/g, "").trim() || "file";
  const ext = path.extname(originalName) || "";
  const safeExt = ext.toLowerCase().replace(/[^a-z0-9.]/g, "");
  const name = `${Date.now()}-${crypto.randomBytes(6).toString("hex")}${safeExt}`;
  const url = `${PUBLIC_PREFIX}${safeSubDir ? "/" + safeSubDir : ""}/${name}`;
  const mimeType = getMimeTypeForFilename(originalName, file.type);

  const buffer = Buffer.from(await file.arrayBuffer());
  let wroteDisk = false;

  try {
    await ensureUploadDir();
    const targetDir = safeSubDir ? path.join(UPLOAD_DIR, safeSubDir) : UPLOAD_DIR;
    await fs.mkdir(targetDir, { recursive: true });
    const filePath = path.join(targetDir, name);
    await fs.writeFile(filePath, buffer);
    wroteDisk = true;
  } catch (diskErr) {
    console.warn("[storage] disk write warning:", diskErr);
  }

  setMemoryCache(url, {
    buffer,
    mimeType,
    originalName,
    size: buffer.length,
  });

  if (await ensureUploadTable()) {
    try {
      await (db as unknown as {
        $executeRawUnsafe: (sql: string, ...values: unknown[]) => Promise<unknown>;
      }).$executeRawUnsafe(
        `INSERT INTO "uploaded_files" ("url", "originalName", "mimeType", "size", "data")
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT ("url") DO UPDATE SET
           "originalName" = EXCLUDED."originalName",
           "mimeType" = EXCLUDED."mimeType",
           "size" = EXCLUDED."size",
           "data" = EXCLUDED."data",
           "createdAt" = NOW()`,
        url,
        originalName,
        mimeType,
        buffer.length,
        buffer
      );
    } catch (dbErr) {
      console.error("[storage] failed to persist file to PostgreSQL:", dbErr);
      if (!wroteDisk) {
        throw dbErr;
      }
    }
  }

  return { url, size: buffer.length, ext: safeExt, originalName, mimeType };
}

export const ALLOWED_VIDEO_EXT = [".mp4", ".webm", ".mov", ".mkv"];
export const ALLOWED_DOC_EXT = [".pdf", ".doc", ".docx", ".ppt", ".pptx", ".txt"];
export const ALLOWED_IMAGE_EXT = [".jpg", ".jpeg", ".png", ".webp", ".gif", ".svg"];

export function validateExt(ext: string, allowed: string[]): boolean {
  return allowed.includes(ext.toLowerCase());
}

export function bytesToMB(bytes: number): number {
  return bytes / (1024 * 1024);
}

