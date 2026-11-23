import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  requireUniversity,
  requireUniversityOwner,
  handleAuthError,
  errorResponse,
} from "@/lib/auth";

/**
 * GET /api/university/courses
 * List courses owned by the logged-in university.
 */
export async function GET(req: Request) {
  try {
    const user = await requireUniversity();
    const universityId = user.universityId!;
    const url = new URL(req.url);
    const q = (url.searchParams.get("q") || "").trim().toLowerCase();
    const category = url.searchParams.get("category") || "";
    const published = url.searchParams.get("published"); // "true" | "false"
    const restrictedCourseIds =
      user.role === "INSTRUCTOR" ? user.assignedCourseIds ?? [] : null;

    const courses = await db.course.findMany({
      where: {
        universityId,
        ...(restrictedCourseIds ? { id: { in: restrictedCourseIds } } : {}),
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
          thumbnail: c.thumbnail || firstVideo?.thumbnail || null,
          firstVideoUrl: firstVideo?.videoUrl || null,
          firstVideoSource: firstVideo?.source || null,
          category: c.category,
          level: c.level,
          accessType: c.accessType,
          isPublished: c.isPublished,
          startDate: c.startDate,
          endDate: c.endDate,
          availabilityMode: c.availabilityMode,
          enrollmentOpen: c.enrollmentOpen,
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
    console.error("[university/courses GET]", e);
    return errorResponse("Failed to load courses", 500);
  }
}

/**
 * POST /api/university/courses
 * Create a course auto-scoped to the logged-in university.
 */
export async function POST(req: Request) {
  try {
    const user = await requireUniversityOwner();
    const universityId = user.universityId!;
    const body = await req.json();
    const {
      title,
      description,
      thumbnail,
      category,
      level,
      accessType,
      isPublished,
      planIds = [],
      startDate,
      endDate,
      availabilityMode,
      enrollmentOpen,
      instructorId,
    } = body as {
      title?: string;
      description?: string;
      thumbnail?: string;
      category?: string;
      level?: "BEGINNER" | "INTERMEDIATE" | "ADVANCED";
      accessType?: "FREE" | "PAID";
      isPublished?: boolean;
      planIds?: string[];
      startDate?: string | null;
      endDate?: string | null;
      availabilityMode?: "ALWAYS" | "SCHEDULED" | "LIMITED";
      enrollmentOpen?: boolean;
      instructorId?: string;
    };

    if (!title || !title.trim()) {
      return errorResponse("Title is required", 400);
    }
    if (typeof instructorId !== "string" || !instructorId.trim()) {
      return errorResponse("An instructor must be assigned to the course", 400);
    }
    const assignedInstructorId = instructorId.trim();
    const aType = accessType === "PAID" ? "PAID" : "FREE";
    const validLevel =
      level === "INTERMEDIATE" || level === "ADVANCED" ? level : "BEGINNER";
    const validMode =
      availabilityMode === "SCHEDULED" || availabilityMode === "LIMITED"
        ? availabilityMode
        : "ALWAYS";

    // Parse dates (allow null/empty to clear)
    const startDateParsed =
      startDate === null || startDate === ""
        ? null
        : startDate
          ? new Date(startDate)
          : null;
    const endDateParsed =
      endDate === null || endDate === ""
        ? null
        : endDate
          ? new Date(endDate)
          : null;

    if (
      startDateParsed &&
      endDateParsed &&
      endDateParsed < startDateParsed
    ) {
      return errorResponse("End date must be after start date", 400);
    }

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

    const course = await db.$transaction(async (tx) => {
      const instructor = await tx.instructor.findFirst({
        where: { id: assignedInstructorId, universityId, isActive: true },
        select: { id: true, assignedCourseIds: true },
      });
      if (!instructor) return null;

      const createdCourse = await tx.course.create({
        data: {
          title: title.trim(),
          description: description?.trim() || null,
          thumbnail: thumbnail?.trim() || null,
          category: category?.trim() || null,
          level: validLevel,
          accessType: aType,
          isPublished: !!isPublished,
          universityId,
          availabilityMode: validMode,
          startDate: startDateParsed,
          endDate: endDateParsed,
          enrollmentOpen: enrollmentOpen === undefined ? true : !!enrollmentOpen,
        },
      });

      const assignedCourseIds = parseAssignedCourseIds(instructor.assignedCourseIds);
      await tx.instructor.update({
        where: { id: instructor.id },
        data: {
          assignedCourseIds: JSON.stringify(
            Array.from(new Set([...assignedCourseIds, createdCourse.id]))
          ),
        },
      });

      if (aType === "PAID" && planIds.length > 0) {
        await tx.coursePlanAccess.createMany({
          data: planIds.map((pid) => ({ courseId: createdCourse.id, planId: pid })),
        });
      }

      return createdCourse;
    });

    if (!course) {
      return errorResponse("Select an active instructor from your university", 400);
    }

    return NextResponse.json({ course: { id: course.id } });
  } catch (e) {
    const authErr = await handleAuthError(e);
    if (authErr) return authErr;
    console.error("[university/courses POST]", e);
    return errorResponse("Failed to create course", 500);
  }
}

function parseAssignedCourseIds(raw: string | null | undefined): string[] {
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed)
      ? parsed.filter((id): id is string => typeof id === "string")
      : [];
  } catch {
    return [];
  }
}
