import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  requireStudent,
  handleAuthError,
  errorResponse,
} from "@/lib/auth";
import { canStudentAccessCourse, issueCertificateIfNeeded } from "@/lib/course-utils";

/**
 * Video progress tracking with strict completion rules.
 *
 * Completion is granted ONLY when:
 *   1. duration > 0
 *   2. lastPosition >= duration - 2   (reached near end; 2s tolerance)
 *   3. watchTimeSeconds >= duration * 0.85  (genuinely watched >=85% of video)
 *
 * Client `isCompleted` flag is treated only as a hint — backend re-validates.
 */
export async function POST(req: Request) {
  try {
    const user = await requireStudent();
    const body = await req.json();
    const {
      videoId,
      lastPosition,
      watchTimeSeconds,
      duration,
      isCompleted: clientCompleted,
      forcePosition,
    } = body as {
      videoId?: string;
      lastPosition?: number;
      watchTimeSeconds?: number;
      duration?: number;
      isCompleted?: boolean;
      forcePosition?: boolean;
    };

    if (!videoId) return errorResponse("videoId is required", 400);

    const video = await db.videoLesson.findUnique({
      where: { id: videoId },
      select: { id: true, courseId: true, duration: true, isPublished: true },
    });
    if (!video) return errorResponse("Video not found", 404);
    if (!video.isPublished) return errorResponse("Video unavailable", 403);

    const access = await canStudentAccessCourse(user.id, video.courseId);
    if (!access.allowed) {
      return errorResponse(access.reason || "Not allowed", 403, "NO_ACCESS");
    }

    const lastPos = Math.max(0, Number(lastPosition || 0));
    const watchTime = Math.max(0, Number(watchTimeSeconds || 0));

    const existing = await db.videoProgress.findUnique({
      where: { studentId_videoId: { studentId: user.id, videoId } },
    });

    // Prefer client-reported duration; fallback to previously known duration or video metadata.
    const effectiveDuration =
      Number(duration) > 0
        ? Number(duration)
        : Math.max(Number(existing?.duration || 0), Number(video.duration || 0));

    // Preserve max watch time across multiple sessions
    const mergedWatchTime = Math.max(
      watchTime,
      existing?.watchTimeSeconds || 0
    );
    // Track the exact position where the student stopped (supports backward seeks too),
    // while guarding against accidental 0s payloads before resume seek completes.
    const mergedLastPos =
      lastPos > 0 || forcePosition === true
        ? lastPos
        : existing?.lastPosition || 0;

    // Strict server-side completion check.
    const meetsPosition =
      effectiveDuration > 0 &&
      Math.max(lastPos, existing?.lastPosition || 0) >= effectiveDuration - 2;
    const meetsWatchTime =
      effectiveDuration > 0 && mergedWatchTime >= effectiveDuration * 0.85;
    const isCompleted =
      effectiveDuration > 0 && meetsPosition && meetsWatchTime;

    // Determine completion state and completedAt
    const finalCompleted = isCompleted || existing?.isCompleted === true;
    let completedAt = existing?.completedAt ?? null;
    if (isCompleted && !existing?.isCompleted) {
      completedAt = new Date();
    }

    const progress = await db.videoProgress.upsert({
      where: { studentId_videoId: { studentId: user.id, videoId } },
      create: {
        studentId: user.id,
        videoId,
        lastPosition: mergedLastPos,
        watchTimeSeconds: mergedWatchTime,
        duration: effectiveDuration,
        isCompleted: finalCompleted,
        completedAt,
      },
      update: {
        lastPosition: mergedLastPos,
        watchTimeSeconds: mergedWatchTime,
        duration: effectiveDuration,
        isCompleted: finalCompleted,
        completedAt,
      },
    });

    // ─── Auto-issue certificate when the course is completed ───
    // When a video is marked complete (justCompleted), check if this was the
    // LAST required video. If so, automatically issue a certificate:
    //   - If the course has a certificate template → use it
    //   - If no template exists → auto-generate with defaults (student name,
    //     course name, organization name)
    //   - If a template exists but is disabled → don't issue
    // The function is idempotent (won't create duplicates).
    let certificateIssued = false;
    let certificateId: string | null = null;
    const justCompletedTransition = isCompleted && !existing?.isCompleted;
    if (justCompletedTransition) {
      try {
        const result = await issueCertificateIfNeeded(user.id, video.courseId);
        certificateIssued = result.issued;
        certificateId = result.certificateId;
      } catch (e) {
        // Don't fail the progress save if certificate issuance fails
        console.error("[student/progress] certificate issue error:", e);
      }
    }

    // Mark clientCompleted=false if backend disagrees — important for UX feedback.
    return NextResponse.json({
      progress: {
        lastPosition: progress.lastPosition,
        watchTimeSeconds: progress.watchTimeSeconds,
        duration: progress.duration,
        isCompleted: progress.isCompleted,
        completedAt: progress.completedAt,
        updatedAt: progress.updatedAt ? progress.updatedAt.toISOString() : null,
      },
      // Tell the client whether THIS update triggered a completion transition.
      justCompleted: justCompletedTransition,
      // And whether the client's "isCompleted" hint was rejected.
      rejectedCompletion:
        clientCompleted === true && !isCompleted && !existing?.isCompleted,
      // Certificate auto-issue result
      certificateIssued,
      certificateId,
    });
  } catch (e) {
    const authErr = await handleAuthError(e);
    if (authErr) return authErr;
    console.error("[student/progress POST]", e);
    return errorResponse("Failed to save progress", 500);
  }
}

/**
 * GET /api/student/progress?videoId=... — resume playback position.
 */
export async function GET(req: Request) {
  try {
    const user = await requireStudent();
    const url = new URL(req.url);
    const videoId = url.searchParams.get("videoId");
    if (!videoId) return errorResponse("videoId is required", 400);

    const video = await db.videoLesson.findUnique({
      where: { id: videoId },
      select: { courseId: true, duration: true, isPublished: true },
    });
    if (!video) return errorResponse("Video not found", 404);

    const access = await canStudentAccessCourse(user.id, video.courseId);
    if (!access.allowed)
      return errorResponse(access.reason || "Not allowed", 403, "NO_ACCESS");

    const progress = await db.videoProgress.findUnique({
      where: { studentId_videoId: { studentId: user.id, videoId } },
      select: {
        lastPosition: true,
        watchTimeSeconds: true,
        duration: true,
        isCompleted: true,
        completedAt: true,
      },
    });

    return NextResponse.json({
      progress: progress
        ? progress
        : {
            lastPosition: 0,
            watchTimeSeconds: 0,
            duration: video.duration || 0,
            isCompleted: false,
            completedAt: null,
          },
    });
  } catch (e) {
    const authErr = await handleAuthError(e);
    if (authErr) return authErr;
    console.error("[student/progress GET]", e);
    return errorResponse("Failed to load progress", 500);
  }
}
