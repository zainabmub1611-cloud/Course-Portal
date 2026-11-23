import { db } from "@/lib/db";
import { readUploadedFile } from "@/lib/storage";

export const DEFAULT_APP_NAME = "CourseLearn";

export interface PlatformBranding {
  appName: string;
  logoUrl: string | null;
}

/**
 * Fetch platform-wide app name & logo settings (with safe fallback).
 */
export async function getPlatformSettings(): Promise<PlatformBranding> {
  try {
    const row = await db.platformSettings.findUnique({
      where: { id: "default" },
      select: { appName: true, logoUrl: true },
    });
    const appName = row?.appName?.trim() || DEFAULT_APP_NAME;
    const logoUrl = row?.logoUrl || null;
    return { appName, logoUrl };
  } catch {
    return { appName: DEFAULT_APP_NAME, logoUrl: null };
  }
}

/**
 * Converts a local `/api/uploads/...` or `/uploads/...` asset path into a
 * self-contained base64 data URI so certificate previews and downloaded
 * HTML/PDF files render images offline cleanly.
 */
export async function resolvePublicUploadAsDataUri(
  url: string | null | undefined
): Promise<string | null> {
  if (!url) return null;
  if (url.startsWith("data:") || /^https?:\/\//i.test(url)) {
    return url;
  }

  const stored = await readUploadedFile(url);
  if (!stored?.buffer) {
    return null;
  }

  const mime = stored.mimeType && stored.mimeType !== "application/octet-stream"
    ? stored.mimeType
    : "image/png";
  return `data:${mime};base64,${stored.buffer.toString("base64")}`;
}

