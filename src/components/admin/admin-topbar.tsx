"use client";
import { LanguageSwitcher } from "@/components/shared/language-switcher";

import { useAppStore } from "@/stores/app-store";
import { useI18n } from "@/lib/i18n/store";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Menu, LogOut, ChevronDown, Shield } from "lucide-react";
import { apiPost } from "@/hooks/use-api";
import type { TranslationKey } from "@/lib/i18n/translations";

const TITLES: Record<string, TranslationKey> = {
  overview: "dashboard.overview",
  universities: "admin.universities",
  students: "common.students",
  courses: "courses.courseManagement",
  materials: "common.learningMaterials",
  assignments: "common.assignments",
  submissions: "common.submissions",
  plans: "common.subscriptionPlans",
  certificates: "common.certificateManagement",
  settings: "nav.settings",
};

export function AdminTopbar({ onToggleSidebar }: { onToggleSidebar: () => void }) {
  const { t } = useI18n();
  const segments = useAppStore((s) => s.segments);
  const navigate = useAppStore((s) => s.navigate);
  const user = useAppStore((s) => s.user);
  const branding = useAppStore((s) => s.branding);
  const refreshUser = useAppStore((s) => s.refreshUser);

  const current = segments[1] || "overview";
  const titleKey: TranslationKey | undefined = TITLES[current];
  const title =
    segments[2] && current === "courses"
      ? t("courses.editCourse")
      : segments[2] && current === "universities"
        ? t("admin.universities")
        : titleKey
          ? t(titleKey)
          : t("dashboard.overview");

  async function logout() {
    await apiPost("/api/auth/logout", null, { method: "POST" });
    await refreshUser();
    navigate([""]);
  }

  const initials = (user?.name || "A")
    .split(" ")
    .map((s) => s[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <header className="shadow-premium sticky top-0 z-30 flex h-16 items-center justify-between gap-2 sm:gap-4 border-b border-border bg-background px-3 sm:px-4 md:px-6 shadow-[0_1px_3px_rgba(37,51,43,0.04)] transition-shadow duration-300">
      <div className="flex items-center gap-3 min-w-0 flex-1">
        <Button
          variant="ghost"
          size="icon"
          className="h-11 w-11 lg:hidden shrink-0"
          onClick={onToggleSidebar}
          aria-label="Toggle sidebar"
        >
          <Menu className="h-5 w-5" />
        </Button>
        <div className="flex flex-col gap-0.5 min-w-0">
          <h1 className="font-heading text-base sm:text-xl font-semibold leading-tight tracking-tight text-foreground truncate">{title}</h1>
          <p className="hidden sm:block text-xs font-medium uppercase tracking-[0.15em] text-muted-foreground/80 truncate">{branding.appName || "CourseLearn"} · {t("nav.dashboard")}</p>
        </div>
      </div>

      <div className="flex items-center gap-2 sm:gap-3 shrink-0">
        <LanguageSwitcher />
        <div className="hidden items-center gap-1.5 rounded-full border border-accent/25 bg-soft-sage px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-primary shadow-sm transition-colors duration-200 sm:flex">
          <Shield className="h-3 w-3" />
          <span>{t("dashboard.adminConsole")}</span>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="group flex items-center gap-2.5 rounded-lg p-1 pe-2 transition-all duration-200 hover:bg-muted/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50">
              <Avatar className="h-9 w-9 ring-2 ring-accent/20 ring-offset-2 ring-offset-background transition-all duration-200 group-hover:ring-accent/40 shrink-0">
                <AvatarFallback className="bg-primary text-xs font-semibold text-primary-foreground">{initials}</AvatarFallback>
              </Avatar>
              <div className="hidden text-start sm:block min-w-0">
                <p className="text-sm font-semibold leading-none text-foreground truncate">{user?.name}</p>
                <p className="mt-1 text-xs text-muted-foreground truncate max-w-[140px] sm:max-w-[180px]">{user?.email}</p>
              </div>
              <ChevronDown className="h-4 w-4 text-muted-foreground transition-transform duration-200 group-hover:text-foreground" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel className="font-normal text-xs text-muted-foreground">
              {t("auth.yourDetails")}
              <p className="mt-0.5 text-sm font-semibold text-foreground">{user?.email}</p>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={logout} className="text-destructive gap-2 focus:bg-destructive/5">
              <LogOut className="h-4 w-4" />
              {t("common.logout")}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
