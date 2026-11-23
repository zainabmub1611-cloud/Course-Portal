import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  requireUniversityCourseAccess,
  requireAssignedInstructorCourseAccess,
  handleAuthError,
  errorResponse,
} from "@/lib/auth";

/**
 * GET /api/university/courses/[id]/topics
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    await requireUniversityCourseAccess(id);

    const topics = await db.topic.findMany({
      where: { courseId: id },
      orderBy: { displayOrder: "asc" },
      include: {
        _count: { select: { videos: true, materials: true } },
      },
    });

    return NextResponse.json({
      topics: topics.map((t) => ({
        id: t.id,
        title: t.title,
        description: t.description,
        displayOrder: t.displayOrder,
        createdAt: t.createdAt,
        videosCount: t._count.videos,
        materialsCount: t._count.materials,
      })),
    });
  } catch (e) {
    const authErr = await handleAuthError(e);
    if (authErr) return authErr;
    console.error("[university/topics GET]", e);
    return errorResponse("Failed to load topics", 500);
  }
}

/**
 * POST /api/university/courses/[id]/topics
 */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    await requireAssignedInstructorCourseAccess(id);
    const body = await req.json();
    const { title, description, displayOrder } = body as {
      title?: string;
      description?: string;
      displayOrder?: number;
    };

    if (!title || !title.trim()) {
      return errorResponse("Title is required", 400);
    }

    const existingCount = await db.topic.count({ where: { courseId: id } });
    if (existingCount >= 10) {
      return errorResponse(
        "Maximum 10 topics allowed per course. Please do not add more than 10 topics.",
        400
      );
    }

    let order = displayOrder;
    if (order === undefined || order === null) {
      const max = await db.topic.findFirst({
        where: { courseId: id },
        orderBy: { displayOrder: "desc" },
        select: { displayOrder: true },
      });
      order = (max?.displayOrder ?? -1) + 1;
    }

    const topic = await db.topic.create({
      data: {
        courseId: id,
        title: title.trim(),
        description: description?.trim() || null,
        displayOrder: order,
      },
    });

    return NextResponse.json({ topic });
  } catch (e) {
    const authErr = await handleAuthError(e);
    if (authErr) return authErr;
    console.error("[university/topics POST]", e);
    return errorResponse("Failed to create topic", 500);
  }
}
