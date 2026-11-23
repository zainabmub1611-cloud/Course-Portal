import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireUniversityOwner, handleAuthError, errorResponse } from "@/lib/auth";

/**
 * PATCH /api/university/courses/[id]/publish
 * Toggle publish state for a course owned by the logged-in university.
 */
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireUniversityOwner();
    const { id } = await params;
    const body = await req.json();
    const { isPublished } = body as { isPublished?: boolean };

    const existing = await db.course.findUnique({
      where: { id },
      select: { universityId: true },
    });
    if (!existing || existing.universityId !== user.universityId) {
      return errorResponse("Not found", 404);
    }

    await db.course.update({
      where: { id },
      data: { isPublished: !!isPublished },
    });

    return NextResponse.json({ ok: true, isPublished: !!isPublished });
  } catch (e) {
    const authErr = await handleAuthError(e);
    if (authErr) return authErr;
    console.error("[university/courses publish]", e);
    return errorResponse("Failed to toggle publish", 500);
  }
}
