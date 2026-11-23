import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireStudent, handleAuthError, errorResponse } from "@/lib/auth";
import { canStudentAccessCourse } from "@/lib/course-utils";

/**
 * GET /api/student/videos/[videoId]/questions
 * Returns questions for a video WITHOUT the correctAnswer field.
 * Also returns the student's current assessment result (score, passed, attempts).
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireStudent();
    const { id: videoId } = await params;

    const video = await db.videoLesson.findUnique({
      where: { id: videoId },
      select: { courseId: true, isPublished: true },
    });
    if (!video || !video.isPublished) return errorResponse("Video not found", 404);

    const access = await canStudentAccessCourse(user.id, video.courseId);
    if (!access.allowed) return errorResponse(access.reason || "Not allowed", 403);

    const questions = await db.videoQuestion.findMany({
      where: { videoId },
      orderBy: [{ timestamp: "asc" }, { displayOrder: "asc" }],
    });

    // Get the student's latest assessment result
    const assessment = await db.videoAssessment.findUnique({
      where: { studentId_videoId: { studentId: user.id, videoId } },
      select: { score: true, passed: true, attempts: true },
    });

    return NextResponse.json({
      // NOTE: correctAnswer is intentionally omitted for students
      questions: questions.map((q) => ({
        id: q.id,
        question: q.question,
        options: JSON.parse(q.options),
        timestamp: q.timestamp,
        optionsCount: JSON.parse(q.options).length,
      })),
      assessment: assessment
        ? { score: assessment.score, passed: assessment.passed, attempts: assessment.attempts }
        : null,
    });
  } catch (e) {
    const authErr = await handleAuthError(e);
    if (authErr) return authErr;
    console.error("[student/questions GET]", e);
    return errorResponse("Failed to load questions", 500);
  }
}
