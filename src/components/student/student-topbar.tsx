"use client";
import { LanguageSwitcher } from "@/components/shared/language-switcher";

import { useAppStore } from "@/stores/app-store";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Menu, LogOut, ChevronDown, GraduationCap, User as UserIcon, CreditCard } from "lucide-react";
import { apiPost } from "@/hooks/use-api";
import { useI18n } from "@/lib/i18n/store";

const TITLES: Record<string, string> = {
  overview: "nav.dashboard",
  courses: "nav.exploreCourses",
  assignments: "nav.myAssignments",
  subscription: "nav.mySubscription",
  certificates: "nav.myCertificates",
  profile: "nav.myProfile",
  universities: "nav.exploreUniversities",
  notes: "nav.myNotes",
  bookmarks: "nav.myBookmarks",
  discussions: "nav.discussions",
  notifications: "nav.notifications",
};

export function StudentTopbar({ onToggleSidebar }: { onToggleSidebar: () => void }) {
  const { t } = useI18n();
  const segments = useAppStore((s) => s.segments);
  const navigate = useAppStore((s) => s.navigate);
  const user = useAppStore((s) => s.user);
  const refreshUser = useAppStore((s) => s.refreshUser);

  const current = segments[1] || "overview";
  const titleKey = segments[2] && current === "learn" ? "nav.dashboard" : TITLES[current] || "nav.dashboard";
  const title = t(titleKey as any);

  async function logout() {
    await apiPost("/api/auth/logout", null, { method: "POST" });
    await refreshUser();
    navigate([""]);
  }

  const initials = (user?.name || "S")
    .split(" ")
    .map((s) => s[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <header className="shadow-premium sticky top-0 z-30 flex h-16 items-center justify-between gap-2 sm:gap-4 border-b border-border bg-background px-3 sm:px-4 md:px-6 transition-shadow duration-300">
      {/* Subtle accent underline */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-accent/30 to-transparent" />

      <div className="flex items-center gap-3 min-w-0 flex-1">
        <Button
          variant="ghost"
          size="icon"
          className="h-11 w-11 lg:hidden shrink-0"
          onClick={onToggleSidebar}
          aria-label={t("student.toggleSidebar")}
        >
          <Menu className="h-5 w-5" />
        </Button>
        <div className="flex flex-col gap-0.5 min-w-0">
          <h1 className="font-heading text-base sm:text-xl font-semibold leading-tight tracking-tight text-foreground truncate">{title}</h1>
          <p className="hidden sm:block text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground/80 truncate">{t("student.studentDashboard")}</p>
        </div>
      </div>

      <div className="flex items-center gap-2 sm:gap-3 shrink-0">
        <LanguageSwitcher />
        {/* Accent "Student" badge */}
        <div className="hidden items-center gap-1.5 rounded-full border border-accent/20 bg-gradient-to-r from-accent/10 to-accent/5 px-3 py-1 text-xs font-semibold text-accent shadow-sm transition-colors duration-200 sm:flex">
          <GraduationCap className="h-3.5 w-3.5" />
          <span>{t("student.student")}</span>
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="flex items-center gap-2 rounded-lg p-1 pe-2 transition-all duration-200 hover:bg-muted/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50">
              {/* Ringed avatar */}
              <Avatar className="h-8 w-8 ring-2 ring-accent/30 ring-offset-2 ring-offset-background transition-shadow duration-200 shrink-0">
                {user?.profilePhoto ? <AvatarImage src={user.profilePhoto} alt={user?.name || ""} /> : null}
                <AvatarFallback className="bg-gradient-to-br from-primary to-accent text-xs font-semibold text-primary-foreground">{initials}</AvatarFallback>
              </Avatar>
              <div className="hidden text-start sm:block min-w-0">
                <p className="text-sm font-semibold leading-none text-foreground truncate">{user?.name}</p>
                <p className="mt-0.5 text-xs text-muted-foreground truncate max-w-[140px] sm:max-w-[180px]">{user?.email}</p>
              </div>
              <ChevronDown className="h-4 w-4 text-muted-foreground transition-transform duration-200" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              {t("nav.account")}
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => navigate(["student", "profile"])} className="gap-2">
              <UserIcon className="h-4 w-4" /> {t("nav.myProfile")}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => navigate(["student", "subscription"])} className="gap-2">
              <CreditCard className="h-4 w-4" /> {t("nav.mySubscription")}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={logout} className="text-destructive gap-2 focus:text-destructive">
              <LogOut className="h-4 w-4" />
              {t("common.logout")}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
