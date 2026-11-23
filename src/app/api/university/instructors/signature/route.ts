import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  requireInstructor,
  handleAuthError,
  errorResponse,
} from "@/lib/auth";
import {
  saveUploadedFile,
  validateExt,
  ALLOWED_IMAGE_EXT,
} from "@/lib/storage";

/**
 * GET /api/university/instructors/signature
 * Returns the signed-in instructor's current electronic signature URL.
 */
export async function GET() {
  try {
    const user = await requireInstructor();
    const instructor = await db.instructor.findUnique({
      where: { userId: user.id },
      select: { id: true, signatureUrl: true },
    });
    if (!instructor) return errorResponse("Instructor record not found", 404);
    return NextResponse.json({
      signatureUrl: instructor.signatureUrl ?? null,
    });
  } catch (e) {
    const authErr = await handleAuthError(e);
    if (authErr) return authErr;
    console.error("[university/instructors/signature GET]", e);
    return errorResponse("Failed to load signature", 500);
  }
}

/**
 * PUT /api/university/instructors/signature
 * Allows the signed-in instructor to upload/draw or remove their own electronic signature.
 */
export async function PUT(req: Request) {
  try {
    const user = await requireInstructor();
    const instructor = await db.instructor.findUnique({
      where: { userId: user.id },
      select: { id: true },
    });
    if (!instructor) return errorResponse("Instructor record not found", 404);

    const contentType = req.headers.get("content-type") || "";
    let nextSignatureUrl: string | null | undefined = undefined;

    if (contentType.includes("multipart/form-data")) {
      const fd = await req.formData();
      const removeSignature = fd.get("removeSignature") === "true";
      const sig = fd.get("signature");
      if (removeSignature) {
        nextSignatureUrl = null;
      } else if (sig && sig instanceof File && sig.size > 0) {
        const ext = "." + (sig.name.split(".").pop() || "").toLowerCase();
        if (!validateExt(ext, ALLOWED_IMAGE_EXT)) {
          return errorResponse(
            `Invalid signature image extension. Allowed: ${ALLOWED_IMAGE_EXT.join(", ")}`,
            400
          );
        }
        const saved = await saveUploadedFile(sig, "signatures");
        nextSignatureUrl = saved.url;
      }
    } else {
      const body = (await req.json()) as { removeSignature?: boolean };
      if (body.removeSignature === true) {
        nextSignatureUrl = null;
      }
    }

    if (nextSignatureUrl === undefined) {
      return errorResponse("Provide a signature image or set removeSignature", 400);
    }

    const updated = await db.instructor.update({
      where: { id: instructor.id },
      data: { signatureUrl: nextSignatureUrl },
      select: { signatureUrl: true },
    });

    return NextResponse.json({
      signatureUrl: updated.signatureUrl ?? null,
    });
  } catch (e) {
    const authErr = await handleAuthError(e);
    if (authErr) return authErr;
    console.error("[university/instructors/signature PUT]", e);
    return errorResponse("Failed to update signature", 500);
  }
}
