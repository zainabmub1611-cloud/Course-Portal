import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireStudent, handleAuthError, errorResponse } from "@/lib/auth";
import { canStudentAccessCourse, issueCertificateIfNeeded } from "@/lib/course-utils";

const PASS_THRESHOLD = 70;

/**
 * GET /api/student/videos/[videoId]/assessment
 * Returns the student's current assessment result for this video.
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
      select: { courseId: true },
    });
    if (!video) return errorResponse("Video not found", 404);

    const access = await canStudentAccessCourse(user.id, video.courseId);
    if (!access.allowed) return errorResponse(access.reason || "Not allowed", 403);

    const assessment = await db.videoAssessment.findUnique({
      where: { studentId_videoId: { studentId: user.id, videoId } },
    });

    if (!assessment) {
      return NextResponse.json({ assessment: null });
    }

    return NextResponse.json({
      assessment: {
        id: assessment.id,
        score: assessment.score,
        passed: assessment.passed,
        attempts: assessment.attempts,
        answers: JSON.parse(assessment.answers),
      },
    });
  } catch (e) {
    const authErr = await handleAuthError(e);
    if (authErr) return authErr;
    console.error("[student/assessment GET]", e);
    return errorResponse("Failed to load assessment", 500);
  }
}

/**
 * POST /api/student/videos/[videoId]/assessment
 * Submit answers for the video assessment. The server evaluates answers
 * against the correct answers stored in the database (never trusted from
 * the client) and returns the score + pass/fail status.
 *
 * Body: { answers: [{ questionId, selectedAnswer (index) }] }
 */
export async function POST(
  req: Request,
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

    const videoProgress = await db.videoProgress.findUnique({
      where: { studentId_videoId: { studentId: user.id, videoId } },
      select: { isCompleted: true },
    });
    if (!videoProgress?.isCompleted) {
      return errorResponse(
        "Complete watching the video before viewing assessment results",
        403,
        "VIDEO_NOT_COMPLETED"
      );
    }

    const body = await req.json();
    const { answers } = body as { answers?: { questionId: string; selectedAnswer: number }[] };

    if (!answers || !Array.isArray(answers)) {
      return errorResponse("Answers array is required", 400);
    }

    // Fetch all questions for this video (server-side — correct answers never sent to client)
    const questions = await db.videoQuestion.findMany({
      where: { videoId },
      orderBy: [{ timestamp: "asc" }, { displayOrder: "asc" }],
    });

    if (questions.length === 0) {
      return errorResponse("No questions for this video", 400);
    }

    // Evaluate answers
    const evaluated = questions.map((q) => {
      const studentAnswer = answers.find((a) => a.questionId === q.id);
      const selected = studentAnswer?.selectedAnswer ?? -1;
      const correct = selected === q.correctAnswer;
      return {
        questionId: q.id,
        question: q.question,
        options: JSON.parse(q.options),
        selectedAnswer: selected,
        correctAnswer: q.correctAnswer,
        correct,
      };
    });

    const correctCount = evaluated.filter((e) => e.correct).length;
    const score = Math.round((correctCount / questions.length) * 100);
    const passed = score >= PASS_THRESHOLD;

    // Get existing assessment (for attempt count)
    const existing = await db.videoAssessment.findUnique({
      where: { studentId_videoId: { studentId: user.id, videoId } },
    });

    // Upsert assessment — record latest attempt score and pass/fail status
    const assessment = await db.videoAssessment.upsert({
      where: { studentId_videoId: { studentId: user.id, videoId } },
      create: {
        studentId: user.id,
        videoId,
        score,
        passed,
        answers: JSON.stringify(evaluated),
        attempts: 1,
      },
      update: {
        score,
        passed: Boolean(passed),
        answers: JSON.stringify(evaluated),
        attempts: (existing?.attempts ?? 0) + 1,
      },
    });

    let certificateIssued = false;
    let certificateId: string | null = null;
    if (passed) {
      try {
        const certRes = await issueCertificateIfNeeded(user.id, video.courseId);
        certificateIssued = certRes.issued;
        certificateId = certRes.certificateId;
      } catch (err) {
        console.error("[student/assessment] certificate issue error:", err);
      }
    }

    return NextResponse.json({
      assessment: {
        id: assessment.id,
        score,
        passed,
        attempts: assessment.attempts,
        correctCount,
        totalQuestions: questions.length,
        answers: evaluated,
      },
      certificateIssued,
      certificateId,
    });
  } catch (e) {
    const authErr = await handleAuthError(e);
    if (authErr) return authErr;
    console.error("[student/assessment POST]", e);
    return errorResponse("Failed to submit assessment", 500);
  }
}
