import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin, handleAuthError, errorResponse } from "@/lib/auth";
import { hashPassword } from "@/lib/auth/server";
import {
  saveUploadedFile,
  ALLOWED_IMAGE_EXT,
  validateExt,
} from "@/lib/storage";

/**
 * GET /api/admin/universities/[id]
 * Single university detail with its courses list.
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await requireAdmin();
    const { id } = await params;

    const university = await db.university.findUnique({
      where: { id },
      include: {
        user: { select: { email: true, createdAt: true } },
        courses: {
          orderBy: { createdAt: "desc" },
          select: {
            id: true,
            title: true,
            description: true,
            thumbnail: true,
            category: true,
            accessType: true,
            isPublished: true,
            createdAt: true,
            _count: {
              select: {
                videos: { where: { isPublished: true } },
                topics: true,
                assignments: true,
              },
            },
          },
        },
        _count: { select: { courses: true } },
      },
    });

    if (!university) return errorResponse("University not found", 404);

    return NextResponse.json({
      university: {
        id: university.id,
        name: university.name,
        logo: university.logo,
        description: university.description,
        email: university.user.email,
        createdAt: university.createdAt,
        updatedAt: university.updatedAt,
        courseCount: university._count.courses,
        courses: university.courses.map((c) => ({
          id: c.id,
          title: c.title,
          description: c.description,
          thumbnail: c.thumbnail,
          category: c.category,
          accessType: c.accessType,
          isPublished: c.isPublished,
          createdAt: c.createdAt,
          videosCount: c._count.videos,
          topicsCount: c._count.topics,
          assignmentsCount: c._count.assignments,
        })),
      },
    });
  } catch (e) {
    const authErr = await handleAuthError(e);
    if (authErr) return authErr;
    console.error("[admin/universities GET id]", e);
    return errorResponse("Failed to load university", 500);
  }
}

/**
 * PUT /api/admin/universities/[id]
 * Update university fields + optionally the linked user's email/password.
 * Accepts FormData: name?, description?, email?, password?, logo? (File)
 */
export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await requireAdmin();
    const { id } = await params;

    const existing = await db.university.findUnique({
      where: { id },
      include: { user: { select: { id: true, email: true } } },
    });
    if (!existing) return errorResponse("University not found", 404);

    let name: string | undefined;
    let description: string | null | undefined;
    let email: string | undefined;
    let password: string | undefined;
    let logoFile: File | null = null;

    const contentType = req.headers.get("content-type") || "";
    if (contentType.includes("multipart/form-data")) {
      const formData = await req.formData();
      const nameVal = formData.get("name") as string | null;
      const descVal = formData.get("description") as string | null;
      const emailVal = formData.get("email") as string | null;
      const passVal = formData.get("password") as string | null;
      if (nameVal !== null) name = nameVal.trim();
      if (descVal !== null) description = descVal.trim();
      if (emailVal !== null) email = emailVal.trim();
      if (passVal !== null) password = passVal;
      const file = formData.get("logo");
      if (file && file instanceof File && file.size > 0) logoFile = file;
    } else {
      const body = await req.json();
      if (body.name !== undefined) name = String(body.name).trim();
      if (body.description !== undefined)
        description = body.description ? String(body.description).trim() : null;
      if (body.email !== undefined) email = String(body.email).trim();
      if (body.password !== undefined) password = String(body.password);
    }

    // Validate password length if provided
    if (password && password.length < 6) {
      return errorResponse("Password must be at least 6 characters", 400);
    }

    // Validate email uniqueness if changing
    if (email && email.toLowerCase() !== existing.user.email.toLowerCase()) {
      const normalizedEmail = email.toLowerCase().trim();
      const conflict = await db.user.findUnique({
        where: { email: normalizedEmail },
      });
      if (conflict && conflict.id !== existing.user.id) {
        return errorResponse("Email already registered", 409);
      }
    }

    // Save logo (optional)
    let logoUrl: string | null = null;
    if (logoFile) {
      const ext = "." + (logoFile.name.split(".").pop() || "").toLowerCase();
      if (!validateExt(ext, ALLOWED_IMAGE_EXT)) {
        return errorResponse(
          `Invalid image extension. Allowed: ${ALLOWED_IMAGE_EXT.join(", ")}`,
          400,
        );
      }
      const saved = await saveUploadedFile(logoFile, "university-logos");
      logoUrl = saved.url;
    }

    await db.$transaction(async (tx) => {
      // Update university fields
      await tx.university.update({
        where: { id },
        data: {
          ...(name !== undefined ? { name } : {}),
          ...(description !== undefined ? { description: description || null } : {}),
          ...(logoUrl !== null ? { logo: logoUrl } : {}),
        },
      });

      // Update linked user's email / password if provided
      const userUpdate: Record<string, string> = {};
      if (name) userUpdate.name = name;
      if (email) userUpdate.email = email.toLowerCase().trim();
      if (password) userUpdate.passwordHash = hashPassword(password);
      if (Object.keys(userUpdate).length > 0) {
        await tx.user.update({
          where: { id: existing.user.id },
          data: userUpdate,
        });
      }
    });

    const refreshed = await db.university.findUnique({
      where: { id },
      include: { user: { select: { email: true } } },
    });

    return NextResponse.json({
      university: {
        id: refreshed!.id,
        name: refreshed!.name,
        logo: refreshed!.logo,
        description: refreshed!.description,
        email: refreshed!.user.email,
        createdAt: refreshed!.createdAt,
      },
    });
  } catch (e) {
    const authErr = await handleAuthError(e);
    if (authErr) return authErr;
    console.error("[admin/universities PUT]", e);
    return errorResponse("Failed to update university", 500);
  }
}

