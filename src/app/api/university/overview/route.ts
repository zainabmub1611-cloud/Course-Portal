import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireUniversity, handleAuthError, errorResponse } from "@/lib/auth";

/**
 * GET /api/university/overview
 * Returns dashboard stats scoped to the logged-in university.
 */
export async function GET() {
  try {
    const user = await requireUniversity();
    const universityId = user.universityId!;

    // Pull all aggregate stats in parallel
    const [
      totalCourses,
      totalPublishedCourses,
      totalVideoLessons,
      pendingReviews,
      totalCertificatesIssued,
      totalAssignments,
      totalSubmittedAssignments,
      recentSubmissionsRaw,
      recentCoursesRaw,
    ] = await Promise.all([
      db.course.count({ where: { universityId } }),
      db.course.count({ where: { universityId, isPublished: true } }),
      db.videoLesson.count({
        where: { course: { universityId }, isPublished: true },
      }),
      db.assignmentSubmission.count({
        where: {
          status: "SUBMITTED",
          assignment: { course: { universityId } },
        },
      }),
      db.certificate.count({ where: { course: { universityId } } }),
      db.assignment.count({ where: { course: { universityId } } }),
      db.assignmentSubmission.count({
        where: { assignment: { course: { universityId } } },
      }),
      db.assignmentSubmission.findMany({
        where: { assignment: { course: { universityId } } },
        orderBy: { submittedAt: "desc" },
        take: 6,
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
      }),
      db.course.findMany({
        where: { universityId },
        orderBy: { createdAt: "desc" },
        take: 5,
        select: {
          id: true,
          title: true,
          createdAt: true,
          isPublished: true,
        },
      }),
    ]);

    // Count distinct students who have any progress in this university's courses
    const distinctStudents = await db.videoProgress.groupBy({
      by: ["studentId"],
      where: { video: { course: { universityId } } },
    });
    const totalStudents = distinctStudents.length;

    return NextResponse.json({
      totalCourses,
      totalPublishedCourses,
      totalVideoLessons,
      pendingReviews,
      totalCertificatesIssued,
      totalAssignments,
      totalSubmittedAssignments,
      totalStudents,
      recentSubmissions: recentSubmissionsRaw.map((s) => ({
        id: s.id,
        studentId: s.student.id,
        studentName: s.student.name,
        studentEmail: s.student.email,
        assignmentId: s.assignment.id,
        assignmentTitle: s.assignment.title,
        courseId: s.assignment.course.id,
        courseTitle: s.assignment.course.title,
        submittedAt: s.submittedAt,
        status: s.status,
      })),
      recentCourses: recentCoursesRaw.map((c) => ({
        id: c.id,
        title: c.title,
        createdAt: c.createdAt,
        isPublished: c.isPublished,
      })),
    });
  } catch (e) {
    const authErr = await handleAuthError(e);
    if (authErr) return authErr;
    console.error("[university/overview]", e);
    return errorResponse("Failed to load overview", 500);
  }
}
