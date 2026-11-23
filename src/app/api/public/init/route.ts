import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { hashPassword } from "@/lib/auth/server";
import { addDurationToDate } from "@/lib/course-utils";

/**
 * First-run platform initialization.
 *
 * Only seeds starter data (admin, subscription plans, Tech University, Demo Student)
 * when the database is completely empty (0 users). Once initialized, deleted
 * universities, students, or plans are NEVER recreated on page refresh.
 *
 * As a safety net against lockout, if all ADMIN users are somehow missing,
 * a bootstrap admin account is created without touching other records.
 */
export async function GET() {
  try {
    const totalUsers = await db.user.count();

    if (totalUsers > 0) {
      // Already initialized — never resurrect deleted universities, students, or plans.
      const adminCount = await db.user.count({ where: { role: "ADMIN" } });
      if (adminCount === 0) {
        await db.user.create({
          data: {
            email: "admin@courselearn.dev",
            name: "Platform Administrator",
            role: "ADMIN",
            passwordHash: hashPassword("admin123"),
          },
        });
        return NextResponse.json({ seeded: true, created: ["admin"] });
      }
      return NextResponse.json({ seeded: false });
    }

    const created: string[] = [];

    // ─── 1. Admin account ───
    await db.user.create({
      data: {
        email: "admin@courselearn.dev",
        name: "Platform Administrator",
        role: "ADMIN",
        passwordHash: hashPassword("admin123"),
      },
    });
    created.push("admin");

    // ─── 2. Subscription plans (only on fresh DB) ───
    const planCount = await db.subscriptionPlan.count();
    if (planCount === 0) {
      await db.subscriptionPlan.createMany({
        data: [
          {
            name: "Basic",
            description: "Entry-level plan for getting started with self-paced learning.",
            price: 10,
            currency: "OMR",
            duration: 1,
            durationUnit: "MONTHS",
            features: JSON.stringify([
              "Access to selected training courses",
              "Recorded video lessons",
              "Course learning materials",
              "Assignment access",
            ]),
            benefits: JSON.stringify([
              "Self-paced study",
              "Mobile-friendly access",
              "Progress tracking",
            ]),
            isActive: true,
            isPopular: false,
          },
          {
            name: "Standard",
            description: "Most popular plan for committed learners who want full course access.",
            price: 25,
            currency: "OMR",
            duration: 3,
            durationUnit: "MONTHS",
            features: JSON.stringify([
              "Access to all standard training courses",
              "Recorded video lessons",
              "Course learning materials",
              "Assignment access",
              "Completion certificates",
              "Priority email support",
            ]),
            benefits: JSON.stringify([
              "3 months of full access",
              "Progress tracking",
              "Verifiable certificates",
              "Priority support",
            ]),
            isActive: true,
            isPopular: true,
          },
          {
            name: "Premium",
            description: "Annual plan for professionals seeking long-term access and benefits.",
            price: 90,
            currency: "OMR",
            duration: 1,
            durationUnit: "YEARS",
            features: JSON.stringify([
              "Access to all premium training courses",
              "Recorded video lessons",
              "Course learning materials",
              "Assignment access",
              "Completion certificates",
              "Direct instructor messaging",
              "Early access to new courses",
            ]),
            benefits: JSON.stringify([
              "12 months of unlimited access",
              "Verifiable certificates",
              "Premium support",
              "Early course access",
            ]),
            isActive: true,
            isPopular: false,
          },
        ],
      });
      created.push("plans");
    }

    // ─── 3. University account (Tech University) ───
    const uniUser = await db.user.create({
      data: {
        email: "tech@courselearn.dev",
        name: "Tech University",
        role: "UNIVERSITY",
        passwordHash: hashPassword("tech123"),
      },
    });
    await db.university.create({
      data: {
        name: "Tech University",
        description:
          "A leading technology university offering professional courses in programming, design, and digital skills.",
        userId: uniUser.id,
      },
    });
    created.push("university", "university-profile");

    // ─── 4. Demo Student account ───
    const studentUser = await db.user.create({
      data: {
        email: "demo@courselearn.dev",
        name: "Demo Student",
        role: "STUDENT",
        passwordHash: hashPassword("password123"),
      },
    });
    created.push("student");

    const standardPlan = await db.subscriptionPlan.findFirst({
      where: { name: "Standard" },
    });
    if (standardPlan) {
      const startDate = new Date();
      const expiryDate = addDurationToDate(
        startDate,
        standardPlan.duration,
        standardPlan.durationUnit as "DAYS" | "WEEKS" | "MONTHS" | "YEARS"
      );
      await db.subscription.create({
        data: {
          studentId: studentUser.id,
          planId: standardPlan.id,
          planName: standardPlan.name,
          planPrice: standardPlan.price,
          planCurrency: standardPlan.currency,
          planDuration: standardPlan.duration,
          planDurationUnit: standardPlan.durationUnit,
          startDate,
          expiryDate,
          status: "ACTIVE",
        },
      });
      created.push("student-subscription");
    }

    return NextResponse.json({
      seeded: true,
      created,
      credentials: {
        admin: { email: "admin@courselearn.dev", password: "admin123" },
        university: { email: "tech@courselearn.dev", password: "tech123" },
        student: { email: "demo@courselearn.dev", password: "password123" },
      },
    });
  } catch (e) {
    console.error("[init]", e);
    return NextResponse.json(
      { error: "Init failed", detail: String(e) },
      { status: 500 }
    );
  }
}
