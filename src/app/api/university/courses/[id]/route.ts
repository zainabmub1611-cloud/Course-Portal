import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  requireUniversity,
  requireUniversityOwner,
  canInstructorAccessCourse,
  handleAuthError,
  errorResponse,
} from "@/lib/auth";

/** Verify the given course belongs to the logged-in university. */
async function verifyOwnership(courseId: string, universityId: string) {
  const course = await db.course.findUnique({
    where: { id: courseId },
    select: { universityId: true },
  });
  if (!course || course.universityId !== universityId) return null;
  return course;
}

/**
 * GET /api/university/courses/[id]
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireUniversity();
    const { id } = await params;
    if (!canInstructorAccessCourse(user, id)) {
      return errorResponse("Not found", 404);
    }
    const owned = await verifyOwnership(id, user.universityId!);
    if (!owned) return errorResponse("Not found", 404);

    const course = await db.course.findUnique({
      where: { id },
      include: {
        topics: {
          orderBy: { displayOrder: "asc" },
          include: {
            videos: { orderBy: { displayOrder: "asc" } },
            materials: { orderBy: { createdAt: "desc" } },
          },
        },
        materials: {
          orderBy: { createdAt: "desc" },
          include: { topic: { select: { id: true, title: true } } },
        },
        assignments: {
          orderBy: { createdAt: "desc" },
          include: { _count: { select: { submissions: true } } },
        },
        certificateTemplate: true,
        planAccess: {
          include: { plan: { select: { id: true, name: true } } },
        },
      },
    });
    if (!course || course.universityId !== user.universityId) {
      return errorResponse("Not found", 404);
    }

    return NextResponse.json({
      course: {
        id: course.id,
        title: course.title,
        description: course.description,
        thumbnail: course.thumbnail,
        category: course.category,
        level: course.level,
        accessType: course.accessType,
        isPublished: course.isPublished,
        startDate: course.startDate,
        endDate: course.endDate,
        availabilityMode: course.availabilityMode,
        enrollmentOpen: course.enrollmentOpen,
        createdAt: course.createdAt,
        updatedAt: course.updatedAt,
        topics: course.topics.map((t) => ({
          id: t.id,
          title: t.title,
          description: t.description,
          displayOrder: t.displayOrder,
          videos: t.videos.map((v) => ({
            id: v.id,
            title: v.title,
            description: v.description,
            source: v.source,
            videoUrl: v.videoUrl,
            thumbnail: v.thumbnail,
            displayOrder: v.displayOrder,
            isPublished: v.isPublished,
            duration: v.duration,
          })),
          materials: t.materials.map((m) => ({
            id: m.id,
            title: m.title,
            description: m.description,
            type: m.type,
            fileUrl: m.fileUrl,
            isPublished: m.isPublished,
          })),
        })),
        materials: course.materials.map((m) => ({
          id: m.id,
          title: m.title,
          description: m.description,
          type: m.type,
          fileUrl: m.fileUrl,
          isPublished: m.isPublished,
          topic: m.topic,
        })),
        assignments: course.assignments.map((a) => ({
          id: a.id,
          title: a.title,
          description: a.description,
          instructions: a.instructions,
          fileUrl: a.fileUrl,
          dueDate: a.dueDate,
          isPublished: a.isPublished,
          allowResubmission: a.allowResubmission,
          submissionsCount: a._count.submissions,
          createdAt: a.createdAt,
        })),
        certificateTemplate: course.certificateTemplate
          ? {
              id: course.certificateTemplate.id,
              isEnabled: course.certificateTemplate.isEnabled,
              title: course.certificateTemplate.title,
              bodyText: course.certificateTemplate.bodyText,
              organizationName: course.certificateTemplate.organizationName,
              layout: course.certificateTemplate.layout,
            }
          : null,
        planAccess: course.planAccess.map((p) => ({
          id: p.id,
          planId: p.planId,
          planName: p.plan.name,
        })),
      },
    });
  } catch (e) {
    const authErr = await handleAuthError(e);
    if (authErr) return authErr;
    console.error("[university/courses GET id]", e);
    return errorResponse("Failed to load course", 500);
  }
}

/**
 * PUT /api/university/courses/[id]
 */
