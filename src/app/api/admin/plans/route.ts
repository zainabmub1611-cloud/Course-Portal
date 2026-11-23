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

export async function GET() {
  try {
    await requireAdmin();
    const plans = await db.subscriptionPlan.findMany({
      orderBy: [{ isPopular: "desc" }, { createdAt: "desc" }],
    });
    return NextResponse.json({
      plans: plans.map((p) => ({
        id: p.id,
        name: p.name,
        description: p.description,
        price: p.price,
        currency: p.currency,
        duration: p.duration,
        durationUnit: p.durationUnit,
        features: safeParseArray(p.features),
        benefits: safeParseArray(p.benefits),
        isActive: p.isActive,
        isPopular: p.isPopular,
        createdAt: p.createdAt,
      })),
    });
  } catch (e) {
    const authErr = await handleAuthError(e);
    if (authErr) return authErr;
    console.error("[admin/plans GET]", e);
    return errorResponse("Failed to load plans", 500);
  }
}

export async function POST(req: Request) {
  try {
    await requireAdmin();
    const body = await req.json();
    const {
      name,
      description,
      price,
      currency = "OMR",
      duration = 1,
      durationUnit = "MONTHS",
      features = [],
      benefits = [],
      isActive = true,
      isPopular = false,
    } = body as {
      name?: string;
      description?: string;
      price?: number;
      currency?: string;
      duration?: number;
      durationUnit?: string;
      features?: string[];
      benefits?: string[];
      isActive?: boolean;
      isPopular?: boolean;
    };

    if (!name || !name.trim()) return errorResponse("Name is required", 400);
    if (typeof price !== "number" || price < 0) {
      return errorResponse("Price must be a non-negative number", 400);
    }
    const validUnits = ["DAYS", "WEEKS", "MONTHS", "YEARS"];
    const unit = validUnits.includes(durationUnit) ? durationUnit : "MONTHS";

    const plan = await db.subscriptionPlan.create({
      data: {
        name: name.trim(),
        description: description?.trim() || null,
        price,
        currency,
        duration: Math.max(1, Math.floor(duration)),
        durationUnit: unit,
        features: JSON.stringify(features.filter((f) => String(f).trim())),
        benefits: JSON.stringify(benefits.filter((b) => String(b).trim())),
        isActive: !!isActive,
        isPopular: !!isPopular,
      },
    });

    return NextResponse.json({ plan: { id: plan.id } });
  } catch (e) {
    const authErr = await handleAuthError(e);
    if (authErr) return authErr;
    console.error("[admin/plans POST]", e);
    return errorResponse("Failed to create plan", 500);
  }
}
