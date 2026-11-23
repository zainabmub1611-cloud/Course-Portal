import { NextResponse } from "next/server";
import {
  requireStudent,
  getStudentSubscription,
  handleAuthError,
} from "@/lib/auth";

export async function GET() {
  try {
    const user = await requireStudent();
    const subscription = await getStudentSubscription(user.id);
    return NextResponse.json({ subscription });
  } catch (e) {
    const authErr = await handleAuthError(e);
    if (authErr) return authErr;
    console.error("[student/subscription GET]", e);
    return NextResponse.json(
      { error: "Failed to load subscription" },
      { status: 500 }
    );
  }
}
