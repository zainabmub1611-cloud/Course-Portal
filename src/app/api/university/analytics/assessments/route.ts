import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireUniversity, handleAuthError, errorResponse } from "@/lib/auth";

/**
 * GET /api/university/analytics/assessments
 * Assessment analytics scoped to the logged-in university.
 *
 * Computes from VideoAssessment + VideoQuestion records (only for videos whose
 * course belongs to the university):
 *   - totalAssessments        (number of VideoAssessment records)
 *   - totalAttempts           (sum of `attempts` field)
 *   - avgScore                (average score 0-100)
 *   - passRate, failRate      (percentages of passed vs failed)
 *   - passedCount             (count of passed)
 *   - retakeCount             (sum of attempts beyond the first)
 *   - assessmentDetails: [{
 *       videoId, videoTitle, courseTitle, questionCount,
 *       participants, avgScore, highScore, lowScore, passRate, attempts
 *     }]
 */
export async function GET() {
  try {
    const user = await requireUniversity();
    const universityId = user.universityId!;

    const [assessments, videosWithQuestions] = await Promise.all([
      db.videoAssessment.findMany({
        where: { video: { course: { universityId } } },
        include: {
          video: {
            select: {
              id: true,
              title: true,
              course: { select: { id: true, title: true } },
              questions: { select: { id: true } },
            },
          },
        },
      }),
      db.videoLesson.findMany({
        where: { course: { universityId } },
        select: {
          id: true,
          title: true,
          course: { select: { id: true, title: true } },
          questions: { select: { id: true } },
        },
      }),
    ]);

    const totalAssessments = assessments.length;
    const totalAttempts = assessments.reduce((sum, a) => sum + a.attempts, 0);
    const retakeCount = assessments.reduce(
      (sum, a) => sum + Math.max(0, a.attempts - 1),
      0,
    );
    const avgScore =
      totalAssessments > 0
        ? Math.round(assessments.reduce((s, a) => s + a.score, 0) / totalAssessments)
        : 0;

    const passedCount = assessments.filter((a) => a.passed).length;
    const passRate =
      totalAssessments > 0 ? Math.round((passedCount / totalAssessments) * 100) : 0;
    const failRate = totalAssessments > 0 ? 100 - passRate : 0;

    // Group by video for detail rows.
    const byVideo = new Map<
      string,
      {
        videoId: string;
        videoTitle: string;
        courseTitle: string;
        questionCount: number;
        scores: number[];
        passed: number;
        attempts: number;
        participants: Set<string>;
      }
    >();

    // Pre-seed from every video with questions (so we list assessments that
    // exist even if no student has attempted them yet).
    for (const v of videosWithQuestions) {
      if (v.questions.length === 0) continue;
      byVideo.set(v.id, {
        videoId: v.id,
        videoTitle: v.title,
        courseTitle: v.course.title,
        questionCount: v.questions.length,
        scores: [],
        passed: 0,
        attempts: 0,
        participants: new Set<string>(),
      });
    }

    for (const a of assessments) {
      const v = a.video;
      const existing = byVideo.get(v.id);
      const questionCount = v.questions.length;
      const entry =
        existing ?? {
          videoId: v.id,
          videoTitle: v.title,
          courseTitle: v.course.title,
          questionCount,
          scores: [] as number[],
          passed: 0,
          attempts: 0,
          participants: new Set<string>(),
        };
      entry.scores.push(a.score);
      entry.attempts += a.attempts;
      if (a.passed) entry.passed += 1;
      entry.participants.add(a.studentId);
      if (!existing) byVideo.set(v.id, entry);
    }

    const assessmentDetails = Array.from(byVideo.values())
      .map((e) => {
        const scores = e.scores;
        const avg = scores.length
          ? Math.round(scores.reduce((s, n) => s + n, 0) / scores.length)
          : 0;
        const high = scores.length ? Math.max(...scores) : 0;
        const low = scores.length ? Math.min(...scores) : 0;
        const passRate = scores.length ? Math.round((e.passed / scores.length) * 100) : 0;
        return {
          videoId: e.videoId,
          videoTitle: e.videoTitle,
          courseTitle: e.courseTitle,
          questionCount: e.questionCount,
          participants: e.participants.size,
          avgScore: avg,
          highScore: high,
          lowScore: low,
          passRate,
          attempts: e.attempts,
        };
      })
      .sort((a, b) => b.participants - a.participants);

    return NextResponse.json({
      totalAssessments,
      totalAttempts,
      avgScore,
      passRate,
      failRate,
      passedCount,
      retakeCount,
      assessmentDetails,
    });
  } catch (e) {
    const authErr = await handleAuthError(e);
    if (authErr) return authErr;
    console.error("[university/analytics/assessments]", e);
    return errorResponse("Failed to load assessment analytics", 500);
  }
}
