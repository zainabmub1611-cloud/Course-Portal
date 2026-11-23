import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin, handleAuthError, errorResponse } from "@/lib/auth";

export async function GET() {
  try {
    await requireAdmin();

    const [
      totalStudents,
      totalCourses,
      totalFreeCourses,
      totalPaidCourses,
      totalActiveSubscriptions,
      totalExpiredSubscriptions,
      totalAssignments,
      totalSubmittedAssignments,
      totalCertificatesIssued,
      totalVideoLessons,
      pendingReviews,
      recentStudentsRaw,
      recentCoursesRaw,
      recentSubmissionsRaw,
      recentCertificatesRaw,
      coursesRaw,
      studentIdsRaw,
      totalUniversities,
    ] = await Promise.all([
      db.user.count({ where: { role: "STUDENT" } }),
      db.course.count(),
      db.course.count({ where: { accessType: "FREE" } }),
      db.course.count({ where: { accessType: "PAID" } }),
      db.subscription.count({ where: { status: "ACTIVE" } }),
      db.subscription.count({ where: { status: "EXPIRED" } }),
      db.assignment.count(),
      db.assignmentSubmission.count(),
      db.certificate.count(),
      db.videoLesson.count({ where: { isPublished: true } }),
      db.assignmentSubmission.count({ where: { status: "SUBMITTED" } }),
      db.user.findMany({
        where: { role: "STUDENT" },
        orderBy: { createdAt: "desc" },
        take: 5,
        select: { id: true, name: true, email: true, createdAt: true },
      }),
      db.course.findMany({
        orderBy: { createdAt: "desc" },
        take: 5,
        select: { id: true, title: true, createdAt: true, isPublished: true },
      }),
      db.assignmentSubmission.findMany({
        orderBy: { submittedAt: "desc" },
        take: 5,
        include: {
          student: { select: { name: true } },
          assignment: { select: { title: true } },
        },
      }),
      db.certificate.findMany({
        orderBy: { issuedAt: "desc" },
        take: 5,
        include: {
          student: { select: { name: true } },
          course: { select: { title: true } },
        },
      }),
      // For course performance chart: top courses with their video + topic counts
      db.course.findMany({
        orderBy: { createdAt: "desc" },
        take: 8,
        select: {
          id: true,
          title: true,
          _count: {
            select: {
              videos: { where: { isPublished: true } },
              topics: true,
              certificates: true,
            },
          },
        },
      }),
      // Get all student IDs for completion bucket calculation
      db.user.findMany({
        where: { role: "STUDENT" },
        select: { id: true },
      }),
      // Total universities registered on the platform
      db.university.count(),
    ]);

    // Calculate course performance data for the bar chart
    const coursePerformance = coursesRaw.map((c) => ({
      id: c.id,
      title: c.title.length > 20 ? c.title.slice(0, 18) + "…" : c.title,
      lessons: c._count.videos,
      topics: c._count.topics,
      certificates: c._count.certificates,
    }));

    // Calculate student completion buckets
    // For each student, compute their average completion across accessible courses
    const studentCompletionBuckets = {
      notStarted: 0, // 0%
      beginner: 0, // 1-25%
      intermediate: 0, // 26-50%
      advanced: 0, // 51-75%
      completed: 0, // 76-100%
    };

    // Get all completed video progress records grouped by student
    if (studentIdsRaw.length > 0 && totalVideoLessons > 0) {
      const [allProgress, questionVideos, passedAssessments] = await Promise.all([
        db.videoProgress.findMany({
          where: { studentId: { in: studentIdsRaw.map((s) => s.id) } },
          select: { studentId: true, videoId: true, isCompleted: true },
        }),
        db.videoQuestion.findMany({
          distinct: ["videoId"],
          select: { videoId: true },
        }),
        db.videoAssessment.findMany({
          where: { studentId: { in: studentIdsRaw.map((s) => s.id) }, passed: true },
          select: { studentId: true, videoId: true },
        }),
      ]);

      const questionVideoIdSet = new Set(questionVideos.map((q) => q.videoId));
      const passedAssessmentKeys = new Set(
        passedAssessments.map((a) => `${a.studentId}|${a.videoId}`)
      );

      // Count completed videos per student (requires passing video assessment if questions exist)
      const completedByStudent = new Map<string, number>();
      for (const p of allProgress) {
        if (
          p.isCompleted &&
          (!questionVideoIdSet.has(p.videoId) ||
            passedAssessmentKeys.has(`${p.studentId}|${p.videoId}`))
        ) {
          completedByStudent.set(
            p.studentId,
            (completedByStudent.get(p.studentId) || 0) + 1
          );
        }
      }

      // Calculate per-student completion ratio and bucket
      for (const student of studentIdsRaw) {
        const completed = completedByStudent.get(student.id) || 0;
        const ratio = totalVideoLessons > 0 ? completed / totalVideoLessons : 0;
        if (ratio === 0) studentCompletionBuckets.notStarted++;
        else if (ratio <= 0.25) studentCompletionBuckets.beginner++;
        else if (ratio <= 0.5) studentCompletionBuckets.intermediate++;
        else if (ratio <= 0.75) studentCompletionBuckets.advanced++;
        else studentCompletionBuckets.completed++;
      }
    }

    return NextResponse.json({
      // Original fields (unchanged)
      totalStudents,
      totalCourses,
      totalFreeCourses,
      totalPaidCourses,
      totalActiveSubscriptions,
      totalExpiredSubscriptions,
      totalAssignments,
      totalSubmittedAssignments,
      totalCertificatesIssued,
      recentStudents: recentStudentsRaw.map((s) => ({
        id: s.id,
        name: s.name,
        email: s.email,
        createdAt: s.createdAt,
      })),
      recentCourses: recentCoursesRaw.map((c) => ({
        id: c.id,
        title: c.title,
        createdAt: c.createdAt,
        isPublished: c.isPublished,
      })),
      recentSubmissions: recentSubmissionsRaw.map((s) => ({
        id: s.id,
        studentName: s.student.name,
        assignmentTitle: s.assignment.title,
        submittedAt: s.submittedAt,
      })),
      recentCertificates: recentCertificatesRaw.map((c) => ({
        id: c.id,
        studentName: c.student.name,
        courseTitle: c.course.title,
        issuedAt: c.issuedAt,
      })),
      // New fields for the redesigned dashboard
      totalVideoLessons,
      pendingReviews,
      coursePerformance,
      studentCompletionBuckets,
      totalUniversities,
    });
  } catch (e) {
    const authErr = await handleAuthError(e);
    if (authErr) return authErr;
    console.error("[admin/overview]", e);
    return errorResponse("Failed to load overview", 500);
  }
}
