import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin, handleAuthError, errorResponse } from "@/lib/auth";
import { hashPassword } from "@/lib/auth/server";
import { addDurationToDate } from "@/lib/course-utils";

export async function GET(req: Request) {
  try {
    await requireAdmin();
    const url = new URL(req.url);
    const q = (url.searchParams.get("q") || "").trim().toLowerCase();
    const status = url.searchParams.get("status"); // ACTIVE | EXPIRED
    const planId = url.searchParams.get("planId");

    const students = await db.user.findMany({
      where: {
        role: "STUDENT",
        ...(q
          ? {
              OR: [
                { name: { contains: q } },
                { email: { contains: q } },
                { phone: { contains: q } },
              ],
            }
          : {}),
      },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        createdAt: true,
        subscriptions: {
          orderBy: { createdAt: "desc" },
          take: 1,
          select: {
            id: true,
            planId: true,
            planName: true,
            startDate: true,
            expiryDate: true,
            status: true,
          },
        },
      },
    });

    // Refresh expired statuses + apply filters
    const now = new Date();
    const enriched = await Promise.all(
      students.map(async (s) => {
        const sub = s.subscriptions[0] || null;
        let subOut: any = null;
        if (sub) {
          const isExpired = sub.status === "EXPIRED" || sub.expiryDate <= now;
          const correctStatus: "ACTIVE" | "EXPIRED" = isExpired ? "EXPIRED" : "ACTIVE";
          if (sub.status !== correctStatus) {
            await db.subscription.update({
              where: { id: sub.id },
              data: { status: correctStatus },
            });
          }
          subOut = {
            planName: sub.planName,
            startDate: sub.startDate,
            expiryDate: sub.expiryDate,
            status: correctStatus,
            planId: sub.planId,
          };
        }
        return {
          id: s.id,
          name: s.name,
          email: s.email,
          phone: s.phone,
          createdAt: s.createdAt,
          subscription: subOut,
        };
      })
    );

    let filtered = enriched;
    if (status) {
      filtered = filtered.filter(
        (s) => (s.subscription?.status || "EXPIRED") === status
      );
    }
    if (planId) {
      filtered = filtered.filter((s) => s.subscription?.planId === planId);
    }

    return NextResponse.json({ students: filtered });
  } catch (e) {
    const authErr = await handleAuthError(e);
    if (authErr) return authErr;
    console.error("[admin/students GET]", e);
    return errorResponse("Failed to load students", 500);
  }
}

export async function POST(req: Request) {
  try {
    await requireAdmin();
    const body = await req.json();
    const { name, email, password, planId } = body as {
      name?: string;
      email?: string;
      password?: string;
      planId?: string;
    };
    if (!name || !email || !password) {
      return errorResponse("name, email and password are required", 400);
    }
    if (password.length < 6) {
      return errorResponse("Password must be at least 6 characters", 400);
    }

    const normalizedEmail = email.toLowerCase().trim();
    const existing = await db.user.findUnique({ where: { email: normalizedEmail } });
    if (existing) return errorResponse("Email already registered", 409);

    let plan: any = null;
    if (planId) {
      plan = await db.subscriptionPlan.findUnique({ where: { id: planId } });
      if (!plan) return errorResponse("Plan not found", 404);
    }

    const student = await db.user.create({
      data: {
        name: name.trim(),
        email: normalizedEmail,
        passwordHash: hashPassword(password),
        role: "STUDENT",
      },
    });

    let subscription: any = null;
    if (plan) {
      const startDate = new Date();
      const expiryDate = addDurationToDate(
        startDate,
        plan.duration,
        plan.durationUnit as "DAYS" | "WEEKS" | "MONTHS" | "YEARS"
      );
      subscription = await db.subscription.create({
        data: {
          studentId: student.id,
          planId: plan.id,
          planName: plan.name,
          planPrice: plan.price,
          planCurrency: plan.currency,
          planDuration: plan.duration,
          planDurationUnit: plan.durationUnit,
          startDate,
          expiryDate,
          status: "ACTIVE",
        },
      });
    }

    return NextResponse.json({
      student: {
        id: student.id,
        name: student.name,
        email: student.email,
        phone: student.phone,
        createdAt: student.createdAt,
        subscription: subscription
          ? {
              planName: subscription.planName,
              startDate: subscription.startDate,
              expiryDate: subscription.expiryDate,
              status: subscription.status,
              planId: subscription.planId,
            }
          : null,
      },
    });
  } catch (e) {
    const authErr = await handleAuthError(e);
    if (authErr) return authErr;
    console.error("[admin/students POST]", e);
    return errorResponse("Failed to create student", 500);
  }
}
