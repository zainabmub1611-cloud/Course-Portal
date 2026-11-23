import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin, handleAuthError, errorResponse } from "@/lib/auth";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAdmin();
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
            course: { select: { id: true, title: true } },
          },
        },
      },
    });
    if (!submission) return errorResponse("Submission not found", 404);

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
          course: submission.assignment.course,
        },
      },
    });
  } catch (e) {
    const authErr = await handleAuthError(e);
    if (authErr) return authErr;
    console.error("[admin/submissions GET id]", e);
    return errorResponse("Failed to load submission", 500);
  }
}
