import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin, handleAuthError, errorResponse } from "@/lib/auth";
import {
  DEFAULT_APP_NAME,
  getPlatformSettings,
} from "@/lib/platform-settings";
import {
  saveUploadedFile,
  validateExt,
  ALLOWED_IMAGE_EXT,
} from "@/lib/storage";

export async function GET() {
  try {
    await requireAdmin();
    const settings = await getPlatformSettings();
    return NextResponse.json(settings);
  } catch (e) {
    const authErr = await handleAuthError(e);
    if (authErr) return authErr;
    console.error("[admin/settings GET]", e);
    return errorResponse("Failed to load platform settings", 500);
  }
}

async function handleUpdate(req: Request) {
  try {
    await requireAdmin();

    const contentType = req.headers.get("content-type") || "";
    let appNameRaw: string | undefined;
    let logoFile: File | null = null;
    let removeLogo = false;

    if (contentType.includes("multipart/form-data")) {
      const fd = await req.formData();
      const rawName = fd.get("appName");
      if (typeof rawName === "string") appNameRaw = rawName;
      const file = fd.get("logo");
      if (file && file instanceof File && file.size > 0) {
        logoFile = file;
      }
      removeLogo = fd.get("removeLogo") === "true";
    } else {
      const body = await req.json();
      if (typeof body.appName === "string") appNameRaw = body.appName;
      if (body.removeLogo === true) removeLogo = true;
    }

    const current = await getPlatformSettings();
    let nextAppName = current.appName || DEFAULT_APP_NAME;
    if (appNameRaw !== undefined) {
      const trimmed = appNameRaw.trim();
      if (!trimmed) {
        return errorResponse("App name is required", 400);
      }
      if (trimmed.length > 80) {
        return errorResponse("App name must be 80 characters or fewer", 400);
      }
      nextAppName = trimmed;
    }

    let nextLogoUrl = current.logoUrl;
    if (removeLogo) {
      nextLogoUrl = null;
    }
    if (logoFile) {
      const ext = "." + (logoFile.name.split(".").pop() || "").toLowerCase();
      if (!validateExt(ext, ALLOWED_IMAGE_EXT)) {
        return errorResponse(
          `Invalid image extension. Allowed: ${ALLOWED_IMAGE_EXT.join(", ")}`,
          400
        );
      }
      const saved = await saveUploadedFile(logoFile, "branding");
      nextLogoUrl = saved.url;
    }

    const updated = await db.platformSettings.upsert({
      where: { id: "default" },
      create: {
        id: "default",
        appName: nextAppName,
        logoUrl: nextLogoUrl,
      },
      update: {
        appName: nextAppName,
        logoUrl: nextLogoUrl,
      },
    });

    return NextResponse.json({
      appName: updated.appName,
      logoUrl: updated.logoUrl,
    });
  } catch (e) {
    const authErr = await handleAuthError(e);
    if (authErr) return authErr;
    console.error("[admin/settings UPDATE]", e);
    return errorResponse("Failed to update platform settings", 500);
  }
}

export async function PUT(req: Request) {
  return handleUpdate(req);
}

export async function POST(req: Request) {
  return handleUpdate(req);
}

export async function PATCH(req: Request) {
  return handleUpdate(req);
}
