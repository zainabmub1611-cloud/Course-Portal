import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  requireUniversity,
  requireUniversityOwner,
  handleAuthError,
  errorResponse,
} from "@/lib/auth";
import {
  saveUploadedFile,
  validateExt,
  ALLOWED_IMAGE_EXT,
} from "@/lib/storage";

/**
 * GET /api/university/profile
 * Return the logged-in university's profile info.
 */
export async function GET() {
  try {
    const user = await requireUniversity();
    const university = await db.university.findUnique({
      where: { id: user.universityId! },
      select: {
        id: true,
        name: true,
        logo: true,
        description: true,
        createdAt: true,
        updatedAt: true,
      },
    });
    if (!university) return errorResponse("University not found", 404);

    return NextResponse.json({
      university: {
        ...university,
        contactName: user.name,
        contactEmail: user.email,
        contactPhone: user.phone,
        bio: user.bio,
      },
    });
  } catch (e) {
    const authErr = await handleAuthError(e);
    if (authErr) return authErr;
    console.error("[university/profile GET]", e);
    return errorResponse("Failed to load profile", 500);
  }
}

/**
 * PUT /api/university/profile
 * Update the university's description (and contact user's phone/bio).
 */
export async function PUT(req: Request) {
  try {
    const user = await requireUniversityOwner();
    const body = await req.json();
    const { name, description, phone, bio } = body as {
      name?: string;
      description?: string | null;
      phone?: string | null;
      bio?: string | null;
    };

    if (name !== undefined && !name.trim()) {
      return errorResponse("University name cannot be empty", 400);
    }

    // Update the University record if name/description provided
    if (name !== undefined || description !== undefined) {
      await db.university.update({
        where: { id: user.universityId! },
        data: {
          ...(name !== undefined ? { name: name.trim() } : {}),
          ...(description !== undefined
            ? { description: description?.trim() || null }
            : {}),
        },
      });
    }

    // Update the contact user's profile fields
    if (phone !== undefined || bio !== undefined) {
      await db.user.update({
        where: { id: user.id },
        data: {
          ...(phone !== undefined ? { phone: phone?.trim() || null } : {}),
          ...(bio !== undefined ? { bio: bio?.trim() || null } : {}),
        },
      });
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    const authErr = await handleAuthError(e);
    if (authErr) return authErr;
    console.error("[university/profile PUT]", e);
    return errorResponse("Failed to update profile", 500);
  }
}

/**
 * POST /api/university/profile
 * Upload a new logo for the university.
 */
export async function POST(req: Request) {
  try {
    const user = await requireUniversityOwner();
    const formData = await req.formData();
    const file = formData.get("file");
    if (!file || !(file instanceof File) || file.size === 0) {
      return errorResponse("No file uploaded", 400);
    }
    const ext = "." + (file.name.split(".").pop() || "").toLowerCase();
    if (!validateExt(ext, ALLOWED_IMAGE_EXT)) {
      return errorResponse(
        `Invalid image extension. Allowed: ${ALLOWED_IMAGE_EXT.join(", ")}`,
        400
      );
    }

    const saved = await saveUploadedFile(file, "logos");
    await db.university.update({
      where: { id: user.universityId! },
      data: { logo: saved.url },
    });

    return NextResponse.json({ logo: saved.url });
  } catch (e) {
    const authErr = await handleAuthError(e);
    if (authErr) return authErr;
    console.error("[university/profile logo]", e);
    return errorResponse("Failed to upload logo", 500);
  }
}
