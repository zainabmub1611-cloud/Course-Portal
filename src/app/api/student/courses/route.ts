import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  requireStudent,
  getStudentSubscription,
  handleAuthError,
} from "@/lib/auth";

export async function GET(req: Request) {
  try {
    const user = await requireStudent();
    const url = new URL(req.url);
    const levelParam = url.searchParams.get("level")?.toUpperCase().trim();
    const sortParam = url.searchParams.get("sort")?.toLowerCase().trim();
    const validLevels = new Set(["BEGINNER", "INTERMEDIATE", "ADVANCED"]);
    const levelFilter =
      levelParam && validLevels.has(levelParam) ? levelParam : undefined;

    const baseWhere = levelFilter
      ? { isPublished: true, level: levelFilter }
      : { isPublished: true };

    // ─── BATCH: Fetch ALL data in parallel (7 queries at once) ───
    const [
      subscription,
      allCourses,
      universities,
      allVideoProgress,
      allVideoQuestions,
      allPassedAssessments,
      allPublishedVideos,
    ] = await Promise.all([
      getStudentSubscription(user.id),
      db.course.findMany({
        where: baseWhere,
        orderBy: { createdAt: "desc" },
        select: {
          id: true, title: true, description: true, thumbnail: true,
          category: true, accessType: true, level: true, createdAt: true,
          university: { select: { id: true, name: true, logo: true } },
          planAccess: { include: { plan: { select: { id: true, name: true } } } },
        },
      }),
      db.university.findMany({
        orderBy: { name: "asc" },
        select: { id: true, name: true, logo: true },
      }),
      // ALL video progress for this student
      db.videoProgress.findMany({
        where: { studentId: user.id },
        select: { videoId: true, isCompleted: true, updatedAt: true },
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
        select: {
          id: true, courseId: true, title: true, thumbnail: true,
          videoUrl: true, source: true, displayOrder: true,
        },
        orderBy: { displayOrder: "asc" },
      }),
    ]);

    // ─── Build lookup maps (in-memory) ───
    const isSubActive = subscription?.status === "ACTIVE";
    const subPlanId = subscription?.planId;

    const progressMap = new Map(allVideoProgress.map((p) => [p.videoId, p]));
    const questionVideoIds = new Set(allVideoQuestions.map((q) => q.videoId));
    const passedSet = new Set(allPassedAssessments.map((a) => a.videoId));

    const videosByCourse = new Map<string, typeof allPublishedVideos>();
    for (const v of allPublishedVideos) {
      if (!videosByCourse.has(v.courseId)) videosByCourse.set(v.courseId, []);
      videosByCourse.get(v.courseId)!.push(v);
    }

    // Topics count per course (batch query is expensive — approximate from videos)
    // Actually fetch topics in the same batch would be ideal, but we can count
    // distinct topicIds from the videos. For now, use a separate lightweight query.
    // But to keep it fast, let's just fetch topic counts in one query.
    const courseIds = allCourses.map((c) => c.id);
    const topicCounts = await db.topic.groupBy({
      by: ["courseId"],
      where: { courseId: { in: courseIds } },
      _count: { id: true },
    });
    const topicCountMap = new Map(topicCounts.map((t) => [t.courseId, t._count.id]));

    // ─── Helper: compute completion stats inline ───
    function computeStats(courseId: string) {
      const videos = videosByCourse.get(courseId) || [];
      const totalVideos = videos.length;
      if (totalVideos === 0) return { totalVideos: 0, completedVideos: 0, percent: 100, completedTopics: 0 };
      let completedVideos = 0;
      for (const v of videos) {
        const p = progressMap.get(v.id);
        if (p?.isCompleted === true && (!questionVideoIds.has(v.id) || passedSet.has(v.id))) {
          completedVideos++;
        }
      }
      const percent = Math.round((completedVideos / totalVideos) * 100);
      const totalTopics = topicCountMap.get(courseId) || 0;
      const completedTopics = totalVideos > 0 && completedVideos === totalVideos ? totalTopics : 0;
      return { totalVideos, completedVideos, percent, completedTopics };
    }

    // ─── Build accessible courses list ───
    type AccessibleCourse = {
      id: string; title: string; description: string | null; thumbnail: string | null;
      firstVideoUrl: string | null; firstVideoSource: string | null;
      category: string | null; accessType: "FREE" | "PAID";
      level: "BEGINNER" | "INTERMEDIATE" | "ADVANCED";
      university: { id: string; name: string; logo: string | null } | null;
      topicsCount: number; videosCount: number; completedVideos: number;
      completedTopics: number; percent: number;
      lastWatchedVideoId: string | null; lastWatchedVideoTitle: string | null;
      lastWatchedAt: string | null; createdAt: string; popularity: number;
    };

    const accessibleCourses: AccessibleCourse[] = [];
    for (const c of allCourses) {
      let allowed = false;
      if (c.accessType === "FREE") allowed = true;
      else if (isSubActive && subPlanId)
        allowed = c.planAccess.some((pa) => pa.planId === subPlanId);
      if (!allowed) continue;

      const stats = computeStats(c.id);
      const courseVideos = videosByCourse.get(c.id) || [];
      const firstVideo = courseVideos[0];

      // Last-watched video in this course
      const courseProgress = allVideoProgress
        .filter((p) => courseVideos.some((v) => v.id === p.videoId))
        .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
      const lastProgress = courseProgress[0];
      const lastVideo = lastProgress ? allPublishedVideos.find((v) => v.id === lastProgress.videoId) : null;

      // Popularity: count distinct students with progress in this course
      // (approximate from the video data we have — count distinct videoIds with progress)
      const popularity = courseVideos.filter((v) => progressMap.has(v.id)).length;

      const uni = c.university;
      accessibleCourses.push({
        id: c.id, title: c.title, description: c.description,
        thumbnail: c.thumbnail || firstVideo?.thumbnail || null,
        firstVideoUrl: firstVideo?.videoUrl || null,
        firstVideoSource: firstVideo?.source || null,
        category: c.category,
        accessType: c.accessType as "FREE" | "PAID",
        level: c.level as "BEGINNER" | "INTERMEDIATE" | "ADVANCED",
        university: uni ? { id: uni.id, name: uni.name, logo: uni.logo } : null,
        topicsCount: topicCountMap.get(c.id) || 0,
        videosCount: stats.totalVideos,
        completedVideos: stats.completedVideos,
        completedTopics: stats.completedTopics,
        percent: stats.percent,
        lastWatchedVideoId: lastProgress?.videoId ?? null,
        lastWatchedVideoTitle: lastVideo?.title ?? null,
        lastWatchedAt: lastProgress?.updatedAt?.toISOString() ?? null,
        createdAt: c.createdAt.toISOString(),
        popularity,
      });
    }

    // Apply sort
    let sortedCourses = accessibleCourses;
    if (sortParam === "popular") {
      sortedCourses = [...accessibleCourses].sort((a, b) => (b.popularity ?? 0) - (a.popularity ?? 0));
    } else if (sortParam === "alphabetical" || sortParam === "alpha") {
      sortedCourses = [...accessibleCourses].sort((a, b) =>
        a.title.localeCompare(b.title, undefined, { sensitivity: "base" })
      );
    }

    return NextResponse.json({
      courses: sortedCourses,
      subscription,
      expired: !isSubActive && subscription !== null,
      universities: universities.map((u) => ({ id: u.id, name: u.name, logo: u.logo })),
    });
  } catch (e) {
    const authErr = await handleAuthError(e);
    if (authErr) return authErr;
    console.error("[student/courses GET]", e);
    return NextResponse.json({ error: "Failed to load courses" }, { status: 500 });
  }
}
