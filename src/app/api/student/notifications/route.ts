import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  requireStudent,
  handleAuthError,
  errorResponse,
} from "@/lib/auth";

/**
 * GET /api/student/notifications
 *   Returns ALL unread notifications (regardless of age) plus the most
 *   recent read notifications (capped at 20) so the UI can show a unified
 *   list of "things you should look at" + "recently seen".
 *
 * The Notification model has no Prisma relations beyond `student`, so we
 *   shape the rows directly without any `include`.
 */
export async function GET() {
  try {
    const user = await requireStudent();

    const [unread, recentRead] = await Promise.all([
      db.notification.findMany({
        where: { studentId: user.id, isRead: false },
        orderBy: { createdAt: "desc" },
      }),
      db.notification.findMany({
        where: { studentId: user.id, isRead: true },
        orderBy: { createdAt: "desc" },
        take: 20,
      }),
    ]);

    const shape = (n: typeof unread[number]) => ({
      id: n.id,
      type: n.type,
      title: n.title,
      content: n.content,
      relatedId: n.relatedId,
      isRead: n.isRead,
      createdAt: n.createdAt,
    });

    return NextResponse.json({
      notifications: [...unread.map(shape), ...recentRead.map(shape)],
      unreadCount: unread.length,
    });
  } catch (e) {
    const authErr = await handleAuthError(e);
    if (authErr) return authErr;
    console.error("[student/notifications GET]", e);
    return errorResponse("Failed to load notifications", 500);
  }
}

/**
 * PATCH /api/student/notifications?id=<notifId>      → mark one as read
 *        /api/student/notifications?all=true         → mark all as read
 *
 * Anything else returns a 400. The response is the updated unread count
 * so the UI can update its badge without an extra GET.
 */
export async function PATCH(req: Request) {
  try {
    const user = await requireStudent();
    const url = new URL(req.url);
    const id = url.searchParams.get("id");
    const all = url.searchParams.get("all");

    if (all === "true") {
      await db.notification.updateMany({
        where: { studentId: user.id, isRead: false },
        data: { isRead: true },
      });
    } else if (id) {
      // Only the owner can mark their own notification.
      const existing = await db.notification.findUnique({
        where: { id },
        select: { studentId: true },
      });
      if (!existing) return errorResponse("Notification not found", 404);
      if (existing.studentId !== user.id) {
        return errorResponse("Not allowed", 403, "NO_ACCESS");
      }
      await db.notification.update({
        where: { id },
        data: { isRead: true },
      });
    } else {
      return errorResponse(
        "Provide either ?id=<id> or ?all=true",
        400
      );
    }

    const unreadCount = await db.notification.count({
      where: { studentId: user.id, isRead: false },
    });

    return NextResponse.json({ ok: true, unreadCount });
  } catch (e) {
    const authErr = await handleAuthError(e);
    if (authErr) return authErr;
    console.error("[student/notifications PATCH]", e);
    return errorResponse("Failed to update notification", 500);
  }
}
