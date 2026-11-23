import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  requireUniversityCourseAccess,
  requireAssignedInstructorCourseAccess,
  handleAuthError,
  errorResponse,
} from "@/lib/auth";
import {
  saveUploadedFile,
  validateExt,
  ALLOWED_DOC_EXT,
} from "@/lib/storage";

const MATERIAL_TYPES = ["PDF", "DOC", "PRESENTATION", "LINK"];

/**
 * GET /api/university/courses/[id]/materials
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    await requireUniversityCourseAccess(id);

    const materials = await db.learningMaterial.findMany({
      where: { courseId: id },
      orderBy: { createdAt: "desc" },
      include: { topic: { select: { id: true, title: true } } },
    });

    return NextResponse.json({
      materials: materials.map((m) => ({
        id: m.id,
        title: m.title,
        description: m.description,
        type: m.type,
        fileUrl: m.fileUrl,
        isPublished: m.isPublished,
        createdAt: m.createdAt,
        topic: m.topic,
      })),
    });
  } catch (e) {
    const authErr = await handleAuthError(e);
    if (authErr) return authErr;
    console.error("[university/materials GET]", e);
    return errorResponse("Failed to load materials", 500);
  }
}

/**
 * POST /api/university/courses/[id]/materials
 */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    await requireAssignedInstructorCourseAccess(id);

    const formData = await req.formData();
    const title = (formData.get("title") as string | null)?.trim();
    const description =
      (formData.get("description") as string | null)?.trim() || null;
    const topicId = (formData.get("topicId") as string | null) || null;
    const type = (formData.get("type") as string | null) || "PDF";
    const fileUrlRaw = (formData.get("fileUrl") as string | null)?.trim() || "";
    const file = formData.get("file");
    const isPublishedStr = formData.get("isPublished") as string | null;

    if (!title) return errorResponse("Title is required", 400);

    const materialType = MATERIAL_TYPES.includes(type) ? type : "PDF";
    let fileUrl = "";

    if (materialType === "LINK") {
      if (!fileUrlRaw) return errorResponse("Link URL is required for LINK type", 400);
      fileUrl = fileUrlRaw;
    } else {
      if (!file || !(file instanceof File)) {
        return errorResponse("File is required for non-LINK types", 400);
      }
      const ext = "." + (file.name.split(".").pop() || "").toLowerCase();
      if (!validateExt(ext, ALLOWED_DOC_EXT)) {
        return errorResponse(
          `Invalid file extension. Allowed: ${ALLOWED_DOC_EXT.join(", ")}`,
          400
        );
      }
      const saved = await saveUploadedFile(file, "materials");
      fileUrl = saved.url;
    }

    if (topicId) {
      const topic = await db.topic.findFirst({
        where: { id: topicId, courseId: id },
      });
      if (!topic) return errorResponse("Topic not found in this course", 404);
    }

    const isPublished = isPublishedStr !== "false";

    const material = await db.learningMaterial.create({
      data: {
        courseId: id,
        topicId: topicId || null,
        title,
        description,
        type: materialType,
        fileUrl,
        isPublished,
      },
    });

    return NextResponse.json({ material });
  } catch (e) {
    const authErr = await handleAuthError(e);
    if (authErr) return authErr;
    console.error("[university/materials POST]", e);
    return errorResponse("Failed to create material", 500);
  }
}
