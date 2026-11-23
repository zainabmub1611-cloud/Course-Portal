import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  requireAssignedInstructorCourseAccess,
  handleAuthError,
  errorResponse,
} from "@/lib/auth";
import { saveUploadedFile, validateExt, ALLOWED_DOC_EXT } from "@/lib/storage";

/**
 * PUT /api/university/assignments/[id]
 * Update an assignment — verifies its course belongs to the university.
 */
export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const existing = await db.assignment.findUnique({
      where: { id },
      include: { course: { select: { id: true } } },
    });
    if (!existing) {
      return errorResponse("Not found", 404);
    }
    await requireAssignedInstructorCourseAccess(existing.course.id);

    const formData = await req.formData();
    const title = (formData.get("title") as string | null)?.trim();
    const description =
      (formData.get("description") as string | null)?.trim() || null;
    const instructions =
      (formData.get("instructions") as string | null)?.trim() || null;
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
      data.dueDate = null;
    }

    if (isPublishedStr !== null) data.isPublished = isPublishedStr !== "false";
    if (allowResubmissionStr !== null)
      data.allowResubmission = allowResubmissionStr === "true";

    const updated = await db.assignment.update({ where: { id }, data });
    return NextResponse.json({ assignment: updated });
  } catch (e) {
    const authErr = await handleAuthError(e);
    if (authErr) return authErr;
    console.error("[university/assignments PUT]", e);
    return errorResponse("Failed to update assignment", 500);
  }
}

/**
 * DELETE /api/university/assignments/[id]
 */
export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const existing = await db.assignment.findUnique({
      where: { id },
      include: { course: { select: { id: true } } },
    });
    if (!existing) {
      return errorResponse("Not found", 404);
    }
    await requireAssignedInstructorCourseAccess(existing.course.id);

    await db.assignment.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (e) {
    const authErr = await handleAuthError(e);
    if (authErr) return authErr;
    console.error("[university/assignments DELETE]", e);
    return errorResponse("Failed to delete assignment", 500);
  }
}
