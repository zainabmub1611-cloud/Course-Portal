import { db } from "@/lib/db";
import {
  requireStudent,
  handleAuthError,
  errorResponse,
} from "@/lib/auth";
import { buildCertificateHtml } from "@/lib/certificate-html";
import { getCourseInstructorForCertificate } from "@/lib/course-utils";
import {
  getPlatformSettings,
  resolvePublicUploadAsDataUri,
} from "@/lib/platform-settings";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireStudent();
    const { id } = await params;

    const cert = await db.certificate.findUnique({
      where: { id },
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
    });
    if (!cert) return errorResponse("Certificate not found", 404);
    if (cert.studentId !== user.id) {
      return errorResponse("Not authorized to view this certificate", 403);
    }

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
      studentName: user.name,
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
    const authErr = await handleAuthError(e);
    if (authErr) return authErr;
    console.error("[student/certificates preview]", e);
    return errorResponse("Failed to render certificate", 500);
  }
}
