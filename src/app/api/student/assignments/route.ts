import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  requireStudent,
  getStudentSubscription,
  handleAuthError,
} from "@/lib/auth";

export async function GET() {
  try {
    const user = await requireStudent();

    // ─── BATCH: Fetch ALL data in parallel ───
    const [
      subscription,
      assignments,
      allCourses,
      allVideoProgress,
      allVideoQuestions,
      allPassedAssessments,
      allPublishedVideos,
      studentCertificates,
    ] = await Promise.all([
      getStudentSubscription(user.id),
      db.assignment.findMany({
        where: { isPublished: true, course: { isPublished: true } },
        orderBy: { createdAt: "desc" },
        include: {
          course: { select: { id: true, title: true, accessType: true } },
          submissions: {
            where: { studentId: user.id },
            select: {
              id: true, fileUrl: true, submittedAt: true,
              status: true, reviewNotes: true, reviewedAt: true,
            },
            take: 1,
          },
        },
      }),
      // All courses with planAccess for access check
      db.course.findMany({
        where: { isPublished: true },
        select: { id: true, accessType: true, planAccess: { select: { planId: true } } },
      }),
      // ALL video progress
      db.videoProgress.findMany({
        where: { studentId: user.id },
        select: { videoId: true, isCompleted: true },
      }),
      // ALL video questions (distinct videoIds)
      db.videoQuestion.findMany({
        distinct: ["videoId"],
        select: { videoId: true },
      }),
      // ALL passed assessments
      db.videoAssessment.findMany({
        where: { studentId: user.id, passed: true },
        select: { videoId: true },
      }),
      // ALL published videos
      db.videoLesson.findMany({
        where: { isPublished: true },
        select: { id: true, courseId: true },
      }),
      db.certificate.findMany({
        where: { studentId: user.id },
        select: { id: true, courseId: true, certificateNumber: true, issuedAt: true },
      }),
    ]);

    // ─── Build lookup maps ───
    const isSubActive = subscription?.status === "ACTIVE";
    const subPlanId = subscription?.planId;
    const certByCourse = new Map(studentCertificates.map((c) => [c.courseId, c]));

    const progressMap = new Map(allVideoProgress.map((p) => [p.videoId, p]));
    const questionVideoIds = new Set(allVideoQuestions.map((q) => q.videoId));
    const passedSet = new Set(allPassedAssessments.map((a) => a.videoId));
    const videosByCourse = new Map<string, string[]>();
    for (const v of allPublishedVideos) {
      if (!videosByCourse.has(v.courseId)) videosByCourse.set(v.courseId, []);
      videosByCourse.get(v.courseId)!.push(v.id);
    }

    // Access check map
    const accessibleCourseIds = new Set<string>();
    for (const c of allCourses) {
      if (c.accessType === "FREE") accessibleCourseIds.add(c.id);
      else if (isSubActive && subPlanId && c.planAccess.some((pa) => pa.planId === subPlanId))
        accessibleCourseIds.add(c.id);
    }

    // ─── Helper: compute completion inline ───
    function computeStats(courseId: string) {
      const videoIds = videosByCourse.get(courseId) || [];
      const totalVideos = videoIds.length;
      if (totalVideos === 0) return { totalVideos: 0, completedVideos: 0, percent: 100, allCompleted: true };
      let completedVideos = 0;
      for (const vid of videoIds) {
        const p = progressMap.get(vid);
        if (p?.isCompleted === true && (!questionVideoIds.has(vid) || passedSet.has(vid))) {
          completedVideos++;
        }
      }
      return {
        totalVideos,
        completedVideos,
        percent: Math.round((completedVideos / totalVideos) * 100),
        allCompleted: completedVideos === totalVideos,
      };
    }

    // ─── Build result ───
    const result = assignments
      .filter((a) => accessibleCourseIds.has(a.course.id))
      .map((a) => {
        const stats = computeStats(a.course.id);
        const submission = a.submissions[0] || null;
        const hasCourseAccess = a.course.accessType === "FREE" || isSubActive;
        const cert = certByCourse.get(a.course.id) || null;
        const unlocked = hasCourseAccess && stats.allCompleted;
        return {
          id: a.id,
          courseId: a.course.id,
          courseTitle: a.course.title,
          title: a.title,
          description: a.description,
          instructions: a.instructions,
          fileUrl: unlocked ? a.fileUrl : null,
          dueDate: a.dueDate,
          isPublished: a.isPublished,
          allowResubmission: a.allowResubmission,
          submission: submission ? {
            id: submission.id,
            fileUrl: submission.fileUrl,
            submittedAt: submission.submittedAt,
            status: submission.status as "SUBMITTED" | "PASSED" | "FAILED" | "REVIEWED",
            reviewNotes: submission.reviewNotes,
            reviewedAt: submission.reviewedAt,
          } : null,
          certificate: cert ? {
            id: cert.id,
            certificateNumber: cert.certificateNumber,
            issuedAt: cert.issuedAt,
          } : null,
          unlocked: hasCourseAccess && stats.allCompleted,
          lockedReason: !hasCourseAccess ? "Subscription expired" : !stats.allCompleted ? "Complete all lessons first" : null,
          courseCompletion: {
            percent: stats.percent,
            completedVideos: stats.completedVideos,
            totalVideos: stats.totalVideos,
            allCompleted: stats.allCompleted,
          },
        };
      });

    return NextResponse.json({
      assignments: result,
      subscription: subscription
        ? { status: subscription.status, planName: subscription.planName }
        : null,
    });
  } catch (e) {
    const authErr = await handleAuthError(e);
    if (authErr) return authErr;
    console.error("[student/assignments GET]", e);
    return NextResponse.json({ error: "Failed to load assignments" }, { status: 500 });
  }
}
