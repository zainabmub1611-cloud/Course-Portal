import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  requireStudent,
  handleAuthError,
  errorResponse,
} from "@/lib/auth";
import { canStudentAccessCourse } from "@/lib/course-utils";

/**
 * GET /api/student/bookmarks?courseId=...
 *   List all bookmarks belonging to the authenticated student, optionally
 *   filtered to a single course. Parent course/topic/video titles are
 *   hydrated in a single batch query each (the Bookmark model exposes only
 *   the `student` relation — `courseId`/`topicId`/`videoId` are plain FKs).
 */
export async function GET(req: Request) {
  try {
    const user = await requireStudent();
    const url = new URL(req.url);
    const courseId = url.searchParams.get("courseId");

    if (courseId) {
      const access = await canStudentAccessCourse(user.id, courseId);
      if (!access.allowed) {
        return errorResponse(access.reason || "Not allowed", 403, "NO_ACCESS");
      }
    }

    const bookmarks = await db.bookmark.findMany({
      where: { studentId: user.id, ...(courseId ? { courseId } : {}) },
      orderBy: { createdAt: "desc" },
    });

    const courseIds = Array.from(new Set(bookmarks.map((b) => b.courseId)));
    const topicIds = Array.from(
      new Set(bookmarks.map((b) => b.topicId).filter(Boolean) as string[])
    );
    const videoIds = Array.from(
      new Set(bookmarks.map((b) => b.videoId).filter(Boolean) as string[])
    );

    const [courses, topics, videos] = await Promise.all([
      courseIds.length
        ? db.course.findMany({
            where: { id: { in: courseIds } },
            select: { id: true, title: true },
          })
        : Promise.resolve([]),
      topicIds.length
        ? db.topic.findMany({
            where: { id: { in: topicIds } },
            select: { id: true, title: true },
          })
        : Promise.resolve([]),
      videoIds.length
        ? db.videoLesson.findMany({
            where: { id: { in: videoIds } },
            select: { id: true, title: true },
          })
        : Promise.resolve([]),
    ]);

    const courseMap = new Map<string, string>(
      courses.map((c) => [c.id, c.title] as [string, string])
    );
    const topicMap = new Map<string, string>(
      topics.map((t) => [t.id, t.title] as [string, string])
    );
    const videoMap = new Map<string, string>(
      videos.map((v) => [v.id, v.title] as [string, string])
    );

    const result = bookmarks
      .filter((b) => courseMap.has(b.courseId))
      .map((b) => ({
        id: b.id,
        courseId: b.courseId,
        topicId: b.topicId,
        videoId: b.videoId,
        videoTimestamp: b.videoTimestamp,
        label: b.label,
        createdAt: b.createdAt,
        course: { id: b.courseId, title: courseMap.get(b.courseId) ?? "" },
        topic: b.topicId
          ? { id: b.topicId, title: topicMap.get(b.topicId) ?? "" }
          : null,
        video: b.videoId
          ? { id: b.videoId, title: videoMap.get(b.videoId) ?? "" }
          : null,
      }));

    return NextResponse.json({ bookmarks: result });
  } catch (e) {
    const authErr = await handleAuthError(e);
    if (authErr) return authErr;
    console.error("[student/bookmarks GET]", e);
    return errorResponse("Failed to load bookmarks", 500);
  }
}

/**
 * POST /api/student/bookmarks
 *   Create a new bookmark. `courseId` is required; `topicId`, `videoId`,
 *   `videoTimestamp`, and `label` are optional.
 */
export async function POST(req: Request) {
  try {
    const user = await requireStudent();
    const body = await req.json();
    const {
      courseId,
      topicId,
      videoId,
      videoTimestamp,
      label,
    } = body as {
      courseId?: string;
      topicId?: string | null;
      videoId?: string | null;
      videoTimestamp?: number | null;
      label?: string | null;
    };

    if (!courseId) return errorResponse("courseId is required", 400);

    const access = await canStudentAccessCourse(user.id, courseId);
    if (!access.allowed) {
      return errorResponse(access.reason || "Not allowed", 403, "NO_ACCESS");
    }

    if (topicId) {
      const topic = await db.topic.findUnique({
        where: { id: topicId },
        select: { courseId: true },
      });
      if (!topic || topic.courseId !== courseId) {
        return errorResponse("Topic does not belong to this course", 400);
      }
    }
    if (videoId) {
      const video = await db.videoLesson.findUnique({
        where: { id: videoId },
        select: { courseId: true },
      });
      if (!video || video.courseId !== courseId) {
        return errorResponse("Video does not belong to this course", 400);
      }
    }

    const bookmark = await db.bookmark.create({
      data: {
        studentId: user.id,
        courseId,
        topicId: topicId || null,
        videoId: videoId || null,
        videoTimestamp:
          typeof videoTimestamp === "number" ? videoTimestamp : null,
        label: label?.trim() || null,
      },
    });

    // Hydrate parent titles for the response.
    const [course, topic, video] = await Promise.all([
      db.course.findUnique({
        where: { id: courseId },
        select: { title: true },
      }),
      topicId
        ? db.topic.findUnique({
            where: { id: topicId },
            select: { title: true },
          })
        : Promise.resolve(null),
      videoId
        ? db.videoLesson.findUnique({
            where: { id: videoId },
            select: { title: true },
          })
        : Promise.resolve(null),
    ]);

    return NextResponse.json({
      bookmark: {
        id: bookmark.id,
        courseId: bookmark.courseId,
        topicId: bookmark.topicId,
        videoId: bookmark.videoId,
        videoTimestamp: bookmark.videoTimestamp,
        label: bookmark.label,
        createdAt: bookmark.createdAt,
        course: { id: bookmark.courseId, title: course?.title ?? "" },
        topic: bookmark.topicId
          ? { id: bookmark.topicId, title: topic?.title ?? "" }
          : null,
        video: bookmark.videoId
          ? { id: bookmark.videoId, title: video?.title ?? "" }
          : null,
      },
    });
  } catch (e) {
    const authErr = await handleAuthError(e);
    if (authErr) return authErr;
    console.error("[student/bookmarks POST]", e);
    return errorResponse("Failed to create bookmark", 500);
  }
}
