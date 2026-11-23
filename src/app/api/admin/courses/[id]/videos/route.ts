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

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAdmin();
    const { id } = await params;

    const course = await db.course.findUnique({ where: { id } });
    if (!course) return errorResponse("Course not found", 404);

    const videos = await db.videoLesson.findMany({
      where: { courseId: id },
      orderBy: [{ displayOrder: "asc" }, { createdAt: "asc" }],
      include: { topic: { select: { id: true, title: true } } },
    });

    return NextResponse.json({
      videos: videos.map((v) => ({
        id: v.id,
        title: v.title,
        description: v.description,
        source: v.source,
        videoUrl: v.videoUrl,
        thumbnail: v.thumbnail,
        displayOrder: v.displayOrder,
        isPublished: v.isPublished,
        duration: v.duration,
        topic: v.topic,
      })),
    });
  } catch (e) {
    const authErr = await handleAuthError(e);
    if (authErr) return authErr;
    console.error("[admin/videos GET]", e);
    return errorResponse("Failed to load videos", 500);
  }
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAdmin();
    const { id } = await params;

    const course = await db.course.findUnique({ where: { id } });
    if (!course) return errorResponse("Course not found", 404);

    const contentType = req.headers.get("content-type") || "";
    let title: string | undefined;
    let description: string | null = null;
    let topicId: string | null = null;
    let source = "UPLOAD";
    let videoUrlRaw = "";
    let file: FormDataEntryValue | null = null;
    let thumbnailFile: FormDataEntryValue | null = null;
    let displayOrderStr: string | null = null;
    let isPublished = true;

    if (contentType.includes("application/json")) {
      const body = await req.json();
      title = typeof body.title === "string" ? body.title.trim() : undefined;
      description = typeof body.description === "string" ? body.description.trim() || null : null;
      topicId = typeof body.topicId === "string" ? body.topicId : null;
      source = typeof body.source === "string" ? body.source : "UPLOAD";
      videoUrlRaw = typeof body.videoUrl === "string" ? body.videoUrl.trim() : "";
      displayOrderStr = body.displayOrder !== undefined && body.displayOrder !== null ? String(body.displayOrder) : null;
      isPublished = body.isPublished !== false && body.isPublished !== "false";
    } else {
      const formData = await req.formData();
      title = (formData.get("title") as string | null)?.trim();
      description = (formData.get("description") as string | null)?.trim() || null;
      topicId = formData.get("topicId") as string | null;
      source = (formData.get("source") as string | null) || "UPLOAD";
      videoUrlRaw = (formData.get("videoUrl") as string | null)?.trim() || "";
      file = formData.get("file");
      thumbnailFile = formData.get("thumbnail");
      displayOrderStr = formData.get("displayOrder") as string | null;
      isPublished = (formData.get("isPublished") as string | null) !== "false";
    }

    if (!title) return errorResponse("Title is required", 400);
    if (!topicId) return errorResponse("Topic is required", 400);

    const topic = await db.topic.findFirst({
      where: { id: topicId, courseId: id },
    });
    if (!topic) return errorResponse("Topic not found in this course", 404);

    const src = source === "YOUTUBE" || source === "URL" ? source : "UPLOAD";
    let finalVideoUrl = "";

    if (src === "UPLOAD") {
      if (!file || !(file instanceof File) || file.size === 0) {
        return errorResponse("Video file is required for UPLOAD source", 400);
      }
      const ext = "." + (file.name.split(".").pop() || "").toLowerCase();
      if (!validateExt(ext, ALLOWED_VIDEO_EXT)) {
        return errorResponse(
          `Invalid video extension. Allowed: ${ALLOWED_VIDEO_EXT.join(", ")}`,
          400
        );
      }
      const saved = await saveUploadedFile(file, "videos");
      finalVideoUrl = saved.url;
    } else if (src === "YOUTUBE") {
      if (!videoUrlRaw) return errorResponse("YouTube URL is required", 400);
      finalVideoUrl = normalizeYouTubeUrl(videoUrlRaw);
    } else {
      if (!videoUrlRaw) return errorResponse("Video URL is required", 400);
      finalVideoUrl = videoUrlRaw;
    }

    let thumbnailUrl: string | null = null;
    if (thumbnailFile && thumbnailFile instanceof File && thumbnailFile.size > 0) {
      const ext = "." + (thumbnailFile.name.split(".").pop() || "").toLowerCase();
      if (validateExt(ext, ALLOWED_IMAGE_EXT)) {
        const saved = await saveUploadedFile(thumbnailFile, "thumbnails");
        thumbnailUrl = saved.url;
      }
    }

    let displayOrder: number | undefined;
    if (displayOrderStr !== null && displayOrderStr !== "") {
      displayOrder = parseInt(displayOrderStr, 10);
      if (Number.isNaN(displayOrder)) displayOrder = undefined;
    }
    if (displayOrder === undefined) {
      const max = await db.videoLesson.findFirst({
        where: { courseId: id },
        orderBy: { displayOrder: "desc" },
        select: { displayOrder: true },
      });
      displayOrder = (max?.displayOrder ?? -1) + 1;
    }

    const video = await db.videoLesson.create({
      data: {
        courseId: id,
        topicId,
        title,
        description,
        source: src,
        videoUrl: finalVideoUrl,
        thumbnail: thumbnailUrl,
        displayOrder,
        isPublished,
      },
    });

    return NextResponse.json({ video });
  } catch (e) {
    const authErr = await handleAuthError(e);
    if (authErr) return authErr;
    console.error("[admin/videos POST]", e);
    return errorResponse("Failed to create video", 500);
  }
}
