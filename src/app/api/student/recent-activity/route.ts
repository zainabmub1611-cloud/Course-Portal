import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  requireStudent,
  handleAuthError,
} from "@/lib/auth";

/**
 * GET /api/student/recent-activity
 *
 * Merges a student's recent learning events into a single chronological
 * timeline, limited to 10 entries. Sources:
 *   - VideoProgress completions (isCompleted = true)
 *   - VideoAssessment results
 *   - AssignmentSubmissions
 *   - Certificates (issued)
 *
 * Each item is normalized to:
 *   {
 *     id, type, courseId, courseTitle, title, detail,
 *     timestamp (ISO), score?, passed?, certificateNumber?
 *   }
 *
 * `type` is one of:
 *   - "video_completed"
 *   - "assessment"
 *   - "submission"
 *   - "certificate"
 */
export async function GET() {
  try {
    const user = await requireStudent();

    const [videoProgress, assessments, submissions, certificates] =
      await Promise.all([
        // ─── VideoProgress completions ───
        db.videoProgress.findMany({
          where: { studentId: user.id, isCompleted: true },
          orderBy: { completedAt: "desc" },
          take: 20,
          include: {
            video: {
              select: {
                id: true,
                title: true,
                course: { select: { id: true, title: true } },
              },
            },
          },
        }),
        // ─── VideoAssessment results ───
        db.videoAssessment.findMany({
          where: { studentId: user.id },
          orderBy: { updatedAt: "desc" },
          take: 20,
          include: {
            video: {
              select: {
                id: true,
                title: true,
                course: { select: { id: true, title: true } },
              },
            },
          },
        }),
        // ─── Assignment submissions ───
        db.assignmentSubmission.findMany({
          where: { studentId: user.id },
          orderBy: { submittedAt: "desc" },
          take: 20,
          include: {
            assignment: {
              select: {
                id: true,
                title: true,
                course: { select: { id: true, title: true } },
              },
            },
          },
        }),
        // ─── Certificates ───
        db.certificate.findMany({
          where: { studentId: user.id },
          orderBy: { issuedAt: "desc" },
          take: 20,
          include: { course: { select: { id: true, title: true } } },
        }),
      ]);

    const vpVideoIds = Array.from(
      new Set(videoProgress.map((p) => p.video?.id).filter((id): id is string => Boolean(id)))
    );
    const [questionVideos, passedAssessments] =
      vpVideoIds.length > 0
        ? await Promise.all([
            db.videoQuestion.findMany({
              where: { videoId: { in: vpVideoIds } },
              distinct: ["videoId"],
              select: { videoId: true },
            }),
            db.videoAssessment.findMany({
              where: { studentId: user.id, videoId: { in: vpVideoIds }, passed: true },
              select: { videoId: true },
            }),
          ])
        : [[], []];

    const questionVideoIdSet = new Set(questionVideos.map((q) => q.videoId));
    const passedAssessmentVideoIdSet = new Set(passedAssessments.map((a) => a.videoId));

    type ActivityItem = {
      id: string;
      type: "video_completed" | "assessment" | "submission" | "certificate";
      courseId: string;
      courseTitle: string;
      title: string;
      detail: string;
      timestamp: string;
      score?: number;
      passed?: boolean;
      certificateNumber?: string;
    };

    const items: ActivityItem[] = [];

    for (const p of videoProgress) {
      if (!p.video?.course) continue;
      if (
        questionVideoIdSet.has(p.video.id) &&
        !passedAssessmentVideoIdSet.has(p.video.id)
      ) {
        continue;
      }
      items.push({
        id: `vp-${p.id}`,
        type: "video_completed",
        courseId: p.video.course.id,
        courseTitle: p.video.course.title,
        title: p.video.title,
        detail: "Completed a video lesson",
        timestamp: (p.completedAt ?? p.updatedAt).toISOString(),
      });
    }

    for (const a of assessments) {
      if (!a.video?.course) continue;
      items.push({
        id: `va-${a.id}`,
        type: "assessment",
        courseId: a.video.course.id,
        courseTitle: a.video.course.title,
        title: a.video.title,
        detail: a.passed ? "Passed video assessment" : "Failed video assessment",
        timestamp: (a.updatedAt ?? a.createdAt).toISOString(),
        score: a.score,
        passed: a.passed,
      });
    }

    for (const s of submissions) {
      if (!s.assignment?.course) continue;
      items.push({
        id: `sub-${s.id}`,
        type: "submission",
        courseId: s.assignment.course.id,
        courseTitle: s.assignment.course.title,
        title: s.assignment.title,
        detail:
          s.status === "PASSED" || s.status === "REVIEWED"
            ? "Assignment passed"
            : s.status === "FAILED"
              ? "Assignment needs revision"
              : "Submitted an assignment",
        timestamp: s.submittedAt.toISOString(),
      });
    }

    for (const c of certificates) {
      items.push({
        id: `cert-${c.id}`,
        type: "certificate",
        courseId: c.course.id,
        courseTitle: c.course.title,
        title: c.templateTitle || "Certificate of Completion",
        detail: "Certificate issued",
        timestamp: c.issuedAt.toISOString(),
        certificateNumber: c.certificateNumber,
      });
    }

    // Sort by timestamp desc, take 10
    items.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
    const limited = items.slice(0, 10);

    return NextResponse.json({ activities: limited });
  } catch (e) {
    const authErr = await handleAuthError(e);
    if (authErr) return authErr;
    console.error("[student/recent-activity GET]", e);
    return NextResponse.json(
      { error: "Failed to load recent activity" },
      { status: 500 }
    );
  }
}
