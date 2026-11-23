import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin, handleAuthError, errorResponse } from "@/lib/auth";

export async function GET(req: Request) {
  try {
    await requireAdmin();
    const url = new URL(req.url);
    const q = (url.searchParams.get("q") || "").trim().toLowerCase();
    const status = url.searchParams.get("status"); // SUBMITTED | REVIEWED
    const courseId = url.searchParams.get("courseId");
    const assignmentId = url.searchParams.get("assignmentId");

    const submissions = await db.assignmentSubmission.findMany({
      where: {
        ...(status ? { status } : {}),
        ...(assignmentId ? { assignmentId } : {}),
        ...(courseId ? { assignment: { courseId } } : {}),
      },
      orderBy: { submittedAt: "desc" },
      include: {
        student: {
          select: { id: true, name: true, email: true },
        },
        assignment: {
          select: {
            id: true,
            title: true,
            course: { select: { id: true, title: true } },
          },
        },
      },
    });

    // Filter by student name/email/assignment title via q
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
    console.error("[admin/submissions GET]", e);
    return errorResponse("Failed to load submissions", 500);
  }
}
