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

interface SocialLinks {
  twitter?: string;
  facebook?: string;
  linkedin?: string;
  instagram?: string;
}

function parseSocialLinks(raw: string | null): SocialLinks {
  if (!raw) return {};
  try {
    const v = JSON.parse(raw);
    if (v && typeof v === "object") return v as SocialLinks;
  } catch {
    /* ignore */
  }
  return {};
}

/**
 * GET /api/university/branding
 * Returns the logged-in university's branding info.
 */
export async function GET() {
  try {
    const user = await requireUniversity();
    const uni = await db.university.findUnique({
      where: { id: user.universityId! },
      select: {
        id: true,
        name: true,
        logo: true,
        coverImage: true,
        description: true,
        website: true,
        contactEmail: true,
        contactPhone: true,
        location: true,
        socialLinks: true,
      },
    });
    if (!uni) return errorResponse("University not found", 404);

    return NextResponse.json({
      branding: {
        id: uni.id,
        name: uni.name,
        logo: uni.logo,
        coverImage: uni.coverImage,
        description: uni.description,
        website: uni.website,
        contactEmail: uni.contactEmail,
        contactPhone: uni.contactPhone,
        location: uni.location,
        socialLinks: parseSocialLinks(uni.socialLinks),
      },
    });
  } catch (e) {
    const authErr = await handleAuthError(e);
    if (authErr) return authErr;
    console.error("[university/branding GET]", e);
    return errorResponse("Failed to load branding", 500);
  }
}

/**
 * PUT /api/university/branding
 * Accepts multipart/form-data for logo/cover uploads alongside JSON fields.
 * Fields:
 *   name?, description?, website?, contactEmail?, contactPhone?, location?,
 *   socialLinks (JSON string), logoFile (File, optional), coverFile (File, optional)
 */
export async function PUT(req: Request) {
  try {
    const user = await requireUniversityOwner();
    const form = await req.formData();

    const name = (form.get("name") as string) || undefined;
    const description = (form.get("description") as string) || undefined;
    const website = (form.get("website") as string) || undefined;
    const contactEmail = (form.get("contactEmail") as string) || undefined;
    const contactPhone = (form.get("contactPhone") as string) || undefined;
    const location = (form.get("location") as string) || undefined;
    const socialLinksRaw = (form.get("socialLinks") as string) || undefined;

    const logoFile = form.get("logoFile");
    const coverFile = form.get("coverFile");

    if (name !== undefined && !name.trim()) {
      return errorResponse("University name cannot be empty", 400);
    }

    let logoUrl: string | undefined;
    let coverUrl: string | undefined;

    if (logoFile && logoFile instanceof File && logoFile.size > 0) {
      const ext = "." + (logoFile.name.split(".").pop() || "").toLowerCase();
      if (!validateExt(ext, ALLOWED_IMAGE_EXT)) {
        return errorResponse(
          `Invalid logo extension. Allowed: ${ALLOWED_IMAGE_EXT.join(", ")}`,
          400
        );
      }
      const saved = await saveUploadedFile(logoFile, "branding");
      logoUrl = saved.url;
    }

    if (coverFile && coverFile instanceof File && coverFile.size > 0) {
      const ext = "." + (coverFile.name.split(".").pop() || "").toLowerCase();
      if (!validateExt(ext, ALLOWED_IMAGE_EXT)) {
        return errorResponse(
          `Invalid cover image extension. Allowed: ${ALLOWED_IMAGE_EXT.join(", ")}`,
          400
        );
      }
      const saved = await saveUploadedFile(coverFile, "branding");
      coverUrl = saved.url;
    }

    // Parse social links if provided
    let socialLinksJson: string | undefined;
    if (socialLinksRaw !== undefined) {
      try {
        const parsed = JSON.parse(socialLinksRaw);
        if (parsed && typeof parsed === "object") {
          socialLinksJson = JSON.stringify({
            twitter: typeof parsed.twitter === "string" ? parsed.twitter : "",
            facebook: typeof parsed.facebook === "string" ? parsed.facebook : "",
            linkedin: typeof parsed.linkedin === "string" ? parsed.linkedin : "",
            instagram: typeof parsed.instagram === "string" ? parsed.instagram : "",
          });
        } else {
          return errorResponse("socialLinks must be a JSON object", 400);
        }
      } catch {
        return errorResponse("socialLinks is not valid JSON", 400);
      }
    }

    // Fetch existing socialLinks to merge if needed
    const existing = await db.university.findUnique({
      where: { id: user.universityId! },
      select: { socialLinks: true },
    });
    if (!existing) return errorResponse("University not found", 404);

    // If socialLinksRaw provided partial fields, merge with existing
    let finalSocialLinks: string | undefined = socialLinksJson;
    if (socialLinksRaw !== undefined && socialLinksJson) {
      // already a full merged object per above
      finalSocialLinks = socialLinksJson;
    }

    await db.university.update({
      where: { id: user.universityId! },
      data: {
        ...(name !== undefined ? { name: name.trim() } : {}),
        ...(description !== undefined
          ? { description: description.trim() || null }
          : {}),
        ...(website !== undefined ? { website: website.trim() || null } : {}),
        ...(contactEmail !== undefined
          ? { contactEmail: contactEmail.trim() || null }
          : {}),
        ...(contactPhone !== undefined
          ? { contactPhone: contactPhone.trim() || null }
          : {}),
        ...(location !== undefined
          ? { location: location.trim() || null }
          : {}),
        ...(finalSocialLinks !== undefined ? { socialLinks: finalSocialLinks } : {}),
        ...(logoUrl !== undefined ? { logo: logoUrl } : {}),
        ...(coverUrl !== undefined ? { coverImage: coverUrl } : {}),
      },
    });

    const updated = await db.university.findUnique({
      where: { id: user.universityId! },
      select: {
        id: true,
        name: true,
        logo: true,
        coverImage: true,
        description: true,
        website: true,
        contactEmail: true,
        contactPhone: true,
        location: true,
        socialLinks: true,
      },
    });

    return NextResponse.json({
      branding: updated
        ? {
            ...updated,
            socialLinks: parseSocialLinks(updated.socialLinks),
          }
        : null,
    });
  } catch (e) {
    const authErr = await handleAuthError(e);
    if (authErr) return authErr;
    console.error("[university/branding PUT]", e);
    return errorResponse("Failed to update branding", 500);
  }
}

export async function POST(req: Request) {
  return PUT(req);
}

export async function PATCH(req: Request) {
  return PUT(req);
}
