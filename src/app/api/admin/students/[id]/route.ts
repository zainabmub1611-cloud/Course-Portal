import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin, handleAuthError, errorResponse } from "@/lib/auth";
import { addDurationToDate } from "@/lib/course-utils";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAdmin();
    const { id } = await params;

    const user = await db.user.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        bio: true,
        profilePhoto: true,
        role: true,
        createdAt: true,
        subscriptions: {
          orderBy: { createdAt: "desc" },
          take: 1,
          select: {
            id: true,
            planId: true,
            planName: true,
            planPrice: true,
            planCurrency: true,
            planDuration: true,
            planDurationUnit: true,
            startDate: true,
            expiryDate: true,
            status: true,
          },
        },
      },
    });
    if (!user || user.role !== "STUDENT") {
      return errorResponse("Student not found", 404);
    }

    // Active subscription's planId — what courses can they access?
    const currentSub = user.subscriptions[0] || null;
    let accessibleCourseIds: string[] = [];
    if (currentSub && currentSub.status === "ACTIVE") {
      const accesses = await db.coursePlanAccess.findMany({
        where: { planId: currentSub.planId },
        select: { courseId: true },
      });
      accessibleCourseIds = accesses.map((a) => a.courseId);
    }

    const [allCourses, freeCourses, submissions, certificates] = await Promise.all([
      db.course.findMany({
        where: { isPublished: true },
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          title: true,
          thumbnail: true,
          category: true,
          accessType: true,
        },
      }),
      db.course.findMany({
        where: { isPublished: true, accessType: "FREE" },
        select: { id: true },
      }),
      db.assignmentSubmission.findMany({
        where: { studentId: id },
        orderBy: { submittedAt: "desc" },
        include: {
          assignment: {
            select: { id: true, title: true, course: { select: { id: true, title: true } } },
          },
        },
        take: 20,
      }),
      db.certificate.findMany({
        where: { studentId: id },
        orderBy: { issuedAt: "desc" },
        include: { course: { select: { id: true, title: true } } },
      }),
    ]);

    const freeIds = new Set(freeCourses.map((c) => c.id));

    const enrolledCourses = allCourses.map((c) => {
      const accessible =
        c.accessType === "FREE" || accessibleCourseIds.includes(c.id);
      return {
        id: c.id,
        title: c.title,
        thumbnail: c.thumbnail,
        category: c.category,
        accessType: c.accessType,
        accessible,
      };
    });

    const accessibleCourses = enrolledCourses.filter((c) => c.accessible);

    // refresh expired status if needed
    let subOut: any = currentSub;
    if (currentSub) {
      const now = new Date();
      const isExpired =
        currentSub.status === "EXPIRED" || currentSub.expiryDate <= now;
      const correctStatus: "ACTIVE" | "EXPIRED" = isExpired ? "EXPIRED" : "ACTIVE";
      if (currentSub.status !== correctStatus) {
        await db.subscription.update({
          where: { id: currentSub.id },
          data: { status: correctStatus },
        });
      }
      subOut = { ...currentSub, status: correctStatus };
    }

    return NextResponse.json({
      student: {
        id: user.id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        bio: user.bio,
        profilePhoto: user.profilePhoto,
        createdAt: user.createdAt,
      },
      subscription: subOut,
      availableCourses: enrolledCourses,
      accessibleCourses,
      submissions: submissions.map((s) => ({
        id: s.id,
        assignmentTitle: s.assignment.title,
        courseTitle: s.assignment.course.title,
        courseId: s.assignment.course.id,
        submittedAt: s.submittedAt,
        status: s.status,
        fileUrl: s.fileUrl,
        reviewNotes: s.reviewNotes,
      })),
      certificates: certificates.map((c) => ({
        id: c.id,
        courseTitle: c.course.title,
        certificateNumber: c.certificateNumber,
        issuedAt: c.issuedAt,
        templateTitle: c.templateTitle,
      })),
      stats: {
        accessibleCourseCount: accessibleCourses.length + freeIds.size,
        submissionsCount: submissions.length,
        certificatesCount: certificates.length,
      },
    });
  } catch (e) {
    const authErr = await handleAuthError(e);
    if (authErr) return authErr;
    console.error("[admin/students GET id]", e);
    return errorResponse("Failed to load student", 500);
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
    const { name, phone, bio, planId } = body as {
      name?: string;
      phone?: string | null;
      bio?: string | null;
      planId?: string;
    };

    const existing = await db.user.findUnique({ where: { id } });
    if (!existing || existing.role !== "STUDENT") {
      return errorResponse("Student not found", 404);
    }

    await db.user.update({
      where: { id },
      data: {
        ...(name !== undefined ? { name } : {}),
        ...(phone !== undefined ? { phone: phone || null } : {}),
        ...(bio !== undefined ? { bio: bio || null } : {}),
      },
    });

    if (planId) {
      const plan = await db.subscriptionPlan.findUnique({ where: { id: planId } });
      if (!plan) return errorResponse("Plan not found", 404);
      const startDate = new Date();
      const expiryDate = addDurationToDate(
        startDate,
        plan.duration,
        plan.durationUnit as "DAYS" | "WEEKS" | "MONTHS" | "YEARS"
      );
      await db.subscription.create({
        data: {
          studentId: id,
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

    return NextResponse.json({ ok: true });
  } catch (e) {
    const authErr = await handleAuthError(e);
    if (authErr) return authErr;
    console.error("[admin/students PUT]", e);
    return errorResponse("Failed to update student", 500);
  }
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAdmin();
    const { id } = await params;

    const existing = await db.user.findUnique({ where: { id } });
    if (!existing) return errorResponse("Student not found", 404);
    if (existing.role === "ADMIN") {
      return errorResponse("Cannot delete admin user", 400);
    }

    await db.user.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (e) {
    const authErr = await handleAuthError(e);
    if (authErr) return authErr;
    console.error("[admin/students DELETE]", e);
    return errorResponse("Failed to delete student", 500);
  }
}
