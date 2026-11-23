import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  requireUniversity,
  canInstructorAccessCourse,
  handleAuthError,
  errorResponse,
} from "@/lib/auth";
import { issueCertificateIfNeeded } from "@/lib/course-utils";

const VALID_STATUSES = new Set(["SUBMITTED", "PASSED", "FAILED", "REVIEWED"]);

/**
 * PATCH /api/university/submissions/[id]/review
 * Review a submission (Mark Pass / Fail / Pending) — verifies ownership via
 * the assignment's course and issues the course certificate when marked PASSED.
 */
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireUniversity();
    const { id } = await params;
    const body = await req.json();
    const { status, reviewNotes } = body as {
      status?: string;
      reviewNotes?: string | null;
    };

    const existing = await db.assignmentSubmission.findUnique({
      where: { id },
      include: {
        assignment: {
          select: {
            id: true,
            title: true,
            courseId: true,
            course: { select: { id: true, title: true, universityId: true } },
          },
        },
      },
    });
    if (!existing) return errorResponse("Not found", 404);
    if (existing.assignment.course.universityId !== user.universityId) {
      return errorResponse("Not found", 404);
    }
    if (!canInstructorAccessCourse(user, existing.assignment.course.id)) {
      return errorResponse("Not found", 404);
    }

    const requested = typeof status === "string" ? status.toUpperCase() : "";
    const normalizedStatus =
      requested === "REVIEWED"
        ? "PASSED"
        : VALID_STATUSES.has(requested)
          ? requested
          : existing.status;

    const isReviewed = normalizedStatus === "PASSED" || normalizedStatus === "FAILED";
    const updated = await db.assignmentSubmission.update({
      where: { id },
      data: {
        status: normalizedStatus,
        reviewNotes:
          reviewNotes !== undefined
            ? reviewNotes?.trim() || null
            : existing.reviewNotes,
        reviewedAt: isReviewed ? new Date() : null,
      },
    });

    let certificateIssued = false;
    let certificateId: string | null = null;

    if (normalizedStatus === "PASSED") {
      try {
        const certResult = await issueCertificateIfNeeded(
          existing.studentId,
          existing.assignment.courseId,
          {
            preferredInstructorUserId:
              user.role === "INSTRUCTOR" ? user.id : undefined,
          }
        );
        certificateIssued = certResult.issued;
        certificateId = certResult.certificateId;
      } catch (err) {
        console.error("[university/submissions review] certificate error:", err);
      }

      try {
        await db.notification.create({
          data: {
            studentId: existing.studentId,
            type: certificateIssued ? "CERTIFICATE_ISSUED" : "ASSIGNMENT_PASSED",
            title: certificateIssued
              ? "Assignment Passed & Certificate Issued!"
              : "Assignment Marked as Pass",
            content: certificateIssued
              ? `Your assignment "${existing.assignment.title}" for "${existing.assignment.course.title}" was marked Pass and your certificate has been issued.`
              : `Your assignment "${existing.assignment.title}" for "${existing.assignment.course.title}" was marked Pass.`,
            relatedId: certificateId || existing.assignment.courseId,
          },
        });
      } catch {}
    } else if (normalizedStatus === "FAILED") {
      try {
        await db.notification.create({
          data: {
            studentId: existing.studentId,
            type: "ASSIGNMENT_NEEDS_REVISION",
            title: "Assignment Needs Revision",
            content: `Your assignment "${existing.assignment.title}" for "${existing.assignment.course.title}" needs revision. Please check the instructor feedback and resubmit.`,
            relatedId: existing.assignment.courseId,
          },
        });
      } catch {}
    }

    return NextResponse.json({
      submission: updated,
      certificateIssued,
      certificateId,
    });
  } catch (e) {
    const authErr = await handleAuthError(e);
    if (authErr) return authErr;
    console.error("[university/submissions review]", e);
    return errorResponse("Failed to review submission", 500);
  }
}
