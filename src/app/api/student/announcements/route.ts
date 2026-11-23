import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  requireStudent,
  handleAuthError,
  errorResponse,
} from "@/lib/auth";

/**
 * GET /api/student/announcements
 * Returns published announcements from universities whose courses the student
 * has video progress in. Includes both:
 *   - University-wide announcements (courseId = null) — shown for any
 *     university where the student has at least one progress record.
 *   - Course-scoped announcements — shown only if the student has progress in
 *     that specific course.
 *
 * Optional query params:
 *   ?universityId=<id>  — restrict to a single university
 *   ?courseId=<id>      — restrict to a single course
 */
export async function GET(req: Request) {
  try {
    const user = await requireStudent();
    const url = new URL(req.url);
    const filterUniversityId = url.searchParams.get("universityId");
    const filterCourseId = url.searchParams.get("courseId");

    // Find every course the student has video progress in
    const progressRows = await db.videoProgress.findMany({
      where: { studentId: user.id },
      select: {
        video: {
          select: {
            courseId: true,
            course: { select: { universityId: true } },
          },
        },
      },
      distinct: ["videoId"],
    });

    // Set of course IDs the student has progress in
    const courseIdsWithProgress = new Set<string>();
    const universityIdsWithProgress = new Set<string>();
    for (const p of progressRows) {
      courseIdsWithProgress.add(p.video.courseId);
      if (p.video.course.universityId) {
        universityIdsWithProgress.add(p.video.course.universityId);
      }
    }

    if (courseIdsWithProgress.size === 0) {
      return NextResponse.json({ announcements: [] });
    }

    // Build the WHERE clause:
    //   (isPublished = true) AND publishedAt <= now
    //   AND (
    //     (university-wide: courseId IS NULL AND universityId IN set)
    //     OR (course-scoped: courseId IN set)
    //   )
    const now = new Date();
    const where: any = {
      isPublished: true,
      OR: [
        {
          courseId: { in: Array.from(courseIdsWithProgress) },
        },
        {
          courseId: null,
          universityId: { in: Array.from(universityIdsWithProgress) },
        },
      ],
      AND: [
        {
          OR: [{ publishedAt: null }, { publishedAt: { lte: now } }],
        },
      ],
    };

    if (filterUniversityId) {
      where.universityId = filterUniversityId;
    }
    if (filterCourseId) {
      // narrow to either matching course-id or that university's university-wide
      const targetCourse = await db.course.findUnique({
        where: { id: filterCourseId },
        select: { universityId: true },
      });
      if (!targetCourse) {
        return NextResponse.json({ announcements: [] });
      }
      where.AND.push({
        OR: [
          { courseId: filterCourseId },
          { courseId: null, universityId: targetCourse.universityId },
        ],
      });
    }

    const announcements = await db.announcement.findMany({
      where,
      orderBy: { publishedAt: "desc" },
      include: {
        university: { select: { id: true, name: true, logo: true } },
        course: { select: { id: true, title: true } },
      },
      take: 100,
    });

    return NextResponse.json({
      announcements: announcements.map((a) => ({
        id: a.id,
        title: a.title,
        content: a.content,
        attachmentUrl: a.attachmentUrl,
        courseId: a.courseId,
        courseTitle: a.course?.title ?? null,
        university: a.university
          ? { id: a.university.id, name: a.university.name, logo: a.university.logo }
          : null,
        publishedAt: a.publishedAt,
        createdAt: a.createdAt,
      })),
    });
  } catch (e) {
    const authErr = await handleAuthError(e);
    if (authErr) return authErr;
    console.error("[student/announcements GET]", e);
    return errorResponse("Failed to load announcements", 500);
  }
}
