import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET() {
  const plans = await db.subscriptionPlan.findMany({
    where: { isActive: true },
    orderBy: [{ isPopular: "desc" }, { price: "asc" }],
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
    })),
  });
}

function safeParseArray(s: string): string[] {
  try {
    const v = JSON.parse(s);
    return Array.isArray(v) ? v.map((x) => String(x)) : [];
  } catch {
    return [];
  }
}
