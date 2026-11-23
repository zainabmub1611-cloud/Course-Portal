import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  requireStudent,
  handleAuthError,
  errorResponse,
} from "@/lib/auth";
import { notifyCourseStaff } from "@/lib/notifications";

/**
 * GET /api/student/discussions/[id]/replies
 *   List all replies for a discussion, oldest first. Includes author
 *   name/avatar so the UI can render author chips without a second
 *   round-trip. The student must be able to read the discussion's course,
 *   which is enforced indirectly here by checking the discussion exists
 *   and the user is logged in (the discussions-list endpoint already
 *   filters to accessible courses, and the replies view is only reachable
 *   in the UI from that list). For belt-and-braces we re-check the
 *   student's access via the course's plan access below.
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireStudent();
    const { id } = await params;

    const discussion = await db.discussion.findUnique({
      where: { id },
      select: {
        courseId: true,
        isLocked: true,
        course: {
          select: {
            id: true,
            accessType: true,
            planAccess: { select: { planId: true } },
          },
        },
      },
    });
    if (!discussion) return errorResponse("Discussion not found", 404);

    // Access check — same logic as the discussions list. Done inline so we
    // don't take a circular dependency on canStudentAccessCourse for what
    // is essentially "the student has the plan for this paid course".
    if (discussion.course?.accessType !== "FREE") {
      const sub = await db.subscription.findFirst({
        where: {
          studentId: user.id,
          status: "ACTIVE",
          expiryDate: { gt: new Date() },
        },
        orderBy: { createdAt: "desc" },
        select: { planId: true },
      });
      const allowed = sub
        ? discussion.course?.planAccess.some(
            (pa) => pa.planId === sub.planId
          )
        : false;
      if (!allowed) {
        return errorResponse("Not allowed", 403, "NO_ACCESS");
      }
    }

    const replies = await db.reply.findMany({
      where: { discussionId: id },
      orderBy: { createdAt: "asc" },
      include: {
        author: {
          select: { id: true, name: true, profilePhoto: true },
        },
      },
    });

    const result = replies.map((r) => ({
      id: r.id,
      discussionId: r.discussionId,
      authorId: r.authorId,
      content: r.content,
      isInstructor: r.isInstructor,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
      author: {
        id: r.author.id,
        name: r.author.name,
        profilePhoto: r.author.profilePhoto,
      },
    }));

    return NextResponse.json({
      replies: result,
      isLocked: discussion.isLocked,
    });
  } catch (e) {
    const authErr = await handleAuthError(e);
    if (authErr) return authErr;
    console.error("[student/discussions/replies GET]", e);
    return errorResponse("Failed to load replies", 500);
  }
}

/**
 * POST /api/student/discussions/[id]/replies
 *   Post a reply to a discussion. Students cannot reply to locked threads.
 *   When someone other than the discussion author replies, a notification
 *   is created for the author so they know there's new activity.
 */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireStudent();
    const { id } = await params;
    const body = await req.json();
    const { content } = body as { content?: string };

    if (!content || !content.trim()) {
      return errorResponse("Reply content cannot be empty", 400);
    }

    const discussion = await db.discussion.findUnique({
      where: { id },
      select: {
        id: true,
        courseId: true,
        authorId: true,
        title: true,
        isLocked: true,
        course: {
          select: {
            id: true,
            accessType: true,
            planAccess: { select: { planId: true } },
          },
        },
      },
    });
    if (!discussion) return errorResponse("Discussion not found", 404);
    if (discussion.isLocked) {
      return errorResponse("This discussion is locked", 403, "LOCKED");
    }

    // Access check (same logic as GET above).
    if (discussion.course?.accessType !== "FREE") {
      const sub = await db.subscription.findFirst({
        where: {
          studentId: user.id,
          status: "ACTIVE",
          expiryDate: { gt: new Date() },
        },
        orderBy: { createdAt: "desc" },
        select: { planId: true },
      });
      const allowed = sub
        ? discussion.course?.planAccess.some(
            (pa) => pa.planId === sub.planId
          )
        : false;
      if (!allowed) {
        return errorResponse("Not allowed", 403, "NO_ACCESS");
      }
    }

    const reply = await db.reply.create({
      data: {
        discussionId: id,
        authorId: user.id,
        content: content.trim(),
        isInstructor: false, // students can never post instructor-flagged replies
      },
      include: {
        author: {
          select: { id: true, name: true, profilePhoto: true },
        },
      },
    });

    // Bump the discussion's `updatedAt` so it floats to the top of the list.
    await db.discussion.update({
      where: { id },
      data: { updatedAt: new Date() },
    });

    // Notify the discussion author (if it's not them replying to themself).
    if (discussion.authorId !== user.id) {
      try {
        await db.notification.create({
          data: {
            studentId: discussion.authorId,
            type: "DISCUSSION_REPLY",
            title: "New reply to your post",
            content: `${user.name} replied to "${discussion.title}"`,
            relatedId: discussion.id,
          },
        });
      } catch (notifErr) {
        // Notification failures must never block the reply.
        console.error("[student/discussions/replies POST] notify:", notifErr);
      }
    }

    try {
      await notifyCourseStaff({
        courseId: discussion.courseId,
        excludeUserId: user.id,
        type: "DISCUSSION_REPLY",
        title: "New discussion reply",
        content: `${user.name} replied to "${discussion.title}".`,
        relatedId: discussion.id,
      });
    } catch (notificationError) {
      console.error("[student/discussions/replies POST] staff notification:", notificationError);
    }

    return NextResponse.json({
      reply: {
        id: reply.id,
        discussionId: reply.discussionId,
        authorId: reply.authorId,
        content: reply.content,
        isInstructor: reply.isInstructor,
        createdAt: reply.createdAt,
        updatedAt: reply.updatedAt,
        author: {
          id: reply.author.id,
          name: reply.author.name,
          profilePhoto: reply.author.profilePhoto,
        },
      },
    });
  } catch (e) {
    const authErr = await handleAuthError(e);
    if (authErr) return authErr;
    console.error("[student/discussions/replies POST]", e);
    return errorResponse("Failed to post reply", 500);
  }
}
