import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin, handleAuthError, errorResponse } from "@/lib/auth";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAdmin();
    const { id } = await params;

    const course = await db.course.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!course) return errorResponse("Course not found", 404);

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
    console.error("[admin/topics GET]", e);
    return errorResponse("Failed to load topics", 500);
  }
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAdmin();
    const { id } = await params;
    const body = await req.json();
    const { title, description, displayOrder } = body as {
      title?: string;
      description?: string;
      displayOrder?: number;
    };

    if (!title || !title.trim()) {
      return errorResponse("Title is required", 400);
    }

    const course = await db.course.findUnique({ where: { id } });
    if (!course) return errorResponse("Course not found", 404);

    const existingCount = await db.topic.count({ where: { courseId: id } });
    if (existingCount >= 10) {
      return errorResponse(
        "Maximum 10 topics allowed per course. Please do not add more than 10 topics.",
        400
      );
    }

    // If no displayOrder provided, put at end
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
    console.error("[admin/topics POST]", e);
    return errorResponse("Failed to create topic", 500);
  }
}
