import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  requireAssignedInstructorCourseAccess,
  handleAuthError,
  errorResponse,
} from "@/lib/auth";

/**
 * PUT /api/university/questions/[id]
 * Update a question (text, options, correctAnswer, timestamp).
 */
export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const existing = await db.videoQuestion.findUnique({
      where: { id },
      include: { video: { select: { course: { select: { id: true } } } } },
    });
    if (!existing) {
      return errorResponse("Not found", 404);
    }
    await requireAssignedInstructorCourseAccess(existing.video.course.id);

    const body = await req.json();
    const { question, options, correctAnswer, timestamp } = body as {
      question?: string;
      options?: string[];
      correctAnswer?: number;
      timestamp?: number;
    };

    if (question !== undefined && !question.trim()) {
      return errorResponse("Question text cannot be empty", 400);
    }
    if (options !== undefined && (!Array.isArray(options) || options.length < 2)) {
      return errorResponse("At least 2 options are required", 400);
    }
    if (correctAnswer !== undefined && options !== undefined) {
      if (correctAnswer < 0 || correctAnswer >= options.length) {
        return errorResponse("Invalid correctAnswer index", 400);
      }
    }

    const updated = await db.videoQuestion.update({
      where: { id },
      data: {
        ...(question !== undefined && { question: question.trim() }),
        ...(options !== undefined && { options: JSON.stringify(options) }),
        ...(correctAnswer !== undefined && { correctAnswer }),
        ...(timestamp !== undefined && { timestamp: Number(timestamp) }),
      },
    });

    return NextResponse.json({
      question: {
        id: updated.id,
        videoId: updated.videoId,
        question: updated.question,
        options: JSON.parse(updated.options),
        correctAnswer: updated.correctAnswer,
        timestamp: updated.timestamp,
      },
    });
  } catch (e) {
    const authErr = await handleAuthError(e);
    if (authErr) return authErr;
    console.error("[university/questions PUT]", e);
    return errorResponse("Failed to update question", 500);
  }
}

/**
 * DELETE /api/university/questions/[id]
 */
export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const existing = await db.videoQuestion.findUnique({
      where: { id },
      include: { video: { select: { course: { select: { id: true } } } } },
    });
    if (!existing) {
      return errorResponse("Not found", 404);
    }
    await requireAssignedInstructorCourseAccess(existing.video.course.id);

    await db.videoQuestion.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (e) {
    const authErr = await handleAuthError(e);
    if (authErr) return authErr;
    console.error("[university/questions DELETE]", e);
    return errorResponse("Failed to delete question", 500);
  }
}
