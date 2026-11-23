import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireUniversity, handleAuthError, errorResponse } from "@/lib/auth";

/**
 * GET /api/university/submissions
 * List all assignment submissions for the university's courses.
 */
export async function GET(req: Request) {
  try {
    const user = await requireUniversity();
    const universityId = user.universityId!;
    const assignedCourseIds =
      user.role === "INSTRUCTOR" ? user.assignedCourseIds ?? [] : null;
    const url = new URL(req.url);
    const q = (url.searchParams.get("q") || "").trim().toLowerCase();
    const status = url.searchParams.get("status"); // SUBMITTED | PASSED | FAILED | REVIEWED
    const courseId = url.searchParams.get("courseId");
    const assignmentId = url.searchParams.get("assignmentId");

    if (courseId && assignedCourseIds && !assignedCourseIds.includes(courseId)) {
      return NextResponse.json({ submissions: [] });
    }

    const submissions = await db.assignmentSubmission.findMany({
      where: {
        assignment: {
          course: {
            universityId,
            ...(assignedCourseIds ? { id: { in: assignedCourseIds } } : {}),
          },
          ...(courseId ? { courseId } : {}),
        },
        ...(status ? { status } : {}),
        ...(assignmentId ? { assignmentId } : {}),
      },
      orderBy: { submittedAt: "desc" },
      include: {
        student: { select: { id: true, name: true, email: true } },
        assignment: {
          select: {
            id: true,
            title: true,
            course: { select: { id: true, title: true } },
          },
        },
      },
    });

    let filtered = submissions;
    if (q) {
      filtered = submissions.filter(
        (s) =>
          s.student.name.toLowerCase().includes(q) ||
          s.student.email.toLowerCase().includes(q) ||
          s.assignment.title.toLowerCase().includes(q) ||
          s.assignment.course.title.toLowerCase().includes(q)
      );
    }

    return NextResponse.json({
      submissions: filtered.map((s) => ({
        id: s.id,
        studentId: s.student.id,
        studentName: s.student.name,
        studentEmail: s.student.email,
        assignmentId: s.assignment.id,
        assignmentTitle: s.assignment.title,
        courseId: s.assignment.course.id,
        courseTitle: s.assignment.course.title,
        fileUrl: s.fileUrl,
        submittedAt: s.submittedAt,
        status: s.status,
        reviewNotes: s.reviewNotes,
        reviewedAt: s.reviewedAt,
      })),
    });
  } catch (e) {
    const authErr = await handleAuthError(e);
    if (authErr) return authErr;
    console.error("[university/submissions GET]", e);
    return errorResponse("Failed to load submissions", 500);
  }
}
