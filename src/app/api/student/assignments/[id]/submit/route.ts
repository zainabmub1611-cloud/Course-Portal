import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  requireStudent,
  getStudentSubscription,
  handleAuthError,
  errorResponse,
} from "@/lib/auth";
import {
  canStudentAccessCourse,
  isCourseCompletedByStudent,
} from "@/lib/course-utils";
import { saveUploadedFile, ALLOWED_DOC_EXT, validateExt } from "@/lib/storage";
import { notifyCourseStaff } from "@/lib/notifications";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireStudent();
    const { id } = await params;

    const assignment = await db.assignment.findUnique({
      where: { id },
      include: {
        course: { select: { id: true, title: true, accessType: true } },
      },
    });
    if (!assignment) return errorResponse("Assignment not found", 404);
    if (!assignment.isPublished)
      return errorResponse("Assignment unavailable", 403);

    // (a) Course access
    const access = await canStudentAccessCourse(user.id, assignment.courseId);
    if (!access.allowed) {
      return errorResponse(access.reason || "Not allowed", 403, "NO_ACCESS");
    }

    // (b) Subscription active (required for PAID courses; FREE courses stay open)
    if (assignment.course.accessType !== "FREE") {
      const subscription = await getStudentSubscription(user.id);
      if (!subscription || subscription.status !== "ACTIVE") {
        return errorResponse(
          "Subscription expired",
          403,
          "SUBSCRIPTION_EXPIRED"
        );
      }
    }

    // (c) Course completed (all videos)
    const completed = await isCourseCompletedByStudent(
      user.id,
      assignment.courseId
    );
    if (!completed) {
      return errorResponse(
        "Complete all course lessons first",
        403,
        "COURSE_INCOMPLETE"
      );
    }

    // (d) Existing submission check (never overwrite already PASSED submissions; allow re-upload if FAILED)
    const existing = await db.assignmentSubmission.findUnique({
      where: {
        assignmentId_studentId: { assignmentId: id, studentId: user.id },
      },
    });
    if (existing && (existing.status === "PASSED" || existing.status === "REVIEWED")) {
      return errorResponse(
        "This assignment has already been passed",
        400,
        "ALREADY_PASSED"
      );
    }
    if (existing && !assignment.allowResubmission && existing.status !== "FAILED") {
      return errorResponse(
        "You have already submitted this assignment",
        400,
        "ALREADY_SUBMITTED"
      );
    }

    // Handle file upload
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    if (!file || file.size === 0) {
      return errorResponse("Please upload a file", 400);
    }

    const ext = "." + (file.name.split(".").pop() || "").toLowerCase();
    if (!validateExt(ext, ALLOWED_DOC_EXT)) {
      return errorResponse(
        "Unsupported file type. Allowed: PDF, DOC, DOCX, PPT, PPTX, TXT",
        400
      );
    }
    if (file.size > 25 * 1024 * 1024) {
      return errorResponse("File must be under 25MB", 400);
    }

    const saved = await saveUploadedFile(file, "submissions");

    // Upsert the submission (resets status to SUBMITTED for teacher/instructor review)
    const submission = await db.assignmentSubmission.upsert({
      where: {
        assignmentId_studentId: { assignmentId: id, studentId: user.id },
      },
      create: {
        assignmentId: id,
        studentId: user.id,
        fileUrl: saved.url,
        status: "SUBMITTED",
      },
      update: {
        fileUrl: saved.url,
        status: "SUBMITTED",
        submittedAt: new Date(),
        reviewNotes: null,
        reviewedAt: null,
      },
    });

    try {
      await notifyCourseStaff({
        courseId: assignment.courseId,
        excludeUserId: user.id,
        type: "ASSIGNMENT",
        title: "New assignment submission",
        content: `${user.name} submitted "${assignment.title}" for "${assignment.course.title}".`,
        relatedId: assignment.courseId,
      });
    } catch (notificationError) {
      console.error("[student/assignments submit] staff notification:", notificationError);
    }

    // Certificate is NOT issued on upload — it is issued once the teacher/instructor marks it PASSED.
    return NextResponse.json({
      submission: {
        id: submission.id,
        fileUrl: submission.fileUrl,
        submittedAt: submission.submittedAt,
        status: submission.status as "SUBMITTED" | "PASSED" | "FAILED" | "REVIEWED",
        reviewNotes: submission.reviewNotes,
        reviewedAt: submission.reviewedAt,
      },
      certificateIssued: false,
    });
  } catch (e) {
    const authErr = await handleAuthError(e);
    if (authErr) return authErr;
    console.error("[student/assignments submit]", e);
    return errorResponse("Failed to submit assignment", 500);
  }
}
