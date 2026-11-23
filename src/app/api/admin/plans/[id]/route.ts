import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin, handleAuthError, errorResponse } from "@/lib/auth";

function safeParseArray(s: string): string[] {
  try {
    const v = JSON.parse(s);
    return Array.isArray(v) ? v.map((x) => String(x)) : [];
  } catch {
    return [];
  }
}

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAdmin();
    const { id } = await params;
    const body = await req.json();
    const {
      name,
      description,
      price,
      currency,
      duration,
      durationUnit,
      features,
      benefits,
      isActive,
      isPopular,
    } = body as {
      name?: string;
      description?: string | null;
      price?: number;
      currency?: string;
      duration?: number;
      durationUnit?: string;
      features?: string[];
      benefits?: string[];
      isActive?: boolean;
      isPopular?: boolean;
    };

    const existing = await db.subscriptionPlan.findUnique({ where: { id } });
    if (!existing) return errorResponse("Plan not found", 404);

    const data: any = {};
    if (name !== undefined) data.name = name.trim();
    if (description !== undefined) data.description = description?.trim() || null;
    if (price !== undefined) {
      if (typeof price !== "number" || price < 0) {
        return errorResponse("Price must be a non-negative number", 400);
      }
      data.price = price;
    }
    if (currency !== undefined) data.currency = currency;
    if (duration !== undefined) {
      data.duration = Math.max(1, Math.floor(duration));
    }
    if (durationUnit !== undefined) {
      const validUnits = ["DAYS", "WEEKS", "MONTHS", "YEARS"];
      data.durationUnit = validUnits.includes(durationUnit) ? durationUnit : "MONTHS";
    }
    if (features !== undefined) {
      data.features = JSON.stringify(features.filter((f) => String(f).trim()));
    }
    if (benefits !== undefined) {
      data.benefits = JSON.stringify(benefits.filter((b) => String(b).trim()));
    }
    if (isActive !== undefined) data.isActive = !!isActive;
    if (isPopular !== undefined) data.isPopular = !!isPopular;

    const updated = await db.subscriptionPlan.update({ where: { id }, data });
    return NextResponse.json({
      plan: {
        id: updated.id,
        features: safeParseArray(updated.features),
        benefits: safeParseArray(updated.benefits),
      },
    });
  } catch (e) {
    const authErr = await handleAuthError(e);
    if (authErr) return authErr;
    console.error("[admin/plans PUT]", e);
    return errorResponse("Failed to update plan", 500);
  }
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAdmin();
    const { id } = await params;

    const existing = await db.subscriptionPlan.findUnique({ where: { id } });
    if (!existing) return errorResponse("Plan not found", 404);

    const subscriptionsCount = await db.subscription.count({
      where: { planId: id },
    });
    if (subscriptionsCount > 0) {
      return errorResponse(
        `Plan is assigned to ${subscriptionsCount} subscription(s). Deactivate it instead.`,
        400,
        "PLAN_IN_USE"
      );
    }

    // Also check if it's assigned to any course plan access rows
    const courseAccessCount = await db.coursePlanAccess.count({
      where: { planId: id },
    });
    if (courseAccessCount > 0) {
      await db.coursePlanAccess.deleteMany({ where: { planId: id } });
    }

    await db.subscriptionPlan.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (e) {
    const authErr = await handleAuthError(e);
    if (authErr) return authErr;
    console.error("[admin/plans DELETE]", e);
    return errorResponse("Failed to delete plan", 500);
  }
}
