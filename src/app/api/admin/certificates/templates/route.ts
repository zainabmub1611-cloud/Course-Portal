import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin, handleAuthError, errorResponse } from "@/lib/auth";

/**
 * GET /api/admin/certificates/templates
 * Returns per-course certificate template info plus issued-certificate counts.
 * Used by the AdminCertificates UI to render its table.
 */
export async function GET() {
  try {
    await requireAdmin();

    const courses = await db.course.findMany({
      orderBy: { title: "asc" },
      select: {
        id: true,
        title: true,
        certificateTemplate: true,
        _count: { select: { certificates: true } },
      },
    });

    return NextResponse.json({
      templates: courses.map((c) => ({
        courseId: c.id,
        courseTitle: c.title,
        template: c.certificateTemplate
          ? {
              id: c.certificateTemplate.id,
              isEnabled: c.certificateTemplate.isEnabled,
              title: c.certificateTemplate.title,
              layout: c.certificateTemplate.layout,
              organizationName: c.certificateTemplate.organizationName,
              createdAt: c.certificateTemplate.createdAt,
            }
          : null,
        issuedCount: c._count.certificates,
      })),
    });
  } catch (e) {
    const authErr = await handleAuthError(e);
    if (authErr) return authErr;
    console.error("[admin/certificates/templates]", e);
    return errorResponse("Failed to load certificate templates", 500);
  }
}
