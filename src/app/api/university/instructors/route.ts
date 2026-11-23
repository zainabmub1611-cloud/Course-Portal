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

/**
 * GET /api/university/instructors
 * List instructors for the logged-in university, with assigned course titles.
 */
export async function GET(req: Request) {
  try {
    const user = await requireUniversity();
    const universityId = user.universityId!;
    const url = new URL(req.url);
    const q = (url.searchParams.get("q") || "").trim().toLowerCase();
    const status = url.searchParams.get("status"); // "active" | "inactive"

    const instructors = await db.instructor.findMany({
      where: {
        universityId,
        ...(status === "active"
          ? { isActive: true }
          : status === "inactive"
            ? { isActive: false }
            : {}),
      },
      orderBy: { createdAt: "desc" },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            profilePhoto: true,
            phone: true,
            bio: true,
          },
        },
      },
    });

    // Map assignedCourseIds → course titles (only courses in this university)
    const universityCourses = await db.course.findMany({
      where: { universityId },
      select: { id: true, title: true, isPublished: true },
    });
    const courseMap = new Map(universityCourses.map((c) => [c.id, c]));

    const filtered = q
      ? instructors.filter(
          (i) =>
            i.user.name.toLowerCase().includes(q) ||
            i.user.email.toLowerCase().includes(q)
        )
      : instructors;

    return NextResponse.json({
      instructors: filtered.map((i) => {
        const ids: string[] = safeParseIds(i.assignedCourseIds);
        const assigned = ids
          .map((id) => courseMap.get(id))
          .filter(Boolean)
          .map((c) => ({ id: c!.id, title: c!.title, isPublished: c!.isPublished }));
        return {
          id: i.id,
          userId: i.userId,
          name: i.user.name,
          email: i.user.email,
          profilePhoto: i.user.profilePhoto,
          phone: i.user.phone,
          bio: i.user.bio,
          isActive: i.isActive,
          signatureUrl: i.signatureUrl ?? null,
          assignedCourses: assigned,
          assignedCourseIds: ids,
          createdAt: i.createdAt,
        };
      }),
      courses: universityCourses.map((c) => ({
        id: c.id,
        title: c.title,
        isPublished: c.isPublished,
      })),
    });
  } catch (e) {
    const authErr = await handleAuthError(e);
    if (authErr) return authErr;
    console.error("[university/instructors GET]", e);
    return errorResponse("Failed to load instructors", 500);
  }
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
 * POST /api/university/instructors
 * Create a new instructor user + Instructor record in this university.
 * Body: { name, email, password, assignedCourseIds?: string[], isActive?, phone?, bio? }
 */
export async function POST(req: Request) {
  try {
    const user = await requireUniversityOwner();
    const universityId = user.universityId!;
    const contentType = req.headers.get("content-type") || "";

    let name: string | undefined;
    let email: string | undefined;
    let password: string | undefined;
    let assignedCourseIds: string[] | undefined;
    let isActive: boolean | undefined;
    let phone: string | null | undefined;
    let bio: string | null | undefined;
    let signatureFile: File | null = null;

    if (contentType.includes("multipart/form-data")) {
      const fd = await req.formData();
      name = (fd.get("name") as string | null) ?? undefined;
      email = (fd.get("email") as string | null) ?? undefined;
      password = (fd.get("password") as string | null) ?? undefined;
      const phoneRaw = fd.get("phone");
      phone = typeof phoneRaw === "string" ? phoneRaw : null;
      const bioRaw = fd.get("bio");
      bio = typeof bioRaw === "string" ? bioRaw : null;
      const activeRaw = fd.get("isActive");
      isActive = activeRaw === null ? true : activeRaw !== "false";
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
    } else {
      const body = await req.json();
      ({ name, email, password, assignedCourseIds, isActive, phone, bio } =
        body as {
          name?: string;
          email?: string;
          password?: string;
          assignedCourseIds?: string[];
          isActive?: boolean;
          phone?: string | null;
          bio?: string | null;
        });
    }

    if (!name || !name.trim()) return errorResponse("Name is required", 400);
    if (!email || !email.trim())
      return errorResponse("Email is required", 400);
    if (!password || password.length < 6)
      return errorResponse("Password must be at least 6 characters", 400);

    const emailNorm = email.trim().toLowerCase();
    const existing = await db.user.findUnique({
      where: { email: emailNorm },
      select: { id: true },
    });
    if (existing)
      return errorResponse("Email is already in use", 409, "EMAIL_TAKEN");

    // Validate all assigned course IDs belong to this university
    const ids = Array.isArray(assignedCourseIds)
      ? assignedCourseIds.filter((x) => typeof x === "string")
      : [];
    if (ids.length > 0) {
      const valid = await db.course.findMany({
        where: { id: { in: ids }, universityId },
        select: { id: true },
      });
      if (valid.length !== ids.length) {
        return errorResponse(
          "One or more assigned courses are not in your university",
          400
        );
      }
    }

    let signatureUrl: string | null = null;
    if (signatureFile) {
      const ext = "." + (signatureFile.name.split(".").pop() || "").toLowerCase();
      if (!validateExt(ext, ALLOWED_IMAGE_EXT)) {
        return errorResponse(
          `Invalid signature image extension. Allowed: ${ALLOWED_IMAGE_EXT.join(", ")}`,
          400
        );
      }
      const saved = await saveUploadedFile(signatureFile, "signatures");
      signatureUrl = saved.url;
    }

    // Create the user with INSTRUCTOR role + Instructor record atomically
    const instructor = await db.$transaction(async (tx) => {
      const newUser = await tx.user.create({
        data: {
          name: name!.trim(),
          email: emailNorm,
          passwordHash: hashPassword(password!),
          role: "INSTRUCTOR",
          phone: phone?.trim() || null,
          bio: bio?.trim() || null,
        },
      });

      return tx.instructor.create({
        data: {
          universityId,
          userId: newUser.id,
          isActive: isActive !== undefined ? !!isActive : true,
          assignedCourseIds: JSON.stringify(ids),
          signatureUrl,
        },
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              profilePhoto: true,
              phone: true,
              bio: true,
            },
          },
        },
      });
    });

    return NextResponse.json({
      instructor: {
        id: instructor.id,
        userId: instructor.userId,
        name: instructor.user.name,
        email: instructor.user.email,
        profilePhoto: instructor.user.profilePhoto,
        phone: instructor.user.phone,
        bio: instructor.user.bio,
        isActive: instructor.isActive,
        signatureUrl: instructor.signatureUrl ?? null,
        assignedCourseIds: ids,
        createdAt: instructor.createdAt,
      },
    });
  } catch (e) {
    const authErr = await handleAuthError(e);
    if (authErr) return authErr;
    console.error("[university/instructors POST]", e);
    return errorResponse("Failed to create instructor", 500);
  }
}
