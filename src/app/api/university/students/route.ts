import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireUniversity, handleAuthError, errorResponse } from "@/lib/auth";

/**
 * GET /api/university/students?q=&courseId=
 * Lists all students who have at least one VideoProgress record in a course
 * owned by the logged-in university. Includes name, email, enrolled courses
 * with per-course completion %, overall average completion and a status.
 *
 * Search: ?q= matches student name/email (case-insensitive contains).
 * Filter: ?courseId= restricts to students who have progress in that course
 *         (the course must still belong to the university).
 */
export async function GET(req: NextRequest) {
  try {
    const user = await requireUniversity();
    const universityId = user.universityId!;
    const { searchParams } = new URL(req.url);
    const q = searchParams.get("q")?.trim() || "";
    const courseId = searchParams.get("courseId")?.trim() || "";
    const assignedCourseIds =
      user.role === "INSTRUCTOR" ? user.assignedCourseIds ?? [] : null;

    if (
      courseId &&
      assignedCourseIds &&
      !assignedCourseIds.includes(courseId)
    ) {
      return NextResponse.json({ students: [] });
    }

    const visibleCourseIds = courseId
      ? [courseId]
      : assignedCourseIds;
    const courseFilter = {
      universityId,
      ...(visibleCourseIds ? { id: { in: visibleCourseIds } } : {}),
    };

    // 1) All video progress records scoped to the university (and optional course).
    const progress = await db.videoProgress.findMany({
      where: {
        video: { course: courseFilter },
        student: {
          role: "STUDENT",
          ...(q
            ? {
                OR: [
                  { name: { contains: q } },
                  { email: { contains: q } },
                ],
              }
            : {}),
        },
      },
      include: {
        student: {
          select: {
            id: true,
            name: true,
            email: true,
            profilePhoto: true,
            createdAt: true,
          },
        },
        video: {
          select: {
            id: true,
            isPublished: true,
            course: { select: { id: true, title: true } },
          },
        },
      },
    });

    if (progress.length === 0) {
      return NextResponse.json({ students: [] });
    }

    // 2) Published-video counts per course (university-scoped) so we can compute
    //    completion % = completed videos / total published videos.
    const universityCourses = await db.course.findMany({
      where: {
        universityId,
        ...(visibleCourseIds ? { id: { in: visibleCourseIds } } : {}),
      },
      select: {
        id: true,
        title: true,
        videos: { where: { isPublished: true }, select: { id: true } },
      },
    });

    const courseVideoCount = new Map<string, number>();
    const courseTitleById = new Map<string, string>();
    for (const c of universityCourses) {
      courseVideoCount.set(c.id, c.videos.length);
      courseTitleById.set(c.id, c.title);
    }

    const allVideoIds = Array.from(new Set(progress.map((p) => p.video.id)));
    const allStudentIds = Array.from(new Set(progress.map((p) => p.studentId)));
    const [questionVideos, passedAssessments] =
      allVideoIds.length > 0
        ? await Promise.all([
            db.videoQuestion.findMany({
              where: { videoId: { in: allVideoIds } },
              distinct: ["videoId"],
              select: { videoId: true },
            }),
            db.videoAssessment.findMany({
              where: {
                studentId: { in: allStudentIds },
                videoId: { in: allVideoIds },
                passed: true,
              },
              select: { studentId: true, videoId: true },
            }),
          ])
        : [[], []];

    const questionVideoIdSet = new Set(questionVideos.map((q) => q.videoId));
    const passedAssessmentKeys = new Set(
      passedAssessments.map((a) => `${a.studentId}|${a.videoId}`)
    );

    // 3) Group progress records by student.
    type CourseProgress = {
      courseId: string;
      courseTitle: string;
      completedVideos: number;
      totalVideos: number;
      completionPct: number;
      lastActivity: Date;
    };

    const byStudent = new Map<
      string,
      {
        id: string;
        name: string;
        email: string;
        profilePhoto: string | null;
        createdAt: Date;
        courseMap: Map<string, CourseProgress>;
        anyRecent: boolean; // activity within last 7 days
      }
    >();

    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    for (const p of progress) {
      const existing = byStudent.get(p.studentId);
      const courseIdLocal = p.video.course.id;
      const courseTitleLocal = p.video.course.title;
      const totalVideos = courseVideoCount.get(courseIdLocal) ?? 0;
      const cp: CourseProgress | undefined = existing
        ? existing.courseMap.get(courseIdLocal)
        : undefined;

      const isVideoTrulyCompleted =
        p.isCompleted &&
        p.video.isPublished &&
        (!questionVideoIdSet.has(p.video.id) ||
          passedAssessmentKeys.has(`${p.studentId}|${p.video.id}`));
      const completedDelta = isVideoTrulyCompleted ? 1 : 0;

      if (existing) {
        if (cp) {
          cp.completedVideos += completedDelta;
          if (p.updatedAt > cp.lastActivity) cp.lastActivity = p.updatedAt;
        } else {
          existing.courseMap.set(courseIdLocal, {
            courseId: courseIdLocal,
            courseTitle: courseTitleLocal,
            completedVideos: completedDelta,
            totalVideos,
            completionPct: 0,
            lastActivity: p.updatedAt,
          });
        }
        if (p.updatedAt >= sevenDaysAgo) existing.anyRecent = true;
      } else {
        const courseMap = new Map<string, CourseProgress>();
        courseMap.set(courseIdLocal, {
          courseId: courseIdLocal,
          courseTitle: courseTitleLocal,
          completedVideos: completedDelta,
          totalVideos,
          completionPct: 0,
          lastActivity: p.updatedAt,
        });
        byStudent.set(p.studentId, {
          id: p.student.id,
          name: p.student.name,
          email: p.student.email,
          profilePhoto: p.student.profilePhoto,
          createdAt: p.student.createdAt,
          courseMap,
          anyRecent: p.updatedAt >= sevenDaysAgo,
        });
      }
    }

    // 4) Materialise and compute per-course completion % + overall stats.
    const students = Array.from(byStudent.values()).map((s) => {
      const courses = Array.from(s.courseMap.values()).map((c) => {
        const pct =
          c.totalVideos > 0
            ? Math.round((c.completedVideos / c.totalVideos) * 100)
            : 100; // no videos → considered 100% complete
        return { ...c, completionPct: pct };
      });

      const enrolledCourseCount = courses.length;
      const completedCourseCount = courses.filter((c) => c.completionPct >= 100).length;
      const avgCompletionPct =
        courses.length > 0
          ? Math.round(courses.reduce((sum, c) => sum + c.completionPct, 0) / courses.length)
          : 0;

      const latestActivity = courses.reduce(
        (max, c) => (c.lastActivity > max ? c.lastActivity : max),
        courses[0]?.lastActivity ?? new Date(0),
      );

      // Status: Completed / In Progress / Just Started
      let statusLabel = "Just Started";
      if (avgCompletionPct >= 100) statusLabel = "Completed";
      else if (avgCompletionPct > 0) statusLabel = "In Progress";

      return {
        id: s.id,
        name: s.name,
        email: s.email,
        profilePhoto: s.profilePhoto,
        createdAt: s.createdAt,
        enrolledCourseCount,
        completedCourseCount,
        avgCompletionPct,
        status: statusLabel,
        active: s.anyRecent,
        lastActivity: latestActivity,
        enrolledCourses: courses
          .sort((a, b) => b.completionPct - a.completionPct)
          .map((c) => ({
            id: c.courseId,
            title: c.courseTitle,
            completedVideos: c.completedVideos,
            totalVideos: c.totalVideos,
            completionPct: c.completionPct,
          })),
      };
    });

    // Sort: active first, then by name
    students.sort((a, b) => {
      if (a.active !== b.active) return a.active ? -1 : 1;
      return a.name.localeCompare(b.name);
    });

    return NextResponse.json({ students });
  } catch (e) {
    const authErr = await handleAuthError(e);
    if (authErr) return authErr;
    console.error("[university/students]", e);
    return errorResponse("Failed to load students", 500);
  }
}
