"use client";

import { Building2 } from "lucide-react";
import { cn } from "@/lib/utils";

export interface UniversityRef {
  id: string;
  name: string;
  logo?: string | null;
}

/**
 * UniversityBadge — small pill-style badge showing the university name.
 * Renders the logo as a small circular avatar when available, otherwise
 * falls back to the Building2 icon. Used on course cards and listings
 * to make multi-university provenance immediately visible.
 */
export function UniversityBadge({
  university,
  className,
  size = "sm",
}: {
  university: UniversityRef | null | undefined;
  className?: string;
  size?: "sm" | "xs";
}) {
  if (!university) return null;

  const sizing =
    size === "xs"
      ? { wrap: "h-4 w-4 text-[9px]", img: "h-3.5 w-3.5", icon: "h-2.5 w-2.5" }
      : { wrap: "h-5 w-5 text-[10px]", img: "h-4 w-4", icon: "h-3 w-3" };

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full bg-soft-sage text-primary border border-accent/15 px-2 py-0.5 text-xs font-medium",
        className
      )}
    >
      {university.logo ? (
        <img
          src={university.logo}
          alt=""
          className={cn("rounded-full object-cover ring-1 ring-accent/20", sizing.img)}
        />
      ) : (
        <span
          className={cn(
            "flex items-center justify-center rounded-full bg-accent/15 text-accent",
            sizing.wrap
          )}
        >
          <Building2 className={sizing.icon} />
        </span>
      )}
      <span className="truncate max-w-[160px]">{university.name}</span>
    </span>
  );
}
