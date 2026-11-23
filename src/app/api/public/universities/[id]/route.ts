import { NextResponse } from "next/server";
import { db } from "@/lib/db";

/**
 * GET /api/public/universities/[id]
 *
 * Public university profile — returns branding, contact info, and the
 * university's published courses (with topic/video counts and category).
 *
 * Output:
 *   {
 *     university: {
 *       id, name, logo, coverImage, description, website,
 *       contactEmail, contactPhone, location, socialLinks (parsed)
 *     },
 *     courses: [{
 *       id, title, description, thumbnail, category, accessType,
 *       level, topicsCount, videosCount, planNames,
 *       firstVideoUrl, firstVideoSource
 *     }],
 *     categories: string[],
 *     totalCourses: number
 *   }
 *
 * 404 if the university does not exist.
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const university = await db.university.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      logo: true,
      coverImage: true,
      description: true,
      website: true,
      contactEmail: true,
      contactPhone: true,
      location: true,
      socialLinks: true,
    },
  });

  if (!university) {
    return NextResponse.json(
      { error: "University not found" },
      { status: 404 }
    );
  }

  // Parse socialLinks JSON safely
  let socialLinks: Record<string, string> = {};
  if (university.socialLinks) {
    try {
      socialLinks = JSON.parse(university.socialLinks) as Record<string, string>;
    } catch {
      socialLinks = {};
    }
  }

  // Fetch published courses for this university
  const courses = await db.course.findMany({
    where: { universityId: id, isPublished: true },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      title: true,
      description: true,
      thumbnail: true,
      category: true,
      accessType: true,
      level: true,
      planAccess: { include: { plan: { select: { name: true } } } },
    },
  });

  // Enrich with counts + first-video thumbnail fallback
  const enriched = await Promise.all(
    courses.map(async (c) => {
      const [topicsCount, videosCount, firstVideo] = await Promise.all([
        db.topic.count({ where: { courseId: c.id } }),
        db.videoLesson.count({ where: { courseId: c.id, isPublished: true } }),
        db.videoLesson.findFirst({
          where: { courseId: c.id, isPublished: true },
          orderBy: { displayOrder: "asc" },
          select: { thumbnail: true, videoUrl: true, source: true },
        }),
      ]);
      return {
        id: c.id,
        title: c.title,
        description: c.description,
        thumbnail: c.thumbnail || firstVideo?.thumbnail || null,
        firstVideoUrl: firstVideo?.videoUrl || null,
        firstVideoSource: firstVideo?.source || null,
        category: c.category,
        accessType: c.accessType as "FREE" | "PAID",
        level: c.level as "BEGINNER" | "INTERMEDIATE" | "ADVANCED",
        topicsCount,
        videosCount,
        planNames: c.planAccess.map((p) => p.plan.name),
      };
    })
  );

  // Distinct categories (non-null)
  const categories = Array.from(
    new Set(enriched.map((c) => c.category).filter(Boolean))
  ) as string[];

  return NextResponse.json({
    university: {
      id: university.id,
      name: university.name,
      logo: university.logo,
      coverImage: university.coverImage,
      description: university.description,
      website: university.website,
      contactEmail: university.contactEmail,
      contactPhone: university.contactPhone,
      location: university.location,
      socialLinks,
    },
    courses: enriched,
    categories,
    totalCourses: enriched.length,
  });
}
