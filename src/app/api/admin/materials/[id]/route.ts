import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin, handleAuthError, errorResponse } from "@/lib/auth";
import {
  saveUploadedFile,
  validateExt,
  ALLOWED_DOC_EXT,
} from "@/lib/storage";

const MATERIAL_TYPES = ["PDF", "DOC", "PRESENTATION", "LINK"];

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAdmin();
    const { id } = await params;

    const existing = await db.learningMaterial.findUnique({ where: { id } });
    if (!existing) return errorResponse("Material not found", 404);

    const formData = await req.formData();
    const title = (formData.get("title") as string | null)?.trim();
    const description = (formData.get("description") as string | null)?.trim() || null;
    const topicId = (formData.get("topicId") as string | null) || null;
    const type = (formData.get("type") as string | null) || existing.type;
    const fileUrlRaw = (formData.get("fileUrl") as string | null)?.trim() || "";
    const file = formData.get("file");
    const isPublishedStr = formData.get("isPublished") as string | null;

    const data: any = {};
    if (title) data.title = title;
    if (description !== null) data.description = description;
    if (topicId !== null && topicId !== existing.topicId) {
      if (topicId) {
        const topic = await db.topic.findFirst({
          where: { id: topicId, courseId: existing.courseId },
        });
        if (!topic) return errorResponse("Topic not found in this course", 404);
      }
      data.topicId = topicId || null;
    }

    const materialType = MATERIAL_TYPES.includes(type) ? type : existing.type;
    data.type = materialType;

    if (materialType === "LINK") {
      if (fileUrlRaw) data.fileUrl = fileUrlRaw;
    } else {
      if (file && file instanceof File) {
        const ext = "." + (file.name.split(".").pop() || "").toLowerCase();
        if (!validateExt(ext, ALLOWED_DOC_EXT)) {
          return errorResponse(
            `Invalid file extension. Allowed: ${ALLOWED_DOC_EXT.join(", ")}`,
            400
          );
        }
        const saved = await saveUploadedFile(file, "materials");
        data.fileUrl = saved.url;
      } else if (fileUrlRaw) {
        data.fileUrl = fileUrlRaw;
      }
    }

    if (isPublishedStr !== null) {
      data.isPublished = isPublishedStr !== "false";
    }

    const updated = await db.learningMaterial.update({ where: { id }, data });
    return NextResponse.json({ material: updated });
  } catch (e) {
    const authErr = await handleAuthError(e);
    if (authErr) return authErr;
    console.error("[admin/materials PUT]", e);
    return errorResponse("Failed to update material", 500);
  }
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAdmin();
    const { id } = await params;

    const existing = await db.learningMaterial.findUnique({ where: { id } });
    if (!existing) return errorResponse("Material not found", 404);

    await db.learningMaterial.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (e) {
    const authErr = await handleAuthError(e);
    if (authErr) return authErr;
    console.error("[admin/materials DELETE]", e);
    return errorResponse("Failed to delete material", 500);
  }
}
