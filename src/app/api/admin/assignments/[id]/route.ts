import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin, handleAuthError, errorResponse } from "@/lib/auth";
import { saveUploadedFile, validateExt, ALLOWED_DOC_EXT } from "@/lib/storage";

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAdmin();
    const { id } = await params;

    const existing = await db.assignment.findUnique({ where: { id } });
    if (!existing) return errorResponse("Assignment not found", 404);

    const formData = await req.formData();
    const title = (formData.get("title") as string | null)?.trim();
    const description = (formData.get("description") as string | null)?.trim() || null;
    const instructions = (formData.get("instructions") as string | null)?.trim() || null;
    const file = formData.get("file");
    const dueDateStr = (formData.get("dueDate") as string | null)?.trim() || "";
    const isPublishedStr = formData.get("isPublished") as string | null;
    const allowResubmissionStr = formData.get("allowResubmission") as string | null;
    const clearFileStr = formData.get("clearFile") as string | null;

    const data: any = {};
    if (title) data.title = title;
    if (description !== null) data.description = description;
    if (instructions !== null) data.instructions = instructions;

    if (file && file instanceof File && file.size > 0) {
      const ext = "." + (file.name.split(".").pop() || "").toLowerCase();
      if (!validateExt(ext, ALLOWED_DOC_EXT)) {
        return errorResponse(
          `Invalid file extension. Allowed: ${ALLOWED_DOC_EXT.join(", ")}`,
          400
        );
      }
      const saved = await saveUploadedFile(file, "assignments");
      data.fileUrl = saved.url;
    } else if (clearFileStr === "true") {
      data.fileUrl = null;
    }

    if (dueDateStr) {
      const d = new Date(dueDateStr);
      if (!Number.isNaN(d.getTime())) data.dueDate = d;
      else data.dueDate = null;
    } else if (formData.get("dueDate") !== null) {
      // explicitly cleared
      data.dueDate = null;
    }

    if (isPublishedStr !== null) data.isPublished = isPublishedStr !== "false";
    if (allowResubmissionStr !== null) data.allowResubmission = allowResubmissionStr === "true";

    const updated = await db.assignment.update({ where: { id }, data });
    return NextResponse.json({ assignment: updated });
  } catch (e) {
    const authErr = await handleAuthError(e);
    if (authErr) return authErr;
    console.error("[admin/assignments PUT]", e);
    return errorResponse("Failed to update assignment", 500);
  }
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAdmin();
    const { id } = await params;

    const existing = await db.assignment.findUnique({ where: { id } });
    if (!existing) return errorResponse("Assignment not found", 404);

    await db.assignment.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (e) {
    const authErr = await handleAuthError(e);
    if (authErr) return authErr;
    console.error("[admin/assignments DELETE]", e);
    return errorResponse("Failed to delete assignment", 500);
  }
}
