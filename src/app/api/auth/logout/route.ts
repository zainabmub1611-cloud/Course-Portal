import { NextResponse } from "next/server";
import { SESSION_COOKIE } from "@/lib/auth/server";

export async function POST() {
  const res = NextResponse.json({ ok: true });
  res.cookies.set(SESSION_COOKIE, "", {
    httpOnly: true,
    sameSite: "none",
    secure: true,
    path: "/",
    maxAge: 0,
  });
  return res;
}
