"use client";

import {
  LayoutDashboard,
  BookOpen,
  GraduationCap,
  Bell,
  User,
  type LucideIcon,
} from "lucide-react";
import { useAppStore } from "@/stores/app-store";
import { useI18n } from "@/lib/i18n/store";
import { cn } from "@/lib/utils";

interface NavItem {
  id: string;
  icon: LucideIcon;
  /** i18n translation key (already resolved to a string) */
  label: string;
  /** segments passed to navigate() when tapped */
  segments: string[];
  /** second segment used for active-state comparison */
  section: string;
}

export function MobileBottomNav() {
  const segments = useAppStore((s) => s.segments);
  const navigate = useAppStore((s) => s.navigate);
  const { t } = useI18n();

  // The active section is the second route segment (e.g. "overview" in
  // ["student","overview"]). Falls back to "overview" to match the
  // dashboard's default when segments are empty.
  const currentSection = segments[1] || "overview";

  const items: NavItem[] = [
    {
      id: "dashboard",
      icon: LayoutDashboard,
      label: t("nav.dashboard"),
      segments: ["student", "overview"],
      section: "overview",
    },
    {
      id: "courses",
      icon: BookOpen,
      label: t("nav.myCourses"),
      segments: ["student", "courses"],
      section: "courses",
    },
    {
      id: "learning",
      icon: GraduationCap,
      label: t("nav.myLearning"),
      // No dedicated "learning list" route yet — tapping takes the user to
      // their course catalogue, but the tab is only highlighted when they
      // are actually inside a course learning session (/student/learn/:id).
      segments: ["student", "courses"],
      section: "learn",
    },
    {
      id: "notifications",
      icon: Bell,
      label: t("common.notifications"),
      segments: ["student", "notifications"],
      section: "notifications",
    },
    {
      id: "profile",
      icon: User,
      label: t("nav.myProfile"),
      segments: ["student", "profile"],
      section: "profile",
    },
  ];

  return (
    <nav
      aria-label="Mobile primary navigation"
      className={cn(
        "fixed bottom-0 left-0 right-0 z-40 lg:hidden",
        "bg-card border-t border-border",
        "shadow-[0_-1px_3px_rgba(37,51,43,0.04)]"
      )}
      // Respect the iOS home-indicator / Android gesture safe area so the
      // bar never sits underneath the system gesture region.
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <ul className="flex h-16 w-full items-stretch">
        {items.map((item) => {
          const active = currentSection === item.section;
          const Icon = item.icon;
          return (
            <li key={item.id} className="flex-1 flex">
              <button
                type="button"
                onClick={() => navigate(item.segments)}
                aria-current={active ? "page" : undefined}
                aria-label={item.label}
                className={cn(
                  "flex w-full flex-col items-center justify-center gap-0.5",
                  "min-h-[44px] py-1 px-1 outline-none",
                  "transition-colors duration-150",
                  "focus-visible:ring-2 focus-visible:ring-accent/40 rounded-md",
                  active
                    ? "text-accent"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                {/* Active indicator dot — always rendered (transparent when
                    inactive) so layout doesn't shift when toggling. */}
                <span
                  className={cn(
                    "h-1 w-1 rounded-full transition-colors duration-150",
                    active ? "bg-accent" : "bg-transparent"
                  )}
                  aria-hidden="true"
                />
                <Icon className="h-5 w-5 shrink-0" aria-hidden="true" />
                <span
                  className={cn(
                    "text-[10px] leading-tight text-center line-clamp-2 max-w-full",
                    active ? "font-medium" : "font-normal"
                  )}
                >
                  {item.label}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
