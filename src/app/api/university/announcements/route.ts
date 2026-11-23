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
 * GET /api/university/announcements
 * List announcements for the logged-in university. Optional filters:
 *   ?courseId=<id>  — only announcements targeting that course
 *   ?published=true|false
 *   ?q=<text>        — title/content search
 */
export async function GET(req: Request) {
  try {
    const user = await requireUniversity();
    const universityId = user.universityId!;
    const url = new URL(req.url);
    const courseId = url.searchParams.get("courseId") || undefined;
    const published = url.searchParams.get("published");
    const q = (url.searchParams.get("q") || "").trim().toLowerCase();

    const announcements = await db.announcement.findMany({
      where: {
        universityId,
        ...(courseId ? { courseId } : {}),
        ...(published === "true"
          ? { isPublished: true }
          : published === "false"
            ? { isPublished: false }
            : {}),
        ...(q
          ? {
              OR: [
                { title: { contains: q } },
                { content: { contains: q } },
              ],
            }
          : {}),
      },
      orderBy: [{ isPublished: "desc" }, { createdAt: "desc" }],
      include: {
        course: { select: { id: true, title: true } },
      },
    });

    return NextResponse.json({
      announcements: announcements.map((a) => ({
        id: a.id,
        title: a.title,
        content: a.content,
        attachmentUrl: a.attachmentUrl,
        courseId: a.courseId,
        courseTitle: a.course?.title ?? null,
        isPublished: a.isPublished,
        publishedAt: a.publishedAt,
        createdAt: a.createdAt,
        updatedAt: a.updatedAt,
      })),
    });
  } catch (e) {
    const authErr = await handleAuthError(e);
    if (authErr) return authErr;
    console.error("[university/announcements GET]", e);
    return errorResponse("Failed to load announcements", 500);
  }
}

/**
 * POST /api/university/announcements
 * Supports JSON body or multipart/form-data (when an attachment file is present).
 * Fields: title, content, courseId?, attachmentUrl?, isPublished, publishedAt?
 */
export async function POST(req: Request) {
  try {
    const user = await requireUniversityOwner();
    const universityId = user.universityId!;

    const contentType = req.headers.get("content-type") || "";
    let title: string = "";
    let content: string = "";
    let courseId: string | null | undefined = undefined;
    let attachmentUrl: string | null = null;
    let isPublished = false;
    let publishedAt: string | null = null;

    if (contentType.includes("multipart/form-data")) {
      const fd = await req.formData();
      title = (fd.get("title") as string) || "";
      content = (fd.get("content") as string) || "";
      const cId = fd.get("courseId") as string | null;
      courseId = cId && cId !== "ALL" ? cId : null;
      isPublished = String(fd.get("isPublished") || "false") === "true";
      publishedAt = (fd.get("publishedAt") as string) || null;
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
      title = body.title || "";
      content = body.content || "";
      courseId =
        body.courseId === undefined
          ? undefined
          : body.courseId === null || body.courseId === "ALL"
            ? null
            : body.courseId;
      attachmentUrl = body.attachmentUrl ?? null;
      isPublished = !!body.isPublished;
      publishedAt = body.publishedAt ?? null;
    }

    if (!title.trim()) return errorResponse("Title is required", 400);
    if (!content.trim()) return errorResponse("Content is required", 400);

    // Validate course belongs to this university if specified
    if (courseId) {
      const course = await db.course.findUnique({
        where: { id: courseId },
        select: { universityId: true },
      });
      if (!course || course.universityId !== universityId) {
        return errorResponse("Course not found in your university", 404);
      }
    }

    const now = new Date();
    const pubDate =
      isPublished && publishedAt
        ? new Date(publishedAt)
        : isPublished
          ? now
          : null;

    const announcement = await db.announcement.create({
      data: {
        universityId,
        courseId: courseId ?? null,
        title: title.trim(),
        content: content.trim(),
        attachmentUrl,
        isPublished,
        publishedAt: pubDate,
      },
      include: { course: { select: { id: true, title: true } } },
    });

    return NextResponse.json({
      announcement: {
        id: announcement.id,
        title: announcement.title,
        content: announcement.content,
        attachmentUrl: announcement.attachmentUrl,
        courseId: announcement.courseId,
        courseTitle: announcement.course?.title ?? null,
        isPublished: announcement.isPublished,
        publishedAt: announcement.publishedAt,
        createdAt: announcement.createdAt,
      },
    });
  } catch (e) {
    const authErr = await handleAuthError(e);
    if (authErr) return authErr;
    console.error("[university/announcements POST]", e);
    return errorResponse("Failed to create announcement", 500);
  }
}
