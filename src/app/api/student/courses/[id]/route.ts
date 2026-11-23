import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  requireStudent,
  handleAuthError,
  errorResponse,
} from "@/lib/auth";
import { issueCertificateIfNeeded } from "@/lib/course-utils";
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireStudent();
    const { id } = await params;

    // ─── Fetch course + subscription IN PARALLEL (saves ~2s vs sequential) ───
    // Include planAccess so we can check access inline (avoids canStudentAccessCourse
    // making 3 separate queries that duplicate this data).
    const [course, subscription] = await Promise.all([
      db.course.findUnique({
        where: { id },
        include: {
          topics: {
            orderBy: { displayOrder: "asc" },
            include: {
              videos: {
                where: { isPublished: true },
                orderBy: { displayOrder: "asc" },
              },
              materials: {
                where: { isPublished: true },
                orderBy: { createdAt: "desc" },
              },
            },
          },
          materials: {
            where: { isPublished: true },
            orderBy: { createdAt: "desc" },
            include: { topic: { select: { id: true, title: true } } },
          },
          assignments: {
            where: { isPublished: true },
            orderBy: { createdAt: "asc" },
          },
          certificateTemplate: true,
          planAccess: { select: { planId: true } },
        },
      }),
      db.subscription.findFirst({
        where: { studentId: user.id, status: "ACTIVE", expiryDate: { gt: new Date() } },
        orderBy: { createdAt: "desc" },
        select: { planId: true },
      }),
    ]);

    if (!course) return errorResponse("Course not found", 404);

    // ─── Inline access check (replaces canStudentAccessCourse) ───
    if (course.accessType !== "FREE") {
      if (!subscription) {
        return errorResponse("No active subscription", 403, "NO_ACCESS");
      }
      if (!course.planAccess.some((pa) => pa.planId === subscription.planId)) {
        return errorResponse("Your plan does not include this course", 403, "NO_ACCESS");
      }
    }

    // ─── Fetch all student data IN PARALLEL (4 queries at once vs sequential) ───
    const videoIds = course.topics.flatMap((t) => t.videos.map((v) => v.id));
    const assignmentIds = course.assignments.map((a) => a.id);

    const [progressRows, videoQuestionsCount, assessments, submissions, certificate] = await Promise.all([
      db.videoProgress.findMany({
        where: { studentId: user.id, videoId: { in: videoIds } },
        select: {
          videoId: true,
          lastPosition: true,
          watchTimeSeconds: true,
          duration: true,
          isCompleted: true,
          completedAt: true,
          updatedAt: true,
        },
      }),
      videoIds.length > 0
        ? db.videoQuestion.groupBy({
            by: ["videoId"],
            where: { videoId: { in: videoIds } },
            _count: { id: true },
          })
        : Promise.resolve([] as { videoId: string; _count: { id: number } }[]),
      videoIds.length > 0
        ? db.videoAssessment.findMany({
            where: { studentId: user.id, videoId: { in: videoIds } },
            select: { videoId: true, passed: true, attempts: true, score: true },
          })
        : Promise.resolve([] as { videoId: string; passed: boolean; attempts: number; score: number }[]),
      assignmentIds.length > 0
        ? db.assignmentSubmission.findMany({
            where: { studentId: user.id, assignmentId: { in: assignmentIds } },
            select: {
              id: true,
              assignmentId: true,
              fileUrl: true,
              submittedAt: true,
              status: true,
              reviewNotes: true,
              reviewedAt: true,
            },
          })
        : Promise.resolve([] as { id: string; assignmentId: string; fileUrl: string; submittedAt: Date; status: string; reviewNotes: string | null; reviewedAt: Date | null }[]),
      db.certificate.findUnique({
        where: { studentId_courseId: { studentId: user.id, courseId: id } },
        select: { id: true, certificateNumber: true, issuedAt: true },
      }),
    ]);

    const progressMap = new Map(progressRows.map((p) => [p.videoId, p]));
    const questionCountMap = new Map(videoQuestionsCount.map((q) => [q.videoId, q._count.id]));
    const assessmentMap = new Map(assessments.map((a) => [a.videoId, a]));
    const passedAssessmentSet = new Set(assessments.filter((a) => a.passed).map((a) => a.videoId));
    const submissionByAssignment = new Map(submissions.map((s) => [s.assignmentId, s]));

    // ─── Compute completion stats inline (avoids 5 extra DB queries that
    // getCourseCompletionStats would make — all data is already fetched above) ───
    const allVideos = course.topics.flatMap((t) => t.videos);
    const totalVideos = allVideos.length;
    const completedVideoIds = new Set(
      videoIds.filter((vid) => {
        const p = progressMap.get(vid);
        return p?.isCompleted === true &&
          (!questionCountMap.has(vid) || passedAssessmentSet.has(vid));
      })
    );
    const completedVideos = completedVideoIds.size;
    // Group videos by topic for completedTopics count
    const videosByTopic = new Map<string, Set<string>>();
    for (const t of course.topics) {
      const vSet = new Set<string>();
      for (const v of t.videos) vSet.add(v.id);
      videosByTopic.set(t.id, vSet);
    }
    let completedTopics = 0;
    for (const [, vIds] of videosByTopic) {
      if (vIds.size > 0 && Array.from(vIds).every((id) => completedVideoIds.has(id))) {
        completedTopics++;
      }
    }
    const totalTopics = course.topics.length;
    const percent = totalVideos > 0 ? Math.round((completedVideos / totalVideos) * 100) : 100;
    const allCompleted = completedVideos === totalVideos;

    let resolvedCertificate = certificate;
    if (!resolvedCertificate && allCompleted) {
      try {
        const res = await issueCertificateIfNeeded(user.id, id);
        if (res.certificateId) {
          resolvedCertificate = await db.certificate.findUnique({
            where: { id: res.certificateId },
            select: { id: true, certificateNumber: true, issuedAt: true },
          });
        }
      } catch (err) {
        console.error("[student/courses GET id] reconcile certificate:", err);
      }
    }

    // ─── Assignment gating (all assignments in course) ───
    // Assignment details (title, description, instructions, fileUrl) are ONLY
    // returned when the student has completed ALL required video lessons.
    // Before that, minimal placeholders are returned so the UI can show the
    // locked state without exposing assignment content.
    const mappedAssignments = course.assignments.map((a) => {
      const sub = submissionByAssignment.get(a.id);
      const formattedSubmission = sub
        ? {
            id: sub.id,
            fileUrl: sub.fileUrl,
            submittedAt: sub.submittedAt,
            status: sub.status as "SUBMITTED" | "PASSED" | "FAILED" | "REVIEWED",
            reviewNotes: sub.reviewNotes,
            reviewedAt: sub.reviewedAt,
          }
        : null;

      return allCompleted
        ? {
            id: a.id,
            title: a.title,
            description: a.description,
            instructions: a.instructions,
            fileUrl: a.fileUrl,
            dueDate: a.dueDate,
            isPublished: a.isPublished,
            allowResubmission: a.allowResubmission,
            submission: formattedSubmission,
          }
        : {
            id: a.id,
            title: null,
            description: null,
            instructions: null,
            fileUrl: null,
            dueDate: null,
            isPublished: a.isPublished,
            allowResubmission: a.allowResubmission,
            submission: formattedSubmission,
          };
    });

    const firstAssignment = mappedAssignments[0] ?? null;

    const result = {
      id: course.id,
      title: course.title,
      description: course.description,
      thumbnail: course.thumbnail,
      category: course.category,
      accessType: course.accessType as "FREE" | "PAID",
      topics: course.topics.map((t) => ({
        id: t.id,
        title: t.title,
        description: t.description,
        displayOrder: t.displayOrder,
        videos: t.videos.map((v) => {
          const p = progressMap.get(v.id);
          const qCount = questionCountMap.get(v.id) ?? 0;
          const hasQ = qCount > 0;
          const assess = assessmentMap.get(v.id);
          return {
            id: v.id,
            title: v.title,
            description: v.description,
            source: v.source as "UPLOAD" | "YOUTUBE" | "URL",
            videoUrl: v.videoUrl,
            thumbnail: v.thumbnail,
            displayOrder: v.displayOrder,
            duration: v.duration,
            hasQuestions: hasQ,
            questionCount: qCount,
            assessmentPassed: hasQ ? (assess ? assess.passed : null) : null,
            assessmentAttempted: hasQ ? Boolean(assess && assess.attempts > 0) : false,
            assessmentScore: hasQ && assess ? assess.score : null,
            assessmentAttempts: hasQ && assess ? assess.attempts : 0,
            progress: p
              ? {
                  lastPosition: p.lastPosition,
                  watchTimeSeconds: p.watchTimeSeconds,
                  duration: p.duration,
                  isCompleted: p.isCompleted,
                  completedAt: p.completedAt,
                  updatedAt: p.updatedAt ? p.updatedAt.toISOString() : null,
                }
              : null,
          };
        }),
        materials: t.materials.map((m) => ({
          id: m.id,
          title: m.title,
          description: m.description,
          type: m.type,
          fileUrl: m.fileUrl,
        })),
      })),
      materials: course.materials.map((m) => ({
        id: m.id,
        title: m.title,
        description: m.description,
        type: m.type,
        fileUrl: m.fileUrl,
        topic: m.topic,
      })),
      assignments: mappedAssignments,
      assignment: firstAssignment
        ? {
            id: firstAssignment.id,
            title: firstAssignment.title,
            description: firstAssignment.description,
            instructions: firstAssignment.instructions,
            fileUrl: firstAssignment.fileUrl,
            dueDate: firstAssignment.dueDate,
            isPublished: firstAssignment.isPublished,
            allowResubmission: firstAssignment.allowResubmission,
          }
        : null,
      submission: firstAssignment?.submission ?? null,
      courseCompletion: {
        totalVideos,
        completedVideos,
        completedTopics,
        totalTopics,
        percent,
        allCompleted,
      },
      certificate: resolvedCertificate
        ? {
            id: resolvedCertificate.id,
            certificateNumber: resolvedCertificate.certificateNumber,
            issuedAt: resolvedCertificate.issuedAt,
          }
        : null,
      certificateTemplate: course.certificateTemplate
        ? {
            id: course.certificateTemplate.id,
            isEnabled: course.certificateTemplate.isEnabled,
            title: course.certificateTemplate.title,
            bodyText: course.certificateTemplate.bodyText,
            organizationName: course.certificateTemplate.organizationName,
            layout: course.certificateTemplate.layout,
          }
        : null,
    };

    return NextResponse.json({ course: result });
  } catch (e) {
    const authErr = await handleAuthError(e);
    if (authErr) return authErr;
    console.error("[student/courses GET id]", e);
    return errorResponse("Failed to load course", 500);
  }
}
