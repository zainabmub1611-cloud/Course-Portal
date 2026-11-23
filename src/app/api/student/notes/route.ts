import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  requireStudent,
  handleAuthError,
  errorResponse,
} from "@/lib/auth";
import { canStudentAccessCourse } from "@/lib/course-utils";

/**
 * GET /api/student/notes?courseId=...
 *   List all notes belonging to the authenticated student. An optional
 *   `courseId` query parameter filters the list to a single course. The
 *   response always includes the parent course/topic/video metadata so the
 *   UI can render a complete card without additional round-trips.
 *
 * NOTE: the Note model stores `courseId`/`topicId`/`videoId` as plain
 * foreign-key columns without Prisma relations (only the User relation is
 * declared), so we hydrate the parent titles with a separate batch query
 * rather than `include`.
 */
export async function GET(req: Request) {
  try {
    const user = await requireStudent();
    const url = new URL(req.url);
    const courseId = url.searchParams.get("courseId");

    // If a courseId filter is supplied we MUST confirm the student can
    // access that course before returning any notes for it — otherwise the
    // endpoint would leak metadata about courses the student has lost
    // access to (e.g. after their subscription expired).
    if (courseId) {
      const access = await canStudentAccessCourse(user.id, courseId);
      if (!access.allowed) {
        return errorResponse(access.reason || "Not allowed", 403, "NO_ACCESS");
      }
    }

    const notes = await db.note.findMany({
      where: { studentId: user.id, ...(courseId ? { courseId } : {}) },
      orderBy: { updatedAt: "desc" },
    });

    // Hydrate parent course/topic/video titles in one batch each.
    const courseIds = Array.from(new Set(notes.map((n) => n.courseId)));
    const topicIds = Array.from(
      new Set(notes.map((n) => n.topicId).filter(Boolean) as string[])
    );
    const videoIds = Array.from(
      new Set(notes.map((n) => n.videoId).filter(Boolean) as string[])
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

    const result = notes
      .filter((n) => courseMap.has(n.courseId))
      .map((n) => ({
        id: n.id,
        courseId: n.courseId,
        topicId: n.topicId,
        videoId: n.videoId,
        videoTimestamp: n.videoTimestamp,
        content: n.content,
        createdAt: n.createdAt,
        updatedAt: n.updatedAt,
        course: { id: n.courseId, title: courseMap.get(n.courseId) ?? "" },
        topic: n.topicId
          ? { id: n.topicId, title: topicMap.get(n.topicId) ?? "" }
          : null,
        video: n.videoId
          ? { id: n.videoId, title: videoMap.get(n.videoId) ?? "" }
          : null,
      }));

    return NextResponse.json({ notes: result });
  } catch (e) {
    const authErr = await handleAuthError(e);
    if (authErr) return authErr;
    console.error("[student/notes GET]", e);
    return errorResponse("Failed to load notes", 500);
  }
}

/**
 * POST /api/student/notes
 *   Create a new note. `courseId` and `content` are required; `topicId`,
 *   `videoId`, and `videoTimestamp` are optional but, when supplied, must
 *   reference resources that actually belong to the named course.
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
      content,
    } = body as {
      courseId?: string;
      topicId?: string | null;
      videoId?: string | null;
      videoTimestamp?: number | null;
      content?: string;
    };

    if (!courseId) return errorResponse("courseId is required", 400);
    if (!content || !content.trim()) {
      return errorResponse("Note content cannot be empty", 400);
    }

    // Access check — student must be able to open the course.
    const access = await canStudentAccessCourse(user.id, courseId);
    if (!access.allowed) {
      return errorResponse(access.reason || "Not allowed", 403, "NO_ACCESS");
    }

    // Validate that topicId / videoId belong to this course, if supplied.
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

    const note = await db.note.create({
      data: {
        studentId: user.id,
        courseId,
        topicId: topicId || null,
        videoId: videoId || null,
        videoTimestamp:
          typeof videoTimestamp === "number" ? videoTimestamp : null,
        content: content.trim(),
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
      note: {
        id: note.id,
        courseId: note.courseId,
        topicId: note.topicId,
        videoId: note.videoId,
        videoTimestamp: note.videoTimestamp,
        content: note.content,
        createdAt: note.createdAt,
        updatedAt: note.updatedAt,
        course: { id: note.courseId, title: course?.title ?? "" },
        topic: note.topicId
          ? { id: note.topicId, title: topic?.title ?? "" }
          : null,
        video: note.videoId
          ? { id: note.videoId, title: video?.title ?? "" }
          : null,
      },
    });
  } catch (e) {
    const authErr = await handleAuthError(e);
    if (authErr) return authErr;
    console.error("[student/notes POST]", e);
    return errorResponse("Failed to create note", 500);
  }
}
