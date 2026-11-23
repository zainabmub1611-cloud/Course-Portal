import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin, handleAuthError, errorResponse } from "@/lib/auth";

export async function GET(req: Request) {
  try {
    await requireAdmin();
    const url = new URL(req.url);
    const q = (url.searchParams.get("q") || "").trim().toLowerCase();
    const courseId = url.searchParams.get("courseId");

    const certificates = await db.certificate.findMany({
      where: {
        ...(courseId ? { courseId } : {}),
      },
      orderBy: { issuedAt: "desc" },
      include: {
        student: { select: { id: true, name: true, email: true } },
        course: { select: { id: true, title: true } },
      },
    });

    let filtered = certificates;
    if (q) {
      filtered = certificates.filter(
        (c) =>
          c.student.name.toLowerCase().includes(q) ||
          c.student.email.toLowerCase().includes(q) ||
          c.course.title.toLowerCase().includes(q) ||
          c.certificateNumber.toLowerCase().includes(q) ||
          c.templateTitle.toLowerCase().includes(q)
      );
    }

    return NextResponse.json({
      certificates: filtered.map((c) => ({
        id: c.id,
        studentId: c.studentId,
        courseId: c.courseId,
        studentName: c.student.name,
        studentEmail: c.student.email,
        courseTitle: c.course.title,
        templateTitle: c.templateTitle,
        templateText: c.templateText,
        organizationName: c.organizationName,
        certificateNumber: c.certificateNumber,
        issuedAt: c.issuedAt,
      })),
    });
  } catch (e) {
    const authErr = await handleAuthError(e);
    if (authErr) return authErr;
    console.error("[admin/certificates GET]", e);
    return errorResponse("Failed to load certificates", 500);
  }
}
