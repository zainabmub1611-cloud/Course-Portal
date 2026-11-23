"use client";

import { GraduationCap } from "lucide-react";
import { useAppStore } from "@/stores/app-store";

export function FullPageLoader() {
  const branding = useAppStore((s) => s.branding);
  const appName = branding.appName || "CourseLearn";

  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-4 bg-background">
      <div className="relative">
        <div className="absolute inset-0 rounded-full bg-accent/20 blur-2xl animate-pulse" />
        <div className="relative h-14 w-14 overflow-hidden rounded-2xl bg-primary text-primary-foreground flex items-center justify-center shadow-lg">
          {branding.logoUrl ? (
            <img
              key="loader-logo-img"
              src={branding.logoUrl}
              alt={appName}
              className="h-full w-full object-contain bg-card p-1"
            />
          ) : (
            <GraduationCap key="loader-logo-icon" className="h-7 w-7" />
          )}
        </div>
      </div>
      <div className="flex items-center gap-2 text-muted-foreground text-sm">
        <span className="h-2 w-2 rounded-full bg-accent animate-bounce" />
        <span>Loading {appName}…</span>
      </div>
    </div>
  );
}
