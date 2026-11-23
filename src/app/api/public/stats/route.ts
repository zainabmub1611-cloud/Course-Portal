import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET() {
  try {
    const [universities, courses, lessons, students, certificates] = await Promise.all([
      db.university.count(),
      db.course.count({ where: { isPublished: true } }),
      db.videoLesson.count({ where: { isPublished: true, course: { isPublished: true } } }),
      db.user.count({ where: { role: "STUDENT" } }),
      db.certificate.count(),
    ]);

    return NextResponse.json({
      universities,
      courses,
      lessons,
      students,
      certificates,
    });
  } catch (e) {
    console.error("[public/stats GET]", e);
    return NextResponse.json({
      universities: 0,
      courses: 0,
      lessons: 0,
      students: 0,
      certificates: 0,
    });
  }
}
