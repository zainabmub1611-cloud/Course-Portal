import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireUniversity, handleAuthError, errorResponse } from "@/lib/auth";

/**
 * GET /api/university/discussions
 * List all discussions across the university's courses.
 * Supports ?courseId= filter and ?q= search.
 */
export async function GET(req: Request) {
  try {
    const user = await requireUniversity();
    const url = new URL(req.url);
    const courseId = url.searchParams.get("courseId");
    const q = url.searchParams.get("q")?.trim().toLowerCase();

    // Get all course IDs belonging to this university
    const courses = await db.course.findMany({
      where: { universityId: user.universityId },
      select: { id: true, title: true },
    });
    const assignedCourseIds =
      user.role === "INSTRUCTOR" ? user.assignedCourseIds ?? [] : null;
    const visibleCourses = assignedCourseIds
      ? courses.filter((course) => assignedCourseIds.includes(course.id))
      : courses;
    const courseIds = visibleCourses.map((c) => c.id);
    const courseMap = new Map(visibleCourses.map((c) => [c.id, c.title]));

    if (courseIds.length === 0) {
      return NextResponse.json({ discussions: [] });
    }

    const discussions = await db.discussion.findMany({
      where: {
        courseId: courseId && courseIds.includes(courseId) ? courseId : { in: courseIds },
        ...(q ? { OR: [{ title: { contains: q } }, { content: { contains: q } }] } : {}),
      },
      include: {
        author: { select: { id: true, name: true, profilePhoto: true } },
        replies: { select: { id: true }, orderBy: { createdAt: "desc" } },
      },
      orderBy: [{ isPinned: "desc" }, { updatedAt: "desc" }],
    });

    return NextResponse.json({
      discussions: discussions.map((d) => ({
        id: d.id,
        courseId: d.courseId,
        courseTitle: courseMap.get(d.courseId) || "Unknown",
        authorId: d.authorId,
        authorName: d.author.name,
        authorPhoto: d.author.profilePhoto,
        title: d.title,
        content: d.content,
        isPinned: d.isPinned,
        isLocked: d.isLocked,
        replyCount: d.replies.length,
        createdAt: d.createdAt,
        updatedAt: d.updatedAt,
      })),
    });
  } catch (e) {
    const authErr = await handleAuthError(e);
    if (authErr) return authErr;
    console.error("[university/discussions GET]", e);
    return errorResponse("Failed to load discussions", 500);
  }
}
