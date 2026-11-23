import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin, handleAuthError, errorResponse } from "@/lib/auth";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAdmin();
    const { id } = await params;
    const body = await req.json();
    const { orderedIds } = body as { orderedIds?: string[] };

    if (!Array.isArray(orderedIds)) {
      return errorResponse("orderedIds must be an array", 400);
    }

    const course = await db.course.findUnique({ where: { id } });
    if (!course) return errorResponse("Course not found", 404);

    await Promise.all(
      orderedIds.map((tid, idx) =>
        db.topic.updateMany({
          where: { id: tid, courseId: id },
          data: { displayOrder: idx },
        })
      )
    );

    return NextResponse.json({ ok: true });
  } catch (e) {
    const authErr = await handleAuthError(e);
    if (authErr) return authErr;
    console.error("[admin/topics reorder]", e);
    return errorResponse("Failed to reorder topics", 500);
  }
}
