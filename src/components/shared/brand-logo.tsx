"use client";

import { GraduationCap } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAppStore } from "@/stores/app-store";

export function BrandLogo({
  className,
  showText = true,
  onClick,
}: {
  className?: string;
  showText?: boolean;
  onClick?: () => void;
}) {
  const branding = useAppStore((s) => s.branding);
  const appName = branding.appName || "CourseLearn";
  const isDefaultName = appName === "CourseLearn";

  return (
    <button
      onClick={onClick}
      className={cn("flex items-center gap-2 group", className)}
      aria-label={`${appName} home`}
    >
      <span className="relative inline-flex h-9 w-9 items-center justify-center overflow-hidden rounded-xl bg-primary text-primary-foreground shadow-sm transition-transform group-hover:scale-105 shrink-0">
        {branding.logoUrl ? (
          <img
            key="brand-logo-img"
            src={branding.logoUrl}
            alt={appName}
            className="h-full w-full object-contain bg-card p-0.5"
          />
        ) : (
          <GraduationCap key="brand-logo-icon" className="h-5 w-5" />
        )}
      </span>
      {showText && (
        <span className="font-heading text-lg font-semibold tracking-tight text-foreground truncate">
          {isDefaultName ? (
            <span key="brand-default">
              Course<span className="text-accent">Learn</span>
            </span>
          ) : (
            <span key="brand-custom">{appName}</span>
          )}
        </span>
      )}
    </button>
  );
}
