import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireUniversity, handleAuthError, errorResponse } from "@/lib/auth";

/**
 * GET /api/university/assignments
 * List all assignments across the university's courses.
 */
export async function GET(req: Request) {
  try {
    const user = await requireUniversity();
    const universityId = user.universityId!;
    const url = new URL(req.url);
    const q = (url.searchParams.get("q") || "").trim().toLowerCase();
    const courseId = url.searchParams.get("courseId");

    const restrictedCourseIds =
      user.role === "INSTRUCTOR" ? user.assignedCourseIds ?? [] : null;

    if (
      courseId &&
      restrictedCourseIds &&
      !restrictedCourseIds.includes(courseId)
    ) {
      return NextResponse.json({ assignments: [] });
    }

    const assignments = await db.assignment.findMany({
      where: {
        course: { universityId },
        ...(courseId
          ? { courseId }
          : restrictedCourseIds
            ? { courseId: { in: restrictedCourseIds } }
            : {}),
      },
      orderBy: { createdAt: "desc" },
      include: {
        course: { select: { id: true, title: true } },
        _count: { select: { submissions: true } },
      },
    });

    let filtered = assignments;
    if (q) {
      filtered = assignments.filter(
        (a) =>
          a.title.toLowerCase().includes(q) ||
          (a.description || "").toLowerCase().includes(q) ||
          a.course.title.toLowerCase().includes(q)
      );
    }

    return NextResponse.json({
      assignments: filtered.map((a) => ({
        id: a.id,
        title: a.title,
        description: a.description,
        instructions: a.instructions,
        fileUrl: a.fileUrl,
        dueDate: a.dueDate,
        isPublished: a.isPublished,
        allowResubmission: a.allowResubmission,
        createdAt: a.createdAt,
        course: a.course,
        submissionsCount: a._count.submissions,
      })),
    });
  } catch (e) {
    const authErr = await handleAuthError(e);
    if (authErr) return authErr;
    console.error("[university/assignments/all GET]", e);
    return errorResponse("Failed to load assignments", 500);
  }
}
