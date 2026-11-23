import { db } from "@/lib/db";
import { errorResponse } from "@/lib/auth";
import { buildCertificateHtml } from "@/lib/certificate-html";
import { getCourseInstructorForCertificate } from "@/lib/course-utils";
import {
  getPlatformSettings,
  resolvePublicUploadAsDataUri,
} from "@/lib/platform-settings";

export const dynamic = "force-dynamic";

/**
 * GET /api/public/certificates/[id]
 * Renders a verifiable certificate HTML page by certificateNumber (or certificate ID).
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const key = decodeURIComponent(id).trim();
    if (!key) return errorResponse("Certificate not found", 404);

    const cert =
      (await db.certificate.findUnique({
        where: { certificateNumber: key },
        include: {
          student: { select: { name: true } },
          course: {
            select: {
              id: true,
              title: true,
              universityId: true,
              university: { select: { name: true } },
            },
          },
        },
      })) ||
      (await db.certificate.findUnique({
        where: { id: key },
        include: {
          student: { select: { name: true } },
          course: {
            select: {
              id: true,
              title: true,
              universityId: true,
              university: { select: { name: true } },
            },
          },
        },
      }));

    if (!cert) return errorResponse("Certificate not found", 404);

    const [settings, liveInstructor] = await Promise.all([
      getPlatformSettings(),
      getCourseInstructorForCertificate(cert.courseId, cert.course.universityId),
    ]);

    const universityName = cert.universityName || cert.course.university?.name || null;
    const instructorName = cert.instructorName || liveInstructor?.name || null;
    const sameInstructor =
      !cert.instructorName ||
      (liveInstructor?.name && cert.instructorName === liveInstructor.name);
    const rawSigUrl = sameInstructor
      ? liveInstructor?.signatureUrl || cert.instructorSignatureUrl || null
      : cert.instructorSignatureUrl || liveInstructor?.signatureUrl || null;

    const [appLogoDataUri, sigDataUri] = await Promise.all([
      resolvePublicUploadAsDataUri(settings.logoUrl),
      resolvePublicUploadAsDataUri(rawSigUrl),
    ]);

    const issueDateStr = new Date(cert.issuedAt).toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "long",
      year: "numeric",
    });

    const resolvedOrgName = settings.appName;

    const html = buildCertificateHtml({
      certificateNumber: cert.certificateNumber,
      studentName: cert.student.name,
      courseTitle: cert.course.title,
      templateTitle: cert.templateTitle,
      bodyText: cert.templateText,
      organizationName: resolvedOrgName,
      appName: settings.appName,
      appLogoUrl: appLogoDataUri,
      universityName,
      instructorName,
      instructorSignatureUrl: sigDataUri,
      issueDate: issueDateStr,
    });

    return new Response(html, {
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "no-store",
      },
    });
  } catch (e) {
    console.error("[public/certificates GET]", e);
    return errorResponse("Failed to load certificate", 500);
  }
}
