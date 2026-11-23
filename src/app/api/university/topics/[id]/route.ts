import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  requireAssignedInstructorCourseAccess,
  handleAuthError,
  errorResponse,
} from "@/lib/auth";

/**
 * PUT /api/university/topics/[id]
 * Update a topic — verifies the topic's course belongs to the university.
 */
export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await req.json();
    const { title, description, displayOrder } = body as {
      title?: string;
      description?: string | null;
      displayOrder?: number;
    };

    const existing = await db.topic.findUnique({
      where: { id },
      include: { course: { select: { id: true } } },
    });
    if (!existing) {
      return errorResponse("Not found", 404);
    }
    await requireAssignedInstructorCourseAccess(existing.course.id);

    await db.topic.update({
      where: { id },
      data: {
        ...(title !== undefined ? { title: title.trim() } : {}),
        ...(description !== undefined
          ? { description: description?.trim() || null }
          : {}),
        ...(displayOrder !== undefined ? { displayOrder } : {}),
      },
    });

    return NextResponse.json({ ok: true });
  } catch (e) {
    const authErr = await handleAuthError(e);
    if (authErr) return authErr;
    console.error("[university/topics PUT]", e);
    return errorResponse("Failed to update topic", 500);
  }
}

/**
 * DELETE /api/university/topics/[id]
 */
export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const existing = await db.topic.findUnique({
      where: { id },
      include: { course: { select: { id: true } } },
    });
    if (!existing) {
      return errorResponse("Not found", 404);
    }
    await requireAssignedInstructorCourseAccess(existing.course.id);

    await db.topic.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (e) {
    const authErr = await handleAuthError(e);
    if (authErr) return authErr;
    console.error("[university/topics DELETE]", e);
    return errorResponse("Failed to delete topic", 500);
  }
}
