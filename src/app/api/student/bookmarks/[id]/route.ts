import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  requireStudent,
  handleAuthError,
  errorResponse,
} from "@/lib/auth";

/**
 * DELETE /api/student/bookmarks/[id]
 *   Delete a bookmark. Only the owner may delete.
 */
export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireStudent();
    const { id } = await params;

    const existing = await db.bookmark.findUnique({
      where: { id },
      select: { studentId: true },
    });
    if (!existing) return errorResponse("Bookmark not found", 404);
    if (existing.studentId !== user.id) {
      return errorResponse("Not allowed", 403, "NO_ACCESS");
    }

    await db.bookmark.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (e) {
    const authErr = await handleAuthError(e);
    if (authErr) return authErr;
    console.error("[student/bookmarks DELETE]", e);
    return errorResponse("Failed to delete bookmark", 500);
  }
}
