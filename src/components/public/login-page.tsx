"use client";

import AuthSwitch from "@/components/ui/auth-switch";

/**
 * LoginPage
 * --------
 * Renders the animated AuthSwitch panel (sliding sign-in / sign-up
 * transition). Supports opening directly on either sign-in or sign-up mode.
 */
export function LoginPage({ initialMode = "signin" }: { initialMode?: "signin" | "signup" }) {
  return <AuthSwitch key={initialMode} initialMode={initialMode} />;
}
