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
 * GET /api/admin/universities
 * List all universities with course counts and email of the linked user.
 */
export async function GET(req: Request) {
  try {
    await requireAdmin();
    const url = new URL(req.url);
    const q = (url.searchParams.get("q") || "").trim().toLowerCase();

    const universities = await db.university.findMany({
      where: q
        ? {
            OR: [
              { name: { contains: q } },
              { user: { email: { contains: q } } },
            ],
          }
        : undefined,
      orderBy: { createdAt: "desc" },
      include: {
        user: { select: { email: true } },
        _count: { select: { courses: true } },
      },
    });

    return NextResponse.json({
      universities: universities.map((u) => ({
        id: u.id,
        name: u.name,
        logo: u.logo,
        description: u.description,
        email: u.user.email,
        createdAt: u.createdAt,
        courseCount: u._count.courses,
      })),
    });
  } catch (e) {
    const authErr = await handleAuthError(e);
    if (authErr) return authErr;
    console.error("[admin/universities GET]", e);
    return errorResponse("Failed to load universities", 500);
  }
}

/**
 * POST /api/admin/universities
 * Create a University + its login User account (role=UNIVERSITY).
 * Accepts FormData: name, email, password, description?, logo? (File)
 */
export async function POST(req: Request) {
  try {
    await requireAdmin();

    let name: string | null = null;
    let email: string | null = null;
    let password: string | null = null;
    let description: string | null = null;
    let logoFile: File | null = null;

    const contentType = req.headers.get("content-type") || "";
    if (contentType.includes("multipart/form-data")) {
      const formData = await req.formData();
      name = (formData.get("name") as string | null)?.trim() || null;
      email = (formData.get("email") as string | null)?.trim() || null;
      password = (formData.get("password") as string | null) || null;
      description =
        (formData.get("description") as string | null)?.trim() || null;
      const file = formData.get("logo");
      if (file && file instanceof File && file.size > 0) logoFile = file;
    } else {
      const body = await req.json();
      name = (body.name as string | undefined)?.trim() || null;
      email = (body.email as string | undefined)?.trim() || null;
      password = (body.password as string | undefined) || null;
      description = (body.description as string | undefined)?.trim() || null;
    }

    if (!name) return errorResponse("University name is required", 400);
    if (!email) return errorResponse("Email is required", 400);
    if (!password) return errorResponse("Password is required", 400);
    if (password.length < 6) {
      return errorResponse("Password must be at least 6 characters", 400);
    }

    const normalizedEmail = email.toLowerCase().trim();
    const existing = await db.user.findUnique({
      where: { email: normalizedEmail },
    });
    if (existing) return errorResponse("Email already registered", 409);

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

    // Create the login User + the University record atomically
    const created = await db.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          name: name!.trim(),
          email: normalizedEmail,
          passwordHash: hashPassword(password!),
          role: "UNIVERSITY",
        },
      });

      const university = await tx.university.create({
        data: {
          name: name!.trim(),
          logo: logoUrl,
          description: description || null,
          userId: user.id,
        },
      });

      return { user, university };
    });

    return NextResponse.json(
      {
        university: {
          id: created.university.id,
          name: created.university.name,
          logo: created.university.logo,
          description: created.university.description,
          email: created.user.email,
          createdAt: created.university.createdAt,
        },
      },
      { status: 201 },
    );
  } catch (e) {
    const authErr = await handleAuthError(e);
    if (authErr) return authErr;
    console.error("[admin/universities POST]", e);
    return errorResponse("Failed to create university", 500);
  }
}
