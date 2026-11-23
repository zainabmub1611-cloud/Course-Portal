import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  requireUniversityCourseAccess,
  requireAssignedInstructorCourseAccess,
  handleAuthError,
  errorResponse,
} from "@/lib/auth";
import { saveUploadedFile, validateExt, ALLOWED_DOC_EXT } from "@/lib/storage";

/**
 * GET /api/university/courses/[id]/assignments
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    await requireUniversityCourseAccess(id);

    const assignments = await db.assignment.findMany({
      where: { courseId: id },
      orderBy: { createdAt: "desc" },
      include: { _count: { select: { submissions: true } } },
    });

    return NextResponse.json({
      assignments: assignments.map((a) => ({
        id: a.id,
        title: a.title,
        description: a.description,
        instructions: a.instructions,
        fileUrl: a.fileUrl,
        dueDate: a.dueDate,
        isPublished: a.isPublished,
        allowResubmission: a.allowResubmission,
        createdAt: a.createdAt,
        submissionsCount: a._count.submissions,
      })),
    });
  } catch (e) {
    const authErr = await handleAuthError(e);
    if (authErr) return authErr;
    console.error("[university/assignments GET]", e);
    return errorResponse("Failed to load assignments", 500);
  }
}

/**
 * POST /api/university/courses/[id]/assignments
 */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    await requireAssignedInstructorCourseAccess(id);

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

    if (!title) return errorResponse("Title is required", 400);

    let fileUrl: string | null = null;
    if (file && file instanceof File && file.size > 0) {
      const ext = "." + (file.name.split(".").pop() || "").toLowerCase();
      if (!validateExt(ext, ALLOWED_DOC_EXT)) {
        return errorResponse(
          `Invalid file extension. Allowed: ${ALLOWED_DOC_EXT.join(", ")}`,
          400
        );
      }
      const saved = await saveUploadedFile(file, "assignments");
      fileUrl = saved.url;
    }

    let dueDate: Date | null = null;
    if (dueDateStr) {
      const d = new Date(dueDateStr);
      if (!Number.isNaN(d.getTime())) dueDate = d;
    }

    const assignment = await db.assignment.create({
      data: {
        courseId: id,
        title,
        description,
        instructions,
        fileUrl,
        dueDate,
        isPublished: isPublishedStr !== "false",
        allowResubmission: allowResubmissionStr === "true",
      },
    });

    return NextResponse.json({ assignment });
  } catch (e) {
    const authErr = await handleAuthError(e);
    if (authErr) return authErr;
    console.error("[university/assignments POST]", e);
    return errorResponse("Failed to create assignment", 500);
  }
}
