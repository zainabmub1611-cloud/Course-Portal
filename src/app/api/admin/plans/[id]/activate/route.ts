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
    const { isActive } = body as { isActive?: boolean };

    const existing = await db.subscriptionPlan.findUnique({ where: { id } });
    if (!existing) return errorResponse("Plan not found", 404);

    const updated = await db.subscriptionPlan.update({
      where: { id },
      data: { isActive: !!isActive },
    });

    return NextResponse.json({ ok: true, isActive: updated.isActive });
  } catch (e) {
    const authErr = await handleAuthError(e);
    if (authErr) return authErr;
    console.error("[admin/plans activate]", e);
    return errorResponse("Failed to change plan status", 500);
  }
}
