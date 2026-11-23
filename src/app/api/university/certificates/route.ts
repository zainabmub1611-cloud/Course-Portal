import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireUniversity, handleAuthError, errorResponse } from "@/lib/auth";

/**
 * GET /api/university/certificates
 * List all issued certificates for the university's courses.
 */
export async function GET(req: Request) {
  try {
    const user = await requireUniversity();
    const universityId = user.universityId!;
    const url = new URL(req.url);
    const q = (url.searchParams.get("q") || "").trim().toLowerCase();
    const courseId = url.searchParams.get("courseId");
    const assignedCourseIds =
      user.role === "INSTRUCTOR" ? user.assignedCourseIds ?? [] : null;

    if (
      courseId &&
      assignedCourseIds &&
      !assignedCourseIds.includes(courseId)
    ) {
      return NextResponse.json({ certificates: [] });
    }

    const certificates = await db.certificate.findMany({
      where: {
        course: { universityId },
        ...(courseId
          ? { courseId }
          : assignedCourseIds
            ? { courseId: { in: assignedCourseIds } }
            : {}),
      },
      orderBy: { issuedAt: "desc" },
      include: {
        student: { select: { id: true, name: true, email: true } },
        course: { select: { id: true, title: true } },
      },
    });

    let filtered = certificates;
    if (q) {
      filtered = certificates.filter(
        (c) =>
          c.student.name.toLowerCase().includes(q) ||
          c.student.email.toLowerCase().includes(q) ||
          c.course.title.toLowerCase().includes(q) ||
          c.certificateNumber.toLowerCase().includes(q) ||
          c.templateTitle.toLowerCase().includes(q)
      );
    }

    return NextResponse.json({
      certificates: filtered.map((c) => ({
        id: c.id,
        studentId: c.studentId,
        courseId: c.courseId,
        studentName: c.student.name,
        studentEmail: c.student.email,
        courseTitle: c.course.title,
        templateTitle: c.templateTitle,
        templateText: c.templateText,
        organizationName: c.organizationName,
        certificateNumber: c.certificateNumber,
        issuedAt: c.issuedAt,
      })),
    });
  } catch (e) {
    const authErr = await handleAuthError(e);
    if (authErr) return authErr;
    console.error("[university/certificates GET]", e);
    return errorResponse("Failed to load certificates", 500);
  }
}
