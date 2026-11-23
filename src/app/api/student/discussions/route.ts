import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  requireStudent,
  handleAuthError,
  errorResponse,
} from "@/lib/auth";
import { canStudentAccessCourse } from "@/lib/course-utils";
import { notifyCourseStaff } from "@/lib/notifications";

/**
 * GET /api/student/discussions?courseId=...
 *   List discussions visible to the authenticated student. By default we
 *   return discussions for every course the student can access; passing
 *   `courseId` filters to a single course. Each item includes the author
 *   name/avatar, the course title, and the reply count.
 */
export async function GET(req: Request) {
  try {
    const user = await requireStudent();
    const url = new URL(req.url);
    const courseId = url.searchParams.get("courseId");

    // Determine the set of accessible course IDs.
    let accessibleCourseIds: string[] = [];
    if (courseId) {
      const access = await canStudentAccessCourse(user.id, courseId);
      if (!access.allowed) {
        return errorResponse(access.reason || "Not allowed", 403, "NO_ACCESS");
      }
      accessibleCourseIds = [courseId];
    } else {
      // Find all published courses, then filter to those the student can
      // access. Free courses are always accessible; paid courses require an
      // active subscription whose plan is in the course's planAccess list.
      const allCourses = await db.course.findMany({
        where: { isPublished: true },
        select: {
          id: true,
          accessType: true,
          planAccess: { select: { planId: true } },
        },
      });
      const activeSub = await db.subscription.findFirst({
        where: {
          studentId: user.id,
          status: "ACTIVE",
          expiryDate: { gt: new Date() },
        },
        orderBy: { createdAt: "desc" },
        select: { planId: true },
      });
      for (const c of allCourses) {
        if (c.accessType === "FREE") {
          accessibleCourseIds.push(c.id);
        } else if (activeSub) {
          if (c.planAccess.some((pa) => pa.planId === activeSub.planId)) {
            accessibleCourseIds.push(c.id);
          }
        }
      }
    }

    if (accessibleCourseIds.length === 0) {
      return NextResponse.json({ discussions: [] });
    }

    const discussions = await db.discussion.findMany({
      where: { courseId: { in: accessibleCourseIds } },
      orderBy: [{ isPinned: "desc" }, { updatedAt: "desc" }],
      include: {
        author: {
          select: { id: true, name: true, profilePhoto: true },
        },
        course: { select: { id: true, title: true } },
        _count: { select: { replies: true } },
      },
    });

    const result = discussions.map((d) => ({
      id: d.id,
      courseId: d.courseId,
      authorId: d.authorId,
      title: d.title,
      content: d.content,
      isPinned: d.isPinned,
      isLocked: d.isLocked,
      createdAt: d.createdAt,
      updatedAt: d.updatedAt,
      author: {
        id: d.author.id,
        name: d.author.name,
        profilePhoto: d.author.profilePhoto,
      },
      course: d.course
        ? { id: d.course.id, title: d.course.title }
        : null,
      replyCount: d._count.replies,
    }));

    return NextResponse.json({ discussions: result });
  } catch (e) {
    const authErr = await handleAuthError(e);
    if (authErr) return authErr;
    console.error("[student/discussions GET]", e);
    return errorResponse("Failed to load discussions", 500);
  }
}

/**
 * POST /api/student/discussions
 *   Create a new discussion post. `courseId`, `title`, and `content` are
 *   required; the student must have access to the named course.
 */
export async function POST(req: Request) {
  try {
    const user = await requireStudent();
    const body = await req.json();
    const { courseId, title, content } = body as {
      courseId?: string;
      title?: string;
      content?: string;
    };

    if (!courseId) return errorResponse("courseId is required", 400);
    if (!title || !title.trim()) {
      return errorResponse("Title is required", 400);
    }
    if (!content || !content.trim()) {
      return errorResponse("Content is required", 400);
    }

    const access = await canStudentAccessCourse(user.id, courseId);
    if (!access.allowed) {
      return errorResponse(access.reason || "Not allowed", 403, "NO_ACCESS");
    }

    const discussion = await db.discussion.create({
      data: {
        courseId,
        authorId: user.id,
        title: title.trim(),
        content: content.trim(),
      },
      include: {
        author: {
          select: { id: true, name: true, profilePhoto: true },
        },
        course: { select: { id: true, title: true } },
        _count: { select: { replies: true } },
      },
    });

    try {
      await notifyCourseStaff({
        courseId,
        excludeUserId: user.id,
        type: "DISCUSSION_REPLY",
        title: "New course discussion",
        content: `${user.name} started "${discussion.title}" in ${discussion.course?.title ?? "a course"}.`,
        relatedId: discussion.id,
      });
    } catch (notificationError) {
      console.error("[student/discussions POST] staff notification:", notificationError);
    }

    return NextResponse.json({
      discussion: {
        id: discussion.id,
        courseId: discussion.courseId,
        authorId: discussion.authorId,
        title: discussion.title,
        content: discussion.content,
        isPinned: discussion.isPinned,
        isLocked: discussion.isLocked,
        createdAt: discussion.createdAt,
        updatedAt: discussion.updatedAt,
        author: {
          id: discussion.author.id,
          name: discussion.author.name,
          profilePhoto: discussion.author.profilePhoto,
        },
        course: discussion.course
          ? { id: discussion.course.id, title: discussion.course.title }
          : null,
        replyCount: discussion._count.replies,
      },
    });
  } catch (e) {
    const authErr = await handleAuthError(e);
    if (authErr) return authErr;
    console.error("[student/discussions POST]", e);
    return errorResponse("Failed to create discussion", 500);
  }
}
