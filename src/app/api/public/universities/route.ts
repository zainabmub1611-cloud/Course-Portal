import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET() {
  const universities = await db.university.findMany({
    orderBy: { name: "asc" },
    include: {
      courses: { where: { isPublished: true }, select: { id: true } },
    },
  });
  return NextResponse.json({
    universities: universities.map((u) => ({
      id: u.id,
      name: u.name,
      logo: u.logo,
      description: u.description,
      courseCount: u.courses.length,
    })),
  });
}
