import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  requireUniversity,
  canInstructorAccessCourse,
  handleAuthError,
  errorResponse,
} from "@/lib/auth";

/**
 * GET /api/university/submissions/[id]
 * Fetch a submission — verifies ownership via the assignment's course.
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireUniversity();
    const { id } = await params;

    const submission = await db.assignmentSubmission.findUnique({
      where: { id },
      include: {
        student: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
            createdAt: true,
          },
        },
        assignment: {
          select: {
            id: true,
            title: true,
            description: true,
            instructions: true,
            fileUrl: true,
            dueDate: true,
            course: { select: { id: true, title: true, universityId: true } },
          },
        },
      },
    });
    if (!submission) return errorResponse("Not found", 404);
    if (submission.assignment.course.universityId !== user.universityId) {
      return errorResponse("Not found", 404);
    }
    if (!canInstructorAccessCourse(user, submission.assignment.course.id)) {
      return errorResponse("Not found", 404);
    }

    return NextResponse.json({
      submission: {
        id: submission.id,
        fileUrl: submission.fileUrl,
        submittedAt: submission.submittedAt,
        status: submission.status,
        reviewNotes: submission.reviewNotes,
        reviewedAt: submission.reviewedAt,
        createdAt: submission.createdAt,
        student: submission.student,
        assignment: {
          id: submission.assignment.id,
          title: submission.assignment.title,
          description: submission.assignment.description,
          instructions: submission.assignment.instructions,
          fileUrl: submission.assignment.fileUrl,
          dueDate: submission.assignment.dueDate,
          course: {
            id: submission.assignment.course.id,
            title: submission.assignment.course.title,
          },
        },
      },
    });
  } catch (e) {
    const authErr = await handleAuthError(e);
    if (authErr) return authErr;
    console.error("[university/submissions GET id]", e);
    return errorResponse("Failed to load submission", 500);
  }
}
