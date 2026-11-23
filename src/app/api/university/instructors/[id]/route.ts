import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  requireUniversity,
  requireUniversityOwner,
  handleAuthError,
  errorResponse,
} from "@/lib/auth";
import { hashPassword } from "@/lib/auth/server";
import {
  saveUploadedFile,
  validateExt,
  ALLOWED_IMAGE_EXT,
} from "@/lib/storage";

/** Verify instructor belongs to the logged-in university. */
async function verifyOwnership(id: string, universityId: string) {
  const inst = await db.instructor.findUnique({
    where: { id },
    select: { universityId: true },
  });
  if (!inst || inst.universityId !== universityId) return null;
  return inst;
}

function safeParseIds(raw: string): string[] {
  if (!raw) return [];
  try {
    const v = JSON.parse(raw);
    if (Array.isArray(v)) return v.filter((x) => typeof x === "string");
    return [];
  } catch {
    return [];
  }
}

/**
 * GET /api/university/instructors/[id]
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireUniversity();
    const { id } = await params;
    const owned = await verifyOwnership(id, user.universityId!);
    if (!owned) return errorResponse("Not found", 404);

    const inst = await db.instructor.findUnique({
      where: { id },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            profilePhoto: true,
            phone: true,
            bio: true,
            createdAt: true,
          },
        },
      },
    });
    if (!inst || inst.universityId !== user.universityId) {
      return errorResponse("Not found", 404);
    }

    const ids = safeParseIds(inst.assignedCourseIds);
    const courses = await db.course.findMany({
      where: { id: { in: ids } },
      select: { id: true, title: true, isPublished: true },
    });

    return NextResponse.json({
      instructor: {
        id: inst.id,
        userId: inst.userId,
        name: inst.user.name,
        email: inst.user.email,
        profilePhoto: inst.user.profilePhoto,
        phone: inst.user.phone,
        bio: inst.user.bio,
        isActive: inst.isActive,
        signatureUrl: inst.signatureUrl ?? null,
        assignedCourseIds: ids,
        assignedCourses: courses.map((c) => ({
          id: c.id,
          title: c.title,
          isPublished: c.isPublished,
        })),
        createdAt: inst.createdAt,
        userCreatedAt: inst.user.createdAt,
      },
    });
  } catch (e) {
    const authErr = await handleAuthError(e);
    if (authErr) return authErr;
    console.error("[university/instructors GET id]", e);
    return errorResponse("Failed to load instructor", 500);
  }
}

/**
 * PUT /api/university/instructors/[id]
 * Update an instructor's assigned courses, isActive, and/or basic profile
 * (name, phone, bio, password).
 * Body fields (all optional):
 *   assignedCourseIds?: string[]
 *   isActive?: boolean
 *   name?: string
 *   phone?: string | null
 *   bio?: string | null
 *   password?: string
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

    const contentType = req.headers.get("content-type") || "";
    let assignedCourseIds: string[] | undefined;
    let isActive: boolean | undefined;
    let name: string | undefined;
    let phone: string | null | undefined;
    let bio: string | null | undefined;
    let password: string | undefined;
    let signatureFile: File | null = null;
    let removeSignature = false;

    if (contentType.includes("multipart/form-data")) {
      const fd = await req.formData();
      const nameRaw = fd.get("name");
      if (typeof nameRaw === "string") name = nameRaw;
      const phoneRaw = fd.get("phone");
      if (typeof phoneRaw === "string") phone = phoneRaw;
      const bioRaw = fd.get("bio");
      if (typeof bioRaw === "string") bio = bioRaw;
      const passRaw = fd.get("password");
      if (typeof passRaw === "string" && passRaw.length > 0) password = passRaw;
      const activeRaw = fd.get("isActive");
      if (typeof activeRaw === "string") isActive = activeRaw !== "false";
      const assignedRaw = fd.get("assignedCourseIds");
      if (typeof assignedRaw === "string" && assignedRaw.trim()) {
        try {
          const parsed = JSON.parse(assignedRaw);
          if (Array.isArray(parsed)) assignedCourseIds = parsed;
        } catch {
          assignedCourseIds = [];
        }
      }
      const sig = fd.get("signature");
      if (sig && sig instanceof File && sig.size > 0) {
        signatureFile = sig;
      }
      removeSignature = fd.get("removeSignature") === "true";
    } else {
      const body = await req.json();
      ({
        assignedCourseIds,
        isActive,
        name,
        phone,
        bio,
        password,
      } = body as {
        assignedCourseIds?: string[];
        isActive?: boolean;
        name?: string;
        phone?: string | null;
        bio?: string | null;
        password?: string;
      });
      if (body.removeSignature === true) removeSignature = true;
    }

    if (name !== undefined && !name.trim()) {
      return errorResponse("Name is required", 400);
    }

    // Validate assignedCourseIds all belong to this university
    let finalIds: string[] | undefined;
    if (assignedCourseIds !== undefined) {
      finalIds = assignedCourseIds.filter(
        (x) => typeof x === "string" && x.length > 0
      );
      if (finalIds.length > 0) {
        const valid = await db.course.findMany({
          where: { id: { in: finalIds }, universityId: user.universityId },
          select: { id: true },
        });
        if (valid.length !== finalIds.length) {
          return errorResponse(
            "One or more assigned courses are not in your university",
            400
          );
        }
      }
    }

    let nextSignatureUrl: string | null | undefined = undefined;
    if (removeSignature) {
      nextSignatureUrl = null;
    }
    if (signatureFile) {
      const ext = "." + (signatureFile.name.split(".").pop() || "").toLowerCase();
      if (!validateExt(ext, ALLOWED_IMAGE_EXT)) {
        return errorResponse(
          `Invalid signature image extension. Allowed: ${ALLOWED_IMAGE_EXT.join(", ")}`,
          400
        );
      }
      const saved = await saveUploadedFile(signatureFile, "signatures");
      nextSignatureUrl = saved.url;
    }

    // Update the Instructor record
    await db.instructor.update({
      where: { id },
      data: {
        ...(isActive !== undefined ? { isActive: !!isActive } : {}),
        ...(finalIds !== undefined
          ? { assignedCourseIds: JSON.stringify(finalIds) }
          : {}),
        ...(nextSignatureUrl !== undefined
          ? { signatureUrl: nextSignatureUrl }
          : {}),
      },
    });

    // Update the User record for profile fields / password
    if (
      name !== undefined ||
      phone !== undefined ||
      bio !== undefined ||
      password !== undefined
    ) {
      const existing = await db.instructor.findUnique({
        where: { id },
        select: { userId: true },
      });
      if (!existing) return errorResponse("Instructor not found", 404);
      if (password !== undefined) {
        if (typeof password !== "string" || password.length < 6) {
          return errorResponse(
            "Password must be at least 6 characters",
            400
          );
        }
      }
      await db.user.update({
        where: { id: existing.userId },
        data: {
          ...(name !== undefined ? { name: name.trim() } : {}),
          ...(phone !== undefined ? { phone: phone?.trim() || null } : {}),
          ...(bio !== undefined ? { bio: bio?.trim() || null } : {}),
          ...(password
            ? { passwordHash: hashPassword(password) }
            : {}),
        },
      });
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    const authErr = await handleAuthError(e);
    if (authErr) return authErr;
    console.error("[university/instructors PUT]", e);
    return errorResponse("Failed to update instructor", 500);
  }
}

/**
 * DELETE /api/university/instructors/[id]
 * Deletes the Instructor record AND the underlying User (cascade).
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

    const inst = await db.instructor.findUnique({
      where: { id },
      select: { userId: true, universityId: true },
    });
    if (!inst || inst.universityId !== user.universityId) {
      return errorResponse("Not found", 404);
    }

    // Delete the user (cascade deletes the Instructor row due to onDelete: Cascade)
    await db.user.delete({ where: { id: inst.userId } });
    return NextResponse.json({ ok: true });
  } catch (e) {
    const authErr = await handleAuthError(e);
    if (authErr) return authErr;
    console.error("[university/instructors DELETE]", e);
    return errorResponse("Failed to delete instructor", 500);
  }
}
