import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin, handleAuthError, errorResponse } from "@/lib/auth";

export async function GET(req: Request) {
  try {
    await requireAdmin();
    const url = new URL(req.url);
    const q = (url.searchParams.get("q") || "").trim().toLowerCase();
    const category = url.searchParams.get("category") || "";
    const published = url.searchParams.get("published"); // "true" | "false"

    const courses = await db.course.findMany({
      where: {
        ...(q ? { title: { contains: q } } : {}),
        ...(category ? { category } : {}),
        ...(published === "true"
          ? { isPublished: true }
          : published === "false"
          ? { isPublished: false }
          : {}),
      },
      orderBy: { createdAt: "desc" },
      include: {
        topics: { select: { id: true } },
        videos: {
          where: { isPublished: true },
          orderBy: { displayOrder: "asc" },
          take: 1,
          select: { thumbnail: true, videoUrl: true, source: true },
        },
        planAccess: { include: { plan: { select: { name: true } } } },
      },
    });

    return NextResponse.json({
      courses: courses.map((c) => {
        const firstVideo = c.videos[0];
        return {
          id: c.id,
          title: c.title,
          description: c.description,
          // Fall back to first video's thumbnail when course has no custom thumbnail
          thumbnail: c.thumbnail || firstVideo?.thumbnail || null,
          firstVideoUrl: firstVideo?.videoUrl || null,
          firstVideoSource: firstVideo?.source || null,
          category: c.category,
          accessType: c.accessType,
          isPublished: c.isPublished,
          createdAt: c.createdAt,
          topicsCount: c.topics.length,
          videosCount: c.videos.length,
          planNames: c.planAccess.map((p) => p.plan.name),
        };
      }),
    });
  } catch (e) {
    const authErr = await handleAuthError(e);
    if (authErr) return authErr;
    console.error("[admin/courses GET]", e);
    return errorResponse("Failed to load courses", 500);
  }
}

export async function POST(req: Request) {
  try {
    await requireAdmin();
    const body = await req.json();
    const {
      title,
      description,
      thumbnail,
      category,
      accessType,
      isPublished,
      planIds = [],
    } = body as {
      title?: string;
      description?: string;
      thumbnail?: string;
      category?: string;
      accessType?: "FREE" | "PAID";
      isPublished?: boolean;
      planIds?: string[];
    };

    if (!title || !title.trim()) {
      return errorResponse("Title is required", 400);
    }
    const aType = accessType === "PAID" ? "PAID" : "FREE";

    if (aType === "PAID" && planIds.length === 0) {
      return errorResponse(
        "Paid courses must specify at least one subscription plan",
        400
      );
    }

    // Validate planIds exist
    if (planIds.length > 0) {
      const foundPlans = await db.subscriptionPlan.findMany({
        where: { id: { in: planIds } },
        select: { id: true },
      });
      if (foundPlans.length !== planIds.length) {
        return errorResponse("One or more plans not found", 400);
      }
    }

    const course = await db.course.create({
      data: {
        title: title.trim(),
        description: description?.trim() || null,
        thumbnail: thumbnail?.trim() || null,
        category: category?.trim() || null,
        accessType: aType,
        isPublished: !!isPublished,
      },
    });

    if (aType === "PAID" && planIds.length > 0) {
      await db.coursePlanAccess.createMany({
        data: planIds.map((pid) => ({ courseId: course.id, planId: pid })),
      });
    }

    return NextResponse.json({ course: { id: course.id } });
  } catch (e) {
    const authErr = await handleAuthError(e);
    if (authErr) return authErr;
    console.error("[admin/courses POST]", e);
    return errorResponse("Failed to create course", 500);
  }
}