export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireUniversityOwner();
    const { id } = await params;
    const owned = await verifyOwnership(id, user.universityId!);
    if (!owned) return errorResponse("Not found", 404);

    const body = await req.json();
    const {
      title,
      description,
      thumbnail,
      category,
      level,
      accessType,
      isPublished,
      planIds,
      startDate,
      endDate,
      availabilityMode,
      enrollmentOpen,
    } = body as {
      title?: string;
      description?: string | null;
      thumbnail?: string | null;
      category?: string | null;
      level?: "BEGINNER" | "INTERMEDIATE" | "ADVANCED";
      accessType?: "FREE" | "PAID";
      isPublished?: boolean;
      planIds?: string[];
      startDate?: string | null;
      endDate?: string | null;
      availabilityMode?: "ALWAYS" | "SCHEDULED" | "LIMITED";
      enrollmentOpen?: boolean;
    };

    const existing = await db.course.findUnique({ where: { id } });
    if (!existing || existing.universityId !== user.universityId) {
      return errorResponse("Not found", 404);
    }

    const aType =
      accessType === "PAID"
        ? "PAID"
        : accessType === "FREE"
        ? "FREE"
        : existing.accessType;

    const validLevel =
      level === "INTERMEDIATE" || level === "ADVANCED" || level === "BEGINNER"
        ? level
        : existing.level;
    const validMode =
      availabilityMode === "SCHEDULED" ||
      availabilityMode === "LIMITED" ||
      availabilityMode === "ALWAYS"
        ? availabilityMode
        : existing.availabilityMode;

    // Parse dates — allow null/empty to clear
    const startDateParsed =
      startDate === undefined
        ? undefined
        : startDate === null || startDate === ""
          ? null
          : new Date(startDate);
    const endDateParsed =
      endDate === undefined
        ? undefined
        : endDate === null || endDate === ""
          ? null
          : new Date(endDate);

    if (
      startDateParsed &&
      endDateParsed &&
      endDateParsed < startDateParsed
    ) {
      return errorResponse("End date must be after start date", 400);
    }

    if (aType === "PAID" && planIds && planIds.length === 0) {
      return errorResponse("Paid courses must specify at least one plan", 400);
    }

    await db.course.update({
      where: { id },
      data: {
        ...(title !== undefined ? { title: title.trim() } : {}),
        ...(description !== undefined
          ? { description: description?.trim() || null }
          : {}),
        ...(thumbnail !== undefined ? { thumbnail: thumbnail?.trim() || null } : {}),
        ...(category !== undefined ? { category: category?.trim() || null } : {}),
        ...(level !== undefined ? { level: validLevel } : {}),
        ...(accessType !== undefined ? { accessType: aType } : {}),
        ...(isPublished !== undefined ? { isPublished: !!isPublished } : {}),
        ...(availabilityMode !== undefined ? { availabilityMode: validMode } : {}),
        ...(startDateParsed !== undefined ? { startDate: startDateParsed } : {}),
        ...(endDateParsed !== undefined ? { endDate: endDateParsed } : {}),
        ...(enrollmentOpen !== undefined ? { enrollmentOpen: !!enrollmentOpen } : {}),
      },
    });

    if (planIds !== undefined) {
      if (aType === "FREE") {
        await db.coursePlanAccess.deleteMany({ where: { courseId: id } });
      } else {
        if (planIds.length > 0) {
          const found = await db.subscriptionPlan.findMany({
            where: { id: { in: planIds } },
            select: { id: true },
          });
          if (found.length !== planIds.length) {
            return errorResponse("One or more plans not found", 400);
          }
        }
        await db.coursePlanAccess.deleteMany({ where: { courseId: id } });
        if (planIds.length > 0) {
          await db.coursePlanAccess.createMany({
            data: planIds.map((pid) => ({ courseId: id, planId: pid })),
          });
        }
      }
    }

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    const authErr = await handleAuthError(e);
    if (authErr) return authErr;
    console.error("[university/courses PUT]", e);
    // Return the specific error message for debugging
    const errMsg = e?.message || "Failed to update course";
    return errorResponse(errMsg, 500);
  }
}

/**
 * DELETE /api/university/courses/[id]
 */
export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireUniversityOwner();
    const { id } = await params;
    const owned = await verifyOwnership(id, user.universityId!);
    if (!owned) return errorResponse("Not found", 404);

    await db.$transaction(async (tx) => {
      const [assignments, discussions, announcements] = await Promise.all([
        tx.assignment.findMany({ where: { courseId: id }, select: { id: true } }),
        tx.discussion.findMany({ where: { courseId: id }, select: { id: true } }),
        tx.announcement.findMany({ where: { courseId: id }, select: { id: true } }),
      ]);
      const relatedIds = [
        id,
        ...assignments.map((a) => a.id),
        ...discussions.map((d) => d.id),
        ...announcements.map((a) => a.id),
      ];
      await tx.notification.deleteMany({ where: { relatedId: { in: relatedIds } } });
      await tx.note.deleteMany({ where: { courseId: id } });
      await tx.bookmark.deleteMany({ where: { courseId: id } });
      await tx.course.delete({ where: { id } });
    });

    return NextResponse.json({ ok: true });
  } catch (e) {
    const authErr = await handleAuthError(e);
    if (authErr) return authErr;
    console.error("[university/courses DELETE]", e);
    return errorResponse("Failed to delete course", 500);
  }
}
