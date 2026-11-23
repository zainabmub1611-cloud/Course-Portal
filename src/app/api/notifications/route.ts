import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser, handleAuthError, errorResponse } from "@/lib/auth";

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) return errorResponse("Unauthorized", 401);

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

    const shape = (notification: (typeof unread)[number]) => ({
      id: notification.id,
      type: notification.type,
      title: notification.title,
      content: notification.content,
      relatedId: notification.relatedId,
      isRead: notification.isRead,
      createdAt: notification.createdAt,
    });

    return NextResponse.json({
      notifications: [...unread.map(shape), ...recentRead.map(shape)],
      unreadCount: unread.length,
    });
  } catch (error) {
    const authError = await handleAuthError(error);
    if (authError) return authError;
    console.error("[notifications GET]", error);
    return errorResponse("Failed to load notifications", 500);
  }
}

export async function PATCH(req: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) return errorResponse("Unauthorized", 401);

    const url = new URL(req.url);
    const id = url.searchParams.get("id");
    const all = url.searchParams.get("all");

    if (all === "true") {
      await db.notification.updateMany({
        where: { studentId: user.id, isRead: false },
        data: { isRead: true },
      });
    } else if (id) {
      const updated = await db.notification.updateMany({
        where: { id, studentId: user.id },
        data: { isRead: true },
      });
      if (updated.count === 0) {
        return errorResponse("Notification not found", 404);
      }
    } else {
      return errorResponse("Provide either ?id=<id> or ?all=true", 400);
    }

    const unreadCount = await db.notification.count({
      where: { studentId: user.id, isRead: false },
    });
    return NextResponse.json({ ok: true, unreadCount });
  } catch (error) {
    const authError = await handleAuthError(error);
    if (authError) return authError;
    console.error("[notifications PATCH]", error);
    return errorResponse("Failed to update notification", 500);
  }
}
