import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  requireStudent,
  handleAuthError,
  errorResponse,
} from "@/lib/auth";

/**
 * PUT /api/student/discussions/[id]
 *   Edit the title/content of the authenticated student's own post.
 */
export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireStudent();
    const { id } = await params;
    const body = await req.json();
    const { title, content } = body as {
      title?: string;
      content?: string;
    };

    const existing = await db.discussion.findUnique({
      where: { id },
      select: { authorId: true },
    });
    if (!existing) return errorResponse("Discussion not found", 404);
    if (existing.authorId !== user.id) {
      return errorResponse("Not allowed", 403, "NO_ACCESS");
    }

    const data: { title?: string; content?: string } = {};
    if (typeof title === "string") {
      if (!title.trim()) return errorResponse("Title cannot be empty", 400);
      data.title = title.trim();
    }
    if (typeof content === "string") {
      if (!content.trim()) return errorResponse("Content cannot be empty", 400);
      data.content = content.trim();
    }
    if (Object.keys(data).length === 0) {
      return errorResponse("Nothing to update", 400);
    }

    const updated = await db.discussion.update({
      where: { id },
      data,
      include: {
        author: {
          select: { id: true, name: true, profilePhoto: true },
        },
        course: { select: { id: true, title: true } },
        _count: { select: { replies: true } },
      },
    });

    return NextResponse.json({
      discussion: {
        id: updated.id,
        courseId: updated.courseId,
        authorId: updated.authorId,
        title: updated.title,
        content: updated.content,
        isPinned: updated.isPinned,
        isLocked: updated.isLocked,
        createdAt: updated.createdAt,
        updatedAt: updated.updatedAt,
        author: {
          id: updated.author.id,
          name: updated.author.name,
          profilePhoto: updated.author.profilePhoto,
        },
        course: updated.course
          ? { id: updated.course.id, title: updated.course.title }
          : null,
        replyCount: updated._count.replies,
      },
    });
  } catch (e) {
    const authErr = await handleAuthError(e);
    if (authErr) return authErr;
    console.error("[student/discussions PUT]", e);
    return errorResponse("Failed to update discussion", 500);
  }
}

/**
 * DELETE /api/student/discussions/[id]
 *   Delete the authenticated student's own post (and all its replies,
 *   via the cascading relation declared in the Prisma schema).
 */
export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireStudent();
    const { id } = await params;

    const existing = await db.discussion.findUnique({
      where: { id },
      select: { authorId: true },
    });
    if (!existing) return errorResponse("Discussion not found", 404);
    if (existing.authorId !== user.id) {
      return errorResponse("Not allowed", 403, "NO_ACCESS");
    }

    await db.discussion.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (e) {
    const authErr = await handleAuthError(e);
    if (authErr) return authErr;
    console.error("[student/discussions DELETE]", e);
    return errorResponse("Failed to delete discussion", 500);
  }
}
