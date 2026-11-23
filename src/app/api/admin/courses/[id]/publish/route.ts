import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin, handleAuthError, errorResponse } from "@/lib/auth";

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAdmin();
    const { id } = await params;
    const body = await req.json();
    const { isPublished } = body as { isPublished?: boolean };

    const existing = await db.course.findUnique({ where: { id } });
    if (!existing) return errorResponse("Course not found", 404);

    await db.course.update({
      where: { id },
      data: { isPublished: !!isPublished },
    });

    return NextResponse.json({ ok: true, isPublished: !!isPublished });
  } catch (e) {
    const authErr = await handleAuthError(e);
    if (authErr) return authErr;
    console.error("[admin/courses publish]", e);
    return errorResponse("Failed to toggle publish", 500);
  }
}
