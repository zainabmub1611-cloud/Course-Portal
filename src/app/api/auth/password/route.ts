import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { verifyPassword, hashPassword } from "@/lib/auth/server";
import { z } from "zod";

const schema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(6, "New password must be at least 6 characters"),
});

export async function POST(req: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }
    const body = await req.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || "Invalid input" },
        { status: 400 }
      );
    }
    const { currentPassword, newPassword } = parsed.data;

    const dbUser = await db.user.findUnique({ where: { id: user.id } });
    if (!dbUser) return NextResponse.json({ error: "User not found" }, { status: 404 });

    if (!verifyPassword(currentPassword, dbUser.passwordHash)) {
      return NextResponse.json({ error: "Current password is incorrect" }, { status: 400 });
    }

    await db.user.update({
      where: { id: user.id },
      data: { passwordHash: hashPassword(newPassword) },
    });

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[password]", e);
    return NextResponse.json({ error: "Failed to change password" }, { status: 500 });
  }
}
