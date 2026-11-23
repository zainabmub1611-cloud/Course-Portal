import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin, handleAuthError, errorResponse } from "@/lib/auth";
import {
  saveUploadedFile,
  validateExt,
  ALLOWED_VIDEO_EXT,
  ALLOWED_IMAGE_EXT,
} from "@/lib/storage";

function normalizeYouTubeUrl(rawUrl: string): string {
  const trimmed = rawUrl.trim();
  const withProto = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  try {
    const u = new URL(withProto);
    if (u.hostname.includes("youtu.be")) {
      const id = u.pathname.replace(/^\//, "").split("/")[0];
      if (id) return `https://www.youtube.com/embed/${id}`;
    }
    if (u.hostname.includes("youtube.com")) {
      const v = u.searchParams.get("v");
      if (v) return `https://www.youtube.com/embed/${v}`;
      const m = u.pathname.match(/\/(?:embed|shorts|live)\/([A-Za-z0-9_-]+)/);
      if (m) return `https://www.youtube.com/embed/${m[1]}`;
    }
    return withProto;
  } catch {
    return trimmed;
  }
}

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAdmin();
    const { id } = await params;

    const existing = await db.videoLesson.findUnique({ where: { id } });
    if (!existing) return errorResponse("Video not found", 404);

    const contentType = req.headers.get("content-type") || "";
    let title: string | undefined;
    let description: string | null = null;
    let hasDescription = false;
    let topicId: string | null = null;
    let source: string = existing.source;
    let videoUrlRaw = "";
    let file: FormDataEntryValue | null = null;
    let thumbnailFile: FormDataEntryValue | null = null;
    let displayOrderStr: string | null = null;
    let isPublishedStr: string | null = null;
    let isPublishedBool: boolean | undefined;

    if (contentType.includes("application/json")) {
      const body = await req.json();
      title = typeof body.title === "string" ? body.title.trim() : undefined;
      if (body.description !== undefined) {
        hasDescription = true;
        description =
          typeof body.description === "string" ? body.description.trim() || null : null;
      }
      topicId = typeof body.topicId === "string" ? body.topicId : null;
      source = typeof body.source === "string" ? body.source : existing.source;
      videoUrlRaw = typeof body.videoUrl === "string" ? body.videoUrl.trim() : "";
      displayOrderStr =
        body.displayOrder !== undefined && body.displayOrder !== null
          ? String(body.displayOrder)
          : null;
      if (body.isPublished !== undefined) {
        isPublishedBool = body.isPublished !== false && body.isPublished !== "false";
      }
    } else {
      const formData = await req.formData();
      title = (formData.get("title") as string | null)?.trim();
      if (formData.has("description")) {
        hasDescription = true;
        description = (formData.get("description") as string | null)?.trim() || null;
      }
      topicId = formData.get("topicId") as string | null;
      source = (formData.get("source") as string | null) || existing.source;
      videoUrlRaw = (formData.get("videoUrl") as string | null)?.trim() || "";
      file = formData.get("file");
      thumbnailFile = formData.get("thumbnail");
      displayOrderStr = formData.get("displayOrder") as string | null;
      isPublishedStr = formData.get("isPublished") as string | null;
    }

    const data: any = {};
    if (title) data.title = title;
    if (hasDescription) data.description = description;
    if (topicId) {
      const topic = await db.topic.findFirst({
        where: { id: topicId, courseId: existing.courseId },
      });
      if (!topic) return errorResponse("Topic not found in this course", 404);
      data.topicId = topicId;
    }

    const src = source === "YOUTUBE" || source === "URL" || source === "UPLOAD" ? source : existing.source;
    data.source = src;

    if (src === "UPLOAD") {
      if (file && file instanceof File && file.size > 0) {
        const ext = "." + (file.name.split(".").pop() || "").toLowerCase();
        if (!validateExt(ext, ALLOWED_VIDEO_EXT)) {
          return errorResponse(
            `Invalid video extension. Allowed: ${ALLOWED_VIDEO_EXT.join(", ")}`,
            400
          );
        }
        const saved = await saveUploadedFile(file, "videos");
        data.videoUrl = saved.url;
      } else if (videoUrlRaw) {
        // Allow swapping an uploaded video to a URL? — keep videoUrl if videoUrlRaw provided
        data.videoUrl = videoUrlRaw;
      }
      // else keep existing
    } else if (src === "YOUTUBE") {
      if (videoUrlRaw) data.videoUrl = normalizeYouTubeUrl(videoUrlRaw);
    } else {
      if (videoUrlRaw) data.videoUrl = videoUrlRaw;
    }

    if (thumbnailFile && thumbnailFile instanceof File && thumbnailFile.size > 0) {
      const ext = "." + (thumbnailFile.name.split(".").pop() || "").toLowerCase();
      if (validateExt(ext, ALLOWED_IMAGE_EXT)) {
        const saved = await saveUploadedFile(thumbnailFile, "thumbnails");
        data.thumbnail = saved.url;
      }
    }

    if (displayOrderStr !== null && displayOrderStr !== "") {
      const parsed = parseInt(displayOrderStr, 10);
      if (!Number.isNaN(parsed)) data.displayOrder = parsed;
    }
    if (isPublishedBool !== undefined) {
      data.isPublished = isPublishedBool;
    } else if (isPublishedStr !== null) {
      data.isPublished = isPublishedStr !== "false";
    }

    const updated = await db.videoLesson.update({ where: { id }, data });
    return NextResponse.json({ video: updated });
  } catch (e) {
    const authErr = await handleAuthError(e);
    if (authErr) return authErr;
    console.error("[admin/videos PUT]", e);
    return errorResponse("Failed to update video", 500);
  }
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAdmin();
    const { id } = await params;

    const existing = await db.videoLesson.findUnique({ where: { id } });
    if (!existing) return errorResponse("Video not found", 404);

    await db.videoLesson.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (e) {
    const authErr = await handleAuthError(e);
    if (authErr) return authErr;
    console.error("[admin/videos DELETE]", e);
    return errorResponse("Failed to delete video", 500);
  }
}
