import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  requireStudent,
  handleAuthError,
} from "@/lib/auth";
import {
  getCourseInstructorForCertificate,
  reconcileStudentCertificates,
} from "@/lib/course-utils";
import { getPlatformSettings } from "@/lib/platform-settings";

export async function GET() {
  try {
    const user = await requireStudent();
    await reconcileStudentCertificates(user.id);

    const [certificates, settings] = await Promise.all([
      db.certificate.findMany({
        where: { studentId: user.id },
        orderBy: { issuedAt: "desc" },
        include: {
          course: {
            select: {
              id: true,
              title: true,
              universityId: true,
              university: { select: { name: true } },
            },
          },
        },
      }),
      getPlatformSettings(),
    ]);

    const enriched = await Promise.all(
      certificates.map(async (c) => {
        const liveInstructor = await getCourseInstructorForCertificate(
          c.courseId,
          c.course.universityId
        );
        const instructorName = c.instructorName || liveInstructor?.name || null;
        const sameInstructor =
          !c.instructorName ||
          (liveInstructor?.name && c.instructorName === liveInstructor.name);
        const instructorSignatureUrl = sameInstructor
          ? liveInstructor?.signatureUrl || c.instructorSignatureUrl || null
          : c.instructorSignatureUrl || liveInstructor?.signatureUrl || null;
        return {
          id: c.id,
          certificateNumber: c.certificateNumber,
          courseId: c.courseId,
          courseTitle: c.course.title,
          templateTitle: c.templateTitle,
          templateText: c.templateText,
          organizationName: settings.appName,
          appName: settings.appName,
          appLogoUrl: settings.logoUrl,
          universityName: c.universityName || c.course.university?.name || null,
          instructorName,
          instructorSignatureUrl,
          issuedAt: c.issuedAt,
        };
      })
    );

    return NextResponse.json({
      certificates: enriched,
    });
  } catch (e) {
    const authErr = await handleAuthError(e);
    if (authErr) return authErr;
    console.error("[student/certificates GET]", e);
    return NextResponse.json(
      { error: "Failed to load certificates" },
      { status: 500 }
    );
  }
}
