import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const levelParam = url.searchParams.get("level")?.toUpperCase().trim();
  const sortParam = url.searchParams.get("sort")?.toLowerCase().trim();

  // Build the where clause — only filter by level when it matches a known value.
  const validLevels = new Set(["BEGINNER", "INTERMEDIATE", "ADVANCED"]);
  const levelFilter =
    levelParam && validLevels.has(levelParam) ? levelParam : undefined;

  const where = levelFilter
    ? { isPublished: true, level: levelFilter }
    : { isPublished: true };

  const [courses, universities] = await Promise.all([
    db.course.findMany({
      where,
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        title: true,
        description: true,
        thumbnail: true,
        category: true,
        accessType: true,
        level: true,
        createdAt: true,
        university: { select: { id: true, name: true, logo: true } },
      },
    }),
    db.university.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true, logo: true },
    }),
  ]);

  // enrich with counts + first video thumbnail fallback
  const enriched = await Promise.all(
    courses.map(async (c) => {
      const [topicsCount, videosCount, planAccess, firstVideo, progressCount] = await Promise.all([
        db.topic.count({ where: { courseId: c.id } }),
        db.videoLesson.count({ where: { courseId: c.id, isPublished: true } }),
        db.coursePlanAccess.findMany({
          where: { courseId: c.id },
          include: { plan: { select: { name: true } } },
        }),
        // Fetch the first published video's thumbnail for fallback
        db.videoLesson.findFirst({
          where: { courseId: c.id, isPublished: true },
          orderBy: { displayOrder: "asc" },
          select: { thumbnail: true, videoUrl: true, source: true },
        }),
        // Popularity metric — distinct students with any progress
        db.videoProgress.groupBy({
          by: ["studentId"],
          where: { video: { courseId: c.id } },
        }),
      ]);
      // Use course thumbnail, or fall back to first video's thumbnail
      const thumbnail = c.thumbnail || firstVideo?.thumbnail || null;
      const uni = c.university;
      return {
        id: c.id,
        title: c.title,
        description: c.description,
        thumbnail,
        category: c.category,
        accessType: c.accessType,
        level: c.level,
        firstVideoUrl: firstVideo?.videoUrl || null,
        firstVideoSource: firstVideo?.source || null,
        topicsCount,
        videosCount,
        planNames: planAccess.map((p) => p.plan.name),
        university: uni ? { id: uni.id, name: uni.name, logo: uni.logo } : null,
        // ISO date used for "Newest" sorting if requested client-side too
        createdAt: c.createdAt.toISOString(),
        // raw popularity number (distinct students who have watched anything)
        popularity: progressCount.length,
      };
    })
  );

  // Apply server-side sort when requested. The client also performs these
  // sorts locally, but honoring them server-side keeps the contract explicit.
  let sorted = enriched;
  if (sortParam === "popular") {
    sorted = [...enriched].sort((a, b) => b.popularity - a.popularity);
  } else if (sortParam === "alphabetical" || sortParam === "alpha") {
    sorted = [...enriched].sort((a, b) =>
      a.title.localeCompare(b.title, undefined, { sensitivity: "base" })
    );
  }
  // "newest" (default) — already sorted by createdAt desc in the DB query

  return NextResponse.json({
    courses: sorted,
    universities: universities.map((u) => ({
      id: u.id,
      name: u.name,
      logo: u.logo,
    })),
  });
}
