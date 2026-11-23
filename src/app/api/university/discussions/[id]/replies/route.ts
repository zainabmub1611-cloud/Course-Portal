import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  requireUniversity,
  canInstructorAccessCourse,
  handleAuthError,
  errorResponse,
} from "@/lib/auth";

/**
 * POST /api/university/discussions/[id]/replies
 * University sub-admin replies to a student's discussion.
 * The reply is marked with isInstructor=true so it shows with an instructor badge.
 */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireUniversity();
    const { id } = await params;

    const discussion = await db.discussion.findUnique({
      where: { id },
      include: {
        course: { select: { id: true, universityId: true, title: true } },
      },
    });
    if (
      !discussion ||
      discussion.course.universityId !== user.universityId ||
      !canInstructorAccessCourse(user, discussion.courseId)
    ) {
      return errorResponse("Discussion not found", 404);
    }

    if (discussion.isLocked) {
      return errorResponse("This discussion is locked", 400);
    }

    const body = await req.json();
    const { content } = body as { content?: string };

    if (!content?.trim()) return errorResponse("Reply content is required", 400);

    const reply = await db.reply.create({
      data: {
        discussionId: id,
        authorId: user.id,
        content: content.trim(),
        isInstructor: true, // Mark as instructor/university response
      },
      include: {
        author: { select: { id: true, name: true, profilePhoto: true, role: true } },
      },
    });

    // Create notification for the discussion author (if not self)
    if (discussion.authorId !== user.id) {
      try {
        await db.notification.create({
        data: {
          studentId: discussion.authorId,
          type: "DISCUSSION_REPLY",
          title: "Instructor replied to your question",
          content: `${user.name} replied to "${discussion.title}" in ${discussion.course.title}`,
          relatedId: discussion.id,
        },
        });
      } catch (notificationError) {
        console.error("[university/discussions replies POST] notification:", notificationError);
      }
    }

    // Bump the discussion's updatedAt
    await db.discussion.update({ where: { id }, data: { updatedAt: new Date() } });

    return NextResponse.json({
      reply: {
        id: reply.id,
        authorId: reply.author.id,
        authorName: reply.author.name,
        authorPhoto: reply.author.profilePhoto,
        authorRole: reply.author.role,
        content: reply.content,
        isInstructor: reply.isInstructor,
        createdAt: reply.createdAt,
      },
    });
  } catch (e) {
    const authErr = await handleAuthError(e);
    if (authErr) return authErr;
    console.error("[university/discussions replies POST]", e);
    return errorResponse("Failed to post reply", 500);
  }
}

/**
 * DELETE /api/university/discussions/[id]/replies?replyId=...
 * Delete a reply (moderation).
 */
export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireUniversity();
    const { id } = await params;
    const url = new URL(req.url);
    const replyId = url.searchParams.get("replyId");

    if (!replyId) return errorResponse("replyId is required", 400);

    const discussion = await db.discussion.findUnique({
      where: { id },
      include: { course: { select: { universityId: true } } },
    });
    if (
      !discussion ||
      discussion.course.universityId !== user.universityId ||
      !canInstructorAccessCourse(user, discussion.courseId)
    ) {
      return errorResponse("Not found", 404);
    }

    await db.reply.delete({ where: { id: replyId, discussionId: id } });
    return NextResponse.json({ ok: true });
  } catch (e) {
    const authErr = await handleAuthError(e);
    if (authErr) return authErr;
    console.error("[university/discussions replies DELETE]", e);
    return errorResponse("Failed to delete reply", 500);
  }
}
