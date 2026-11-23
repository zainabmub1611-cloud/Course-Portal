import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { verifyPassword, signSession, SESSION_COOKIE } from "@/lib/auth/server";
import { SESSION_COOKIE_OPTIONS } from "@/lib/auth/cookie-options";
import { z } from "zod";

const schema = z.object({
  email: z.string().trim().email("Invalid email"),
  password: z.string().min(1, "Password is required"),
});

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || "Invalid input" },
        { status: 400 }
      );
    }
    const { email, password } = parsed.data;
    const normalizedEmail = email.trim().toLowerCase();

    const user = await db.user.findFirst({
      where: { email: { equals: normalizedEmail, mode: "insensitive" } },
      include: {
        university: { select: { id: true, name: true, logo: true } },
        instructor: {
          select: {
            isActive: true,
            university: { select: { id: true, name: true, logo: true } },
          },
        },
      },
    });
    if (!user || !verifyPassword(password, user.passwordHash)) {
      return NextResponse.json({ error: "Invalid email or password" }, { status: 401 });
    }
    if (user.role === "INSTRUCTOR" && user.instructor && !user.instructor.isActive) {
      return NextResponse.json(
        { error: "Your instructor account is currently inactive" },
        { status: 403 }
      );
    }

    const role = user.role as "ADMIN" | "STUDENT" | "UNIVERSITY" | "INSTRUCTOR";
    const uni = user.university ?? user.instructor?.university ?? null;
    const token = signSession({
      userId: user.id,
      role,
      email: user.email,
      name: user.name,
      universityId: uni?.id ?? null,
    });

    const res = NextResponse.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role,
        phone: user.phone,
        bio: user.bio,
        profilePhoto: user.profilePhoto,
        universityId: uni?.id ?? null,
        universityName: uni?.name ?? null,
        universityLogo: uni?.logo ?? null,
      },
    });
    res.cookies.set(SESSION_COOKIE, token, SESSION_COOKIE_OPTIONS);
    return res;
  } catch (e) {
    console.error("[login]", e);
    return NextResponse.json({ error: "Login failed" }, { status: 500 });
  }
}
