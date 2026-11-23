import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  requireStudent,
  handleAuthError,
  errorResponse,
} from "@/lib/auth";
import { addDurationToDate } from "@/lib/course-utils";

export async function POST(req: Request) {
  try {
    const user = await requireStudent();
    const body = await req.json();
    const { planId } = body as { planId?: string };

    if (!planId) return errorResponse("Plan ID is required", 400);

    const plan = await db.subscriptionPlan.findUnique({
      where: { id: planId },
    });
    if (!plan) return errorResponse("Plan not found", 404);
    if (!plan.isActive)
      return errorResponse("This plan is no longer available", 400);

    const now = new Date();
    const expiryDate = addDurationToDate(
      now,
      plan.duration,
      plan.durationUnit as "DAYS" | "WEEKS" | "MONTHS" | "YEARS"
    );

    // Mark any previous ACTIVE subscription for this student as EXPIRED
    // so the most recent row is unambiguously the active one.
    await db.subscription.updateMany({
      where: { studentId: user.id, status: "ACTIVE" },
      data: { status: "EXPIRED" },
    });

    const sub = await db.subscription.create({
      data: {
        studentId: user.id,
        planId: plan.id,
        planName: plan.name,
        planPrice: plan.price,
        planCurrency: plan.currency,
        planDuration: plan.duration,
        planDurationUnit: plan.durationUnit,
        startDate: now,
        expiryDate,
        status: "ACTIVE",
      },
    });

    return NextResponse.json({
      subscription: {
        subscriptionId: sub.id,
        planId: sub.planId,
        planName: sub.planName,
        planPrice: sub.planPrice,
        planCurrency: sub.planCurrency,
        planDuration: sub.planDuration,
        planDurationUnit: sub.planDurationUnit,
        startDate: sub.startDate,
        expiryDate: sub.expiryDate,
        status: sub.status as "ACTIVE" | "EXPIRED",
        remainingDays: Math.max(
          0,
          Math.ceil(
            (sub.expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
          )
        ),
        elapsedPercent: 0,
      },
    });
  } catch (e) {
    const authErr = await handleAuthError(e);
    if (authErr) return authErr;
    console.error("[student/subscription/renew]", e);
    return errorResponse("Failed to renew subscription", 500);
  }
}
