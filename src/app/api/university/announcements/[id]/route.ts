import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  requireUniversityOwner,
  handleAuthError,
  errorResponse,
} from "@/lib/auth";
import {
  saveUploadedFile,
  validateExt,
  ALLOWED_IMAGE_EXT,
} from "@/lib/storage";

/** Verify announcement belongs to the logged-in university. */
async function verifyOwnership(id: string, universityId: string) {
  const ann = await db.announcement.findUnique({
    where: { id },
    select: { universityId: true },
  });
  if (!ann || ann.universityId !== universityId) return null;
  return ann;
}

/**
 * PUT /api/university/announcements/[id]
 * Update an announcement. Supports JSON body or multipart/form-data.
 * Fields: title, content, courseId?, attachmentUrl?, isPublished, publishedAt?
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
    let title: string | undefined;
    let content: string | undefined;
    let courseId: string | null | undefined = undefined;
    let attachmentUrl: string | null | undefined = undefined;
    let isPublished: boolean | undefined;
    let publishedAt: string | null | undefined;
    let removeAttachment = false;

    if (contentType.includes("multipart/form-data")) {
      const fd = await req.formData();
      title = (fd.get("title") as string) || undefined;
      content = (fd.get("content") as string) || undefined;
      const cId = fd.get("courseId") as string | null;
      if (cId !== null) courseId = cId === "ALL" ? null : cId;
      isPublished = fd.get("isPublished")
        ? String(fd.get("isPublished")) === "true"
        : undefined;
      publishedAt = (fd.get("publishedAt") as string) || undefined;
      removeAttachment =
        String(fd.get("removeAttachment") || "false") === "true";
      const file = fd.get("file");
      if (file && file instanceof File) {
        const ext = "." + (file.name.split(".").pop() || "").toLowerCase();
        if (!validateExt(ext, ALLOWED_IMAGE_EXT)) {
          return errorResponse(
            `Invalid attachment extension. Allowed: ${ALLOWED_IMAGE_EXT.join(", ")}`,
            400
          );
        }
        const saved = await saveUploadedFile(file, "announcements");
        attachmentUrl = saved.url;
      }
    } else {
      const body = await req.json();
      title = body.title;
      content = body.content;
      courseId =
        body.courseId === undefined
          ? undefined
          : body.courseId === null || body.courseId === "ALL"
            ? null
            : body.courseId;
      attachmentUrl = body.attachmentUrl;
      isPublished = body.isPublished;
      publishedAt = body.publishedAt ?? undefined;
    }

    // If courseId provided, verify it belongs to this university
    if (courseId !== undefined && courseId !== null) {
      const course = await db.course.findUnique({
        where: { id: courseId },
        select: { universityId: true },
      });
      if (!course || course.universityId !== user.universityId) {
        return errorResponse("Course not found in your university", 404);
      }
    }

    // Compute final publishedAt — preserve existing if not provided.
    const existing = await db.announcement.findUnique({
      where: { id },
      select: { isPublished: true, publishedAt: true },
    });
    if (!existing)
      return errorResponse("Announcement not found", 404);

    const finalPublished =
      isPublished !== undefined ? isPublished : existing.isPublished;
    let finalPubDate: Date | null = existing.publishedAt;
    if (finalPublished) {
      if (publishedAt !== undefined && publishedAt !== null) {
        finalPubDate = new Date(publishedAt);
      } else if (!existing.publishedAt) {
        finalPubDate = new Date();
      }
    } else {
      finalPubDate = null;
    }

    const updated = await db.announcement.update({
      where: { id },
      data: {
        ...(title !== undefined ? { title: title.trim() } : {}),
        ...(content !== undefined ? { content: content.trim() } : {}),
        ...(courseId !== undefined ? { courseId: courseId } : {}),
        ...(attachmentUrl !== undefined
          ? { attachmentUrl }
          : removeAttachment
            ? { attachmentUrl: null }
            : {}),
        ...(isPublished !== undefined ? { isPublished: finalPublished } : {}),
        publishedAt: finalPubDate,
      },
      include: { course: { select: { id: true, title: true } } },
    });

    return NextResponse.json({
      announcement: {
        id: updated.id,
        title: updated.title,
        content: updated.content,
        attachmentUrl: updated.attachmentUrl,
        courseId: updated.courseId,
        courseTitle: updated.course?.title ?? null,
        isPublished: updated.isPublished,
        publishedAt: updated.publishedAt,
        updatedAt: updated.updatedAt,
      },
    });
  } catch (e) {
    const authErr = await handleAuthError(e);
    if (authErr) return authErr;
    console.error("[university/announcements PUT]", e);
    return errorResponse("Failed to update announcement", 500);
  }
}

/**
 * DELETE /api/university/announcements/[id]
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

    await db.announcement.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (e) {
    const authErr = await handleAuthError(e);
    if (authErr) return authErr;
    console.error("[university/announcements DELETE]", e);
    return errorResponse("Failed to delete announcement", 500);
  }
}
