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

    const existing = await db.videoLesson.findUnique({ where: { id } });
    if (!existing) return errorResponse("Video not found", 404);

    const updated = await db.videoLesson.update({
      where: { id },
      data: { isPublished: !!isPublished },
    });

    return NextResponse.json({ ok: true, isPublished: updated.isPublished });
  } catch (e) {
    const authErr = await handleAuthError(e);
    if (authErr) return authErr;
    console.error("[admin/videos publish]", e);
    return errorResponse("Failed to toggle video publish", 500);
  }
}