/**
 * DELETE /api/admin/universities/[id]
 * Delete the university, all of its teachers/instructors (including their
 * login User accounts), all of its courses (and nested lessons, topics,
 * materials, video progress, assessments, assignments, submissions,
 * certificates, discussions, notes, bookmarks, announcements, and
 * notifications), and its linked university User account permanently.
 */
export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await requireAdmin();
    const { id } = await params;

    const existing = await db.university.findUnique({
      where: { id },
      include: { user: { select: { id: true, role: true } } },
    });
    if (!existing) return errorResponse("University not found", 404);

    await db.$transaction(async (tx) => {
      const [instructors, uniCourses] = await Promise.all([
        tx.instructor.findMany({
          where: { universityId: id },
          select: { userId: true },
        }),
        tx.course.findMany({
          where: { universityId: id },
          select: { id: true },
        }),
      ]);

      const courseIds = uniCourses.map((c) => c.id);
      const instructorUserIds = Array.from(
        new Set(
          instructors
            .map((inst) => inst.userId)
            .filter((uid) => uid && uid !== existing.user.id),
        ),
      );

      const [assignments, discussions, announcements] = await Promise.all([
        courseIds.length > 0
          ? tx.assignment.findMany({
              where: { courseId: { in: courseIds } },
              select: { id: true },
            })
          : Promise.resolve([]),
        courseIds.length > 0
          ? tx.discussion.findMany({
              where: { courseId: { in: courseIds } },
              select: { id: true },
            })
          : Promise.resolve([]),
        tx.announcement.findMany({
          where:
            courseIds.length > 0
              ? { OR: [{ universityId: id }, { courseId: { in: courseIds } }] }
              : { universityId: id },
          select: { id: true },
        }),
      ]);

      const relatedIds = [
        ...courseIds,
        ...assignments.map((a) => a.id),
        ...discussions.map((d) => d.id),
        ...announcements.map((a) => a.id),
      ];

      if (relatedIds.length > 0) {
        await tx.notification.deleteMany({
          where: { relatedId: { in: relatedIds } },
        });
      }

      if (courseIds.length > 0) {
        await tx.note.deleteMany({ where: { courseId: { in: courseIds } } });
        await tx.bookmark.deleteMany({ where: { courseId: { in: courseIds } } });
        await tx.course.deleteMany({ where: { id: { in: courseIds } } });
      }

      // Deleting the linked university User cascades to University, Instructors, and Announcements.
      await tx.user.delete({ where: { id: existing.user.id } });

      // Remove each teacher/instructor's login User account as well so they cannot log in or remain orphaned.
      if (instructorUserIds.length > 0) {
        await tx.user.deleteMany({ where: { id: { in: instructorUserIds } } });
      }
    });

    return NextResponse.json({ ok: true });
  } catch (e) {
    const authErr = await handleAuthError(e);
    if (authErr) return authErr;
    console.error("[admin/universities DELETE]", e);
    return errorResponse("Failed to delete university", 500);
  }
}

export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  return PUT(req, ctx);
}
