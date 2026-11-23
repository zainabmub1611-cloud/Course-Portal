import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin, handleAuthError, errorResponse } from "@/lib/auth";

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAdmin();
    const { id } = await params;
    const body = await req.json();
    const { title, description, displayOrder } = body as {
      title?: string;
      description?: string | null;
      displayOrder?: number;
    };

    const existing = await db.topic.findUnique({ where: { id } });
    if (!existing) return errorResponse("Topic not found", 404);

    await db.topic.update({
      where: { id },
      data: {
        ...(title !== undefined ? { title: title.trim() } : {}),
        ...(description !== undefined ? { description: description?.trim() || null } : {}),
        ...(displayOrder !== undefined ? { displayOrder } : {}),
      },
    });

    return NextResponse.json({ ok: true });
  } catch (e) {
    const authErr = await handleAuthError(e);
    if (authErr) return authErr;
    console.error("[admin/topics PUT]", e);
    return errorResponse("Failed to update topic", 500);
  }
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAdmin();
    const { id } = await params;

    const existing = await db.topic.findUnique({ where: { id } });
    if (!existing) return errorResponse("Topic not found", 404);

    await db.topic.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (e) {
    const authErr = await handleAuthError(e);
    if (authErr) return authErr;
    console.error("[admin/topics DELETE]", e);
    return errorResponse("Failed to delete topic", 500);
  }
}
