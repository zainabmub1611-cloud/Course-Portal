import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  requireUniversity,
  canInstructorAccessCourse,
  handleAuthError,
  errorResponse,
} from "@/lib/auth";

/**
 * GET /api/university/discussions/[id]
 * Get a single discussion with all replies (for the university to view/reply).
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireUniversity();
    const { id } = await params;

    const discussion = await db.discussion.findUnique({
      where: { id },
      include: {
        author: { select: { id: true, name: true, profilePhoto: true, role: true } },
        course: { select: { id: true, title: true, universityId: true } },
        replies: {
          include: {
            author: { select: { id: true, name: true, profilePhoto: true, role: true } },
          },
          orderBy: { createdAt: "asc" },
        },
      },
    });

    if (!discussion) return errorResponse("Discussion not found", 404);

    // Verify ownership — discussion must belong to a course in this university
    if (
      discussion.course.universityId !== user.universityId ||
      !canInstructorAccessCourse(user, discussion.courseId)
    ) {
      return errorResponse("Not found", 404);
    }

    return NextResponse.json({
      discussion: {
        id: discussion.id,
        courseId: discussion.courseId,
        courseTitle: discussion.course.title,
        authorId: discussion.author.id,
        authorName: discussion.author.name,
        authorPhoto: discussion.author.profilePhoto,
        authorRole: discussion.author.role,
        title: discussion.title,
        content: discussion.content,
        isPinned: discussion.isPinned,
        isLocked: discussion.isLocked,
        createdAt: discussion.createdAt,
        updatedAt: discussion.updatedAt,
        replies: discussion.replies.map((r) => ({
          id: r.id,
          authorId: r.author.id,
          authorName: r.author.name,
          authorPhoto: r.author.profilePhoto,
          authorRole: r.author.role,
          content: r.content,
          isInstructor: r.isInstructor,
          createdAt: r.createdAt,
        })),
      },
    });
  } catch (e) {
    const authErr = await handleAuthError(e);
    if (authErr) return authErr;
    console.error("[university/discussions GET id]", e);
    return errorResponse("Failed to load discussion", 500);
  }
}

/**
 * PUT /api/university/discussions/[id]
 * Moderate a discussion: pin, unpin, lock, unlock.
 * Body: { isPinned?: boolean, isLocked?: boolean }
 */
export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireUniversity();
    const { id } = await params;

    const existing = await db.discussion.findUnique({
      where: { id },
      include: { course: { select: { universityId: true } } },
    });
    if (
      !existing ||
      existing.course.universityId !== user.universityId ||
      !canInstructorAccessCourse(user, existing.courseId)
    ) {
      return errorResponse("Not found", 404);
    }

    const body = await req.json();
    const { isPinned, isLocked } = body as { isPinned?: boolean; isLocked?: boolean };

    const updated = await db.discussion.update({
      where: { id },
      data: {
        ...(isPinned !== undefined && { isPinned }),
        ...(isLocked !== undefined && { isLocked }),
      },
    });

    return NextResponse.json({
      discussion: {
        id: updated.id,
        isPinned: updated.isPinned,
        isLocked: updated.isLocked,
      },
    });
  } catch (e) {
    const authErr = await handleAuthError(e);
    if (authErr) return authErr;
    console.error("[university/discussions PUT]", e);
    return errorResponse("Failed to update discussion", 500);
  }
}

/**
 * DELETE /api/university/discussions/[id]
 * Delete a discussion (moderation).
 */
export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireUniversity();
    const { id } = await params;

    const existing = await db.discussion.findUnique({
      where: { id },
      include: { course: { select: { universityId: true } } },
    });
    if (
      !existing ||
      existing.course.universityId !== user.universityId ||
      !canInstructorAccessCourse(user, existing.courseId)
    ) {
      return errorResponse("Not found", 404);
    }

    await db.discussion.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (e) {
    const authErr = await handleAuthError(e);
    if (authErr) return authErr;
    console.error("[university/discussions DELETE]", e);
    return errorResponse("Failed to delete discussion", 500);
  }
}
