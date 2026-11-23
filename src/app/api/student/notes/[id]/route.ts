import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  requireStudent,
  handleAuthError,
  errorResponse,
} from "@/lib/auth";

/**
 * Hydrate course/topic/video titles for a single note (no Prisma relations
 * declared on the Note model itself — only `student`).
 */
async function hydrateNote(note: {
  id: string;
  courseId: string;
  topicId: string | null;
  videoId: string | null;
  videoTimestamp: number | null;
  content: string;
  createdAt: Date;
  updatedAt: Date;
}) {
  const [course, topic, video] = await Promise.all([
    db.course.findUnique({
      where: { id: note.courseId },
      select: { title: true },
    }),
    note.topicId
      ? db.topic.findUnique({
          where: { id: note.topicId },
          select: { title: true },
        })
      : Promise.resolve(null),
    note.videoId
      ? db.videoLesson.findUnique({
          where: { id: note.videoId },
          select: { title: true },
        })
      : Promise.resolve(null),
  ]);
  return {
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
  };
}

/**
 * PUT /api/student/notes/[id]
 *   Update the `content` of an existing note. Only the owner may edit.
 */
export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireStudent();
    const { id } = await params;
    const body = await req.json();
    const { content } = body as { content?: string };

    if (!content || !content.trim()) {
      return errorResponse("Note content cannot be empty", 400);
    }

    const existing = await db.note.findUnique({
      where: { id },
      select: { studentId: true },
    });
    if (!existing) return errorResponse("Note not found", 404);
    if (existing.studentId !== user.id) {
      return errorResponse("Not allowed", 403, "NO_ACCESS");
    }

    const updated = await db.note.update({
      where: { id },
      data: { content: content.trim() },
    });

    return NextResponse.json({ note: await hydrateNote(updated) });
  } catch (e) {
    const authErr = await handleAuthError(e);
    if (authErr) return authErr;
    console.error("[student/notes PUT]", e);
    return errorResponse("Failed to update note", 500);
  }
}

/**
 * DELETE /api/student/notes/[id]
 *   Delete a note. Only the owner may delete.
 */
export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireStudent();
    const { id } = await params;

    const existing = await db.note.findUnique({
      where: { id },
      select: { studentId: true },
    });
    if (!existing) return errorResponse("Note not found", 404);
    if (existing.studentId !== user.id) {
      return errorResponse("Not allowed", 403, "NO_ACCESS");
    }

    await db.note.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (e) {
    const authErr = await handleAuthError(e);
    if (authErr) return authErr;
    console.error("[student/notes DELETE]", e);
    return errorResponse("Failed to delete note", 500);
  }
}
