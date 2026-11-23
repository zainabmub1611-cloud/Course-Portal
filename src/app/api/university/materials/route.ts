import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireUniversity, handleAuthError, errorResponse } from "@/lib/auth";

/**
 * GET /api/university/materials
 * List all learning materials across the university's courses.
 */
export async function GET(req: Request) {
  try {
    const user = await requireUniversity();
    const universityId = user.universityId!;
    const url = new URL(req.url);
    const q = (url.searchParams.get("q") || "").trim().toLowerCase();
    const courseId = url.searchParams.get("courseId");
    const type = url.searchParams.get("type");
    const restrictedCourseIds =
      user.role === "INSTRUCTOR" ? user.assignedCourseIds ?? [] : null;

    if (
      restrictedCourseIds &&
      courseId &&
      !restrictedCourseIds.includes(courseId)
    ) {
      return NextResponse.json({ materials: [] });
    }

    const materials = await db.learningMaterial.findMany({
      where: {
        course: { universityId },
        ...(restrictedCourseIds
          ? { courseId: { in: restrictedCourseIds } }
          : courseId
            ? { courseId }
            : {}),
        ...(type ? { type } : {}),
      },
      orderBy: { createdAt: "desc" },
      include: {
        course: { select: { id: true, title: true } },
        topic: { select: { id: true, title: true } },
      },
    });

    let filtered = materials;
    if (q) {
      filtered = materials.filter(
        (m) =>
          m.title.toLowerCase().includes(q) ||
          (m.description || "").toLowerCase().includes(q) ||
          m.course.title.toLowerCase().includes(q)
      );
    }

    return NextResponse.json({
      materials: filtered.map((m) => ({
        id: m.id,
        title: m.title,
        description: m.description,
        type: m.type,
        fileUrl: m.fileUrl,
        isPublished: m.isPublished,
        createdAt: m.createdAt,
        course: m.course,
        topic: m.topic,
      })),
    });
  } catch (e) {
    const authErr = await handleAuthError(e);
    if (authErr) return authErr;
    console.error("[university/materials/all GET]", e);
    return errorResponse("Failed to load materials", 500);
  }
}
