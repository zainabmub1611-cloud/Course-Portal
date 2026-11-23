import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { saveUploadedFile, ALLOWED_IMAGE_EXT, validateExt } from "@/lib/storage";
import { z } from "zod";

export async function PUT(req: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const formData = await req.formData();
    const name = (formData.get("name") as string | null)?.trim();
    const phone = (formData.get("phone") as string | null)?.trim() || null;
    const bio = (formData.get("bio") as string | null)?.trim() || null;
    const photoFile = formData.get("photo") as File | null;

    if (!name || name.length < 2) {
      return NextResponse.json({ error: "Name is required" }, { status: 400 });
    }

    let profilePhoto: string | undefined;
    if (photoFile && photoFile.size > 0) {
      const ext = "." + (photoFile.name.split(".").pop() || "").toLowerCase();
      if (!validateExt(ext, ALLOWED_IMAGE_EXT)) {
        return NextResponse.json({ error: "Unsupported image format" }, { status: 400 });
      }
      if (photoFile.size > 5 * 1024 * 1024) {
        return NextResponse.json({ error: "Image must be under 5MB" }, { status: 400 });
      }
      const saved = await saveUploadedFile(photoFile, "profiles");
      profilePhoto = saved.url;
    }

    const updated = await db.user.update({
      where: { id: user.id },
      data: {
        name,
        phone,
        bio,
        ...(profilePhoto ? { profilePhoto } : {}),
      },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        phone: true,
        bio: true,
        profilePhoto: true,
      },
    });

    return NextResponse.json({ user: updated });
  } catch (e) {
    console.error("[profile PUT]", e);
    return NextResponse.json({ error: "Failed to update profile" }, { status: 500 });
  }
}
