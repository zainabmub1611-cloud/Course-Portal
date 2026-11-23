import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  requireUniversityCourseAccess,
  requireAssignedInstructorCourseAccess,
  handleAuthError,
  errorResponse,
} from "@/lib/auth";

/**
 * GET /api/university/videos/[videoId]/questions
 * List all questions for a video (university view — includes correctAnswer).
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: videoId } = await params;

    const video = await db.videoLesson.findUnique({
      where: { id: videoId },
      select: { course: { select: { id: true } } },
    });
    if (!video) {
      return errorResponse("Not found", 404);
    }
    await requireUniversityCourseAccess(video.course.id);

    const questions = await db.videoQuestion.findMany({
      where: { videoId },
      orderBy: [{ timestamp: "asc" }, { displayOrder: "asc" }],
    });

    return NextResponse.json({
      questions: questions.map((q) => ({
        id: q.id,
        videoId: q.videoId,
        question: q.question,
        options: safeParseArray(q.options),
        correctAnswer: q.correctAnswer,
        timestamp: q.timestamp,
        displayOrder: q.displayOrder,
      })),
    });
  } catch (e) {
    const authErr = await handleAuthError(e);
    if (authErr) return authErr;
    console.error("[university/questions GET]", e);
    return errorResponse("Failed to load questions", 500);
  }
}

/**
 * POST /api/university/videos/[videoId]/questions
 * Create a new question for a video.
 */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: videoId } = await params;

    const video = await db.videoLesson.findUnique({
      where: { id: videoId },
      select: { course: { select: { id: true } } },
    });
    if (!video) {
      return errorResponse("Not found", 404);
    }
    await requireAssignedInstructorCourseAccess(video.course.id);

    const body = await req.json();
    const { question, options, correctAnswer, timestamp } = body as {
      question?: string;
      options?: string[];
      correctAnswer?: number;
      timestamp?: number;
    };

    if (!question?.trim()) return errorResponse("Question text is required", 400);
    if (!options || !Array.isArray(options) || options.length < 2) {
      return errorResponse("At least 2 options are required", 400);
    }
    if (correctAnswer === undefined || correctAnswer < 0 || correctAnswer >= options.length) {
      return errorResponse("Valid correctAnswer index is required", 400);
    }

    const q = await db.videoQuestion.create({
      data: {
        videoId,
        question: question.trim(),
        options: JSON.stringify(options),
        correctAnswer,
        timestamp: Number(timestamp) || 0,
      },
    });

    return NextResponse.json({
      question: {
        id: q.id,
        videoId: q.videoId,
        question: q.question,
        options: safeParseArray(q.options),
        correctAnswer: q.correctAnswer,
        timestamp: q.timestamp,
      },
    });
  } catch (e) {
    const authErr = await handleAuthError(e);
    if (authErr) return authErr;
    console.error("[university/questions POST]", e);
    return errorResponse("Failed to create question", 500);
  }
}

function safeParseArray(s: string): string[] {
  try {
    const v = JSON.parse(s);
    return Array.isArray(v) ? v.map(String) : [];
  } catch {
    return [];
  }
}
