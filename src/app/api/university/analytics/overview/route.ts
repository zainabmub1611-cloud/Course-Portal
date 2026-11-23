import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireUniversity, handleAuthError, errorResponse } from "@/lib/auth";

/**
 * GET /api/university/analytics/overview
 * Course-level analytics for the logged-in university.
 *
 * Returns:
 *   - totalPublishedCourses
 *   - totalEnrolledStudents      (distinct studentIds with VideoProgress)
 *   - totalCompletions           (certificates issued for university's courses)
 *   - activeLearners             (students with progress update in last 7 days)
 *   - avgCompletionRate          (avg per (student,course) completion %)
 *   - enrollmentTrend: [{date, count}]   (first-watch day per student)
 *   - coursePerformance: [{id,title,enrolled,completed,inProgress,avgCompletion,createdAt}]
 *
 * All counts are scoped to the university via the `video.course.universityId`
 * / `course.universityId` relation.
 */
export async function GET() {
  try {
    const user = await requireUniversity();
    const universityId = user.universityId!;

    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    const [
      totalPublishedCourses,
      certificates,
      universityCourses,
      allProgress,
    ] = await Promise.all([
      db.course.count({ where: { universityId, isPublished: true } }),
      db.certificate.findMany({
        where: { course: { universityId } },
        select: { id: true, studentId: true, courseId: true, issuedAt: true },
      }),
      db.course.findMany({
        where: { universityId },
        select: {
          id: true,
          title: true,
          isPublished: true,
          createdAt: true,
          videos: { where: { isPublished: true }, select: { id: true } },
        },
      }),
      db.videoProgress.findMany({
        where: { video: { course: { universityId } } },
        select: {
          studentId: true,
          videoId: true,
          isCompleted: true,
          updatedAt: true,
          video: { select: { courseId: true } },
        },
      }),
    ]);

    const totalCompletions = certificates.length;

    // Distinct students
    const studentIds = new Set<string>(allProgress.map((p) => p.studentId));
    const totalEnrolledStudents = studentIds.size;

    // Active learners (any updatedAt in last 7 days)
    const activeLearnerIds = new Set<string>();
    for (const p of allProgress) {
      if (p.updatedAt >= sevenDaysAgo) activeLearnerIds.add(p.studentId);
    }
    const activeLearners = activeLearnerIds.size;

    // Per-course published video counts.
    const courseVideoCount = new Map<string, number>();
    for (const c of universityCourses) courseVideoCount.set(c.id, c.videos.length);

    const allVideoIds = Array.from(new Set(allProgress.map((p) => p.videoId)));
    const [questionVideos, passedAssessments] =
      allVideoIds.length > 0
        ? await Promise.all([
            db.videoQuestion.findMany({
              where: { videoId: { in: allVideoIds } },
              distinct: ["videoId"],
              select: { videoId: true },
            }),
            db.videoAssessment.findMany({
              where: { videoId: { in: allVideoIds }, passed: true },
              select: { studentId: true, videoId: true },
            }),
          ])
        : [[], []];
    const questionVideoIdSet = new Set(questionVideos.map((q) => q.videoId));
    const passedAssessmentKeys = new Set(
      passedAssessments.map((a) => `${a.studentId}|${a.videoId}`)
    );

    // Aggregate per (student,course): completed count + total videos → completion%.
    type PairKey = string; // `${studentId}|${courseId}`
    const pairCompleted = new Map<PairKey, number>();
    const pairTotal = new Map<PairKey, number>();
    const firstWatchByStudent = new Map<string, Date>(); // earliest updatedAt per student
    for (const p of allProgress) {
      const courseId = p.video.courseId;
      const key = `${p.studentId}|${courseId}`;
      const total = courseVideoCount.get(courseId) ?? 0;
      pairTotal.set(key, Math.max(pairTotal.get(key) ?? 0, total));
      if (
        p.isCompleted &&
        (!questionVideoIdSet.has(p.videoId) ||
          passedAssessmentKeys.has(`${p.studentId}|${p.videoId}`))
      ) {
        pairCompleted.set(key, (pairCompleted.get(key) ?? 0) + 1);
      }
      // First watch time
      const prev = firstWatchByStudent.get(p.studentId);
      if (!prev || p.updatedAt < prev) firstWatchByStudent.set(p.studentId, p.updatedAt);
    }

    let sumCompletion = 0;
    let pairCount = 0;
    for (const key of pairTotal.keys()) {
      const total = pairTotal.get(key) ?? 0;
      const completed = pairCompleted.get(key) ?? 0;
      const pct = total > 0 ? (completed / total) * 100 : completed > 0 ? 100 : 0;
      sumCompletion += pct;
      pairCount += 1;
    }
    const avgCompletionRate = pairCount > 0 ? Math.round(sumCompletion / pairCount) : 0;

    // Enrollment trend: bucket first-watch days for the last 30 days.
    const trendMap = new Map<string, number>();
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    for (const date of firstWatchByStudent.values()) {
      if (date < thirtyDaysAgo) continue;
      const day = date.toISOString().slice(0, 10); // YYYY-MM-DD
      trendMap.set(day, (trendMap.get(day) ?? 0) + 1);
    }
    const enrollmentTrend = Array.from(trendMap.entries())
      .map(([date, count]) => ({ date, count }))
      .sort((a, b) => (a.date < b.date ? -1 : 1));

    // Course performance: per course.
    // enrolled: distinct students with progress in this course.
    // completed: students with completionPct === 100.
    // inProgress: enrolled - completed.
    // avgCompletion: average completion% across enrolled students.

    // Seed entries for every course, even those with zero enrollments.
    const coursePairMap = new Map<
      string,
      {
        enrolled: Set<string>;
        completedStudents: Set<string>;
        completionSum: number;
        completionCount: number;
      }
    >();
    for (const c of universityCourses) {
      coursePairMap.set(c.id, {
        enrolled: new Set<string>(),
        completedStudents: new Set<string>(),
        completionSum: 0,
        completionCount: 0,
      });
    }

    // Per (student,course) compute completion% and update aggregates.
    const studentCourseCompletedCount = new Map<string, number>(); // key -> completed videos
    for (const p of allProgress) {
      if (!p.isCompleted) continue;
      const key = `${p.studentId}|${p.video.courseId}`;
      studentCourseCompletedCount.set(key, (studentCourseCompletedCount.get(key) ?? 0) + 1);
    }
    for (const key of pairTotal.keys()) {
      const [studentId, courseId] = key.split("|");
      const total = pairTotal.get(key) ?? 0;
      const completed = studentCourseCompletedCount.get(key) ?? 0;
      const pct = total > 0 ? (completed / total) * 100 : completed > 0 ? 100 : 0;
      const entry = coursePairMap.get(courseId);
      if (!entry) continue;
      entry.enrolled.add(studentId);
      entry.completionSum += pct;
      entry.completionCount += 1;
      if (pct >= 100) entry.completedStudents.add(studentId);
    }

    const coursePerformance = universityCourses
      .map((c) => {
        const entry = coursePairMap.get(c.id)!;
        const enrolled = entry.enrolled.size;
        const completed = entry.completedStudents.size;
        const inProgress = enrolled - completed;
        const avgCompletion =
          entry.completionCount > 0
            ? Math.round(entry.completionSum / entry.completionCount)
            : 0;
        return {
          id: c.id,
          title: c.title,
          enrolled,
          completed,
          inProgress,
          avgCompletion,
          createdAt: c.createdAt,
          isPublished: c.isPublished,
        };
      })
      .sort((a, b) => b.enrolled - a.enrolled);

    return NextResponse.json({
      totalPublishedCourses,
      totalEnrolledStudents,
      totalCompletions,
      activeLearners,
      avgCompletionRate,
      enrollmentTrend,
      coursePerformance,
    });
  } catch (e) {
    const authErr = await handleAuthError(e);
    if (authErr) return authErr;
    console.error("[university/analytics/overview]", e);
    return errorResponse("Failed to load course analytics", 500);
  }
}
