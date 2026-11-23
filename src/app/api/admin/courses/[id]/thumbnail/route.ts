import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin, handleAuthError, errorResponse } from "@/lib/auth";
import {
  saveUploadedFile,
  validateExt,
  ALLOWED_IMAGE_EXT,
} from "@/lib/storage";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAdmin();
    const { id } = await params;

    const existing = await db.course.findUnique({ where: { id } });
    if (!existing) return errorResponse("Course not found", 404);

    const formData = await req.formData();
    const file = formData.get("file");
    if (!file || !(file instanceof File) || file.size === 0) {
      return errorResponse("No file uploaded", 400);
    }
    const ext = "." + (file.name.split(".").pop() || "").toLowerCase();
    if (!validateExt(ext, ALLOWED_IMAGE_EXT)) {
      return errorResponse(
        `Invalid image extension. Allowed: ${ALLOWED_IMAGE_EXT.join(", ")}`,
        400
      );
    }

    const saved = await saveUploadedFile(file, "thumbnails");
    await db.course.update({
      where: { id },
      data: { thumbnail: saved.url },
    });

    return NextResponse.json({ thumbnail: saved.url });
  } catch (e) {
    const authErr = await handleAuthError(e);
    if (authErr) return authErr;
    console.error("[admin/courses thumbnail]", e);
    return errorResponse("Failed to upload thumbnail", 500);
  }
}
