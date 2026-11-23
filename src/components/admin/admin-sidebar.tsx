"use client";

import { useAppStore } from "@/stores/app-store";
import { useI18n } from "@/lib/i18n/store";
import { BrandLogo } from "@/components/shared/brand-logo";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard, Users, BookOpen, FileText, ClipboardList, Inbox,
  CreditCard, Award, Settings, LogOut, Building2,
} from "lucide-react";
import { apiPost } from "@/hooks/use-api";

const NAV_SECTIONS = [
  {
    label: "nav.management" as const,
    items: [
      { label: "nav.overview" as const, icon: LayoutDashboard, segments: ["admin", "overview"] },
      { label: "admin.universities" as const, icon: Building2, segments: ["admin", "universities"] },
      { label: "common.students" as const, icon: Users, segments: ["admin", "students"] },
      { label: "common.courses" as const, icon: BookOpen, segments: ["admin", "courses"] },
      { label: "common.learningMaterials" as const, icon: FileText, segments: ["admin", "materials"] },
    ],
  },
  {
    label: "nav.assessment" as const,
    items: [
      { label: "common.assignments" as const, icon: ClipboardList, segments: ["admin", "assignments"] },
      { label: "common.submissions" as const, icon: Inbox, segments: ["admin", "submissions"] },
    ],
  },
  {
    label: "nav.platform" as const,
    items: [
      { label: "common.subscriptionPlans" as const, icon: CreditCard, segments: ["admin", "plans"] },
      { label: "common.certificateManagement" as const, icon: Award, segments: ["admin", "certificates"] },
      { label: "nav.settings" as const, icon: Settings, segments: ["admin", "settings"] },
    ],
  },
];

export function AdminSidebar({ onNavigate }: { onNavigate?: () => void }) {
  const { t } = useI18n();
  const segments = useAppStore((s) => s.segments);
  const navigate = useAppStore((s) => s.navigate);
  const refreshUser = useAppStore((s) => s.refreshUser);
  const current = segments[1] || "overview";

  async function logout() {
    await apiPost("/api/auth/logout", null, { method: "POST" });
    await refreshUser();
    navigate([""]);
  }

  return (
    <aside className="glass-panel relative flex h-full w-full flex-col overflow-hidden border-r border-sidebar-border bg-gradient-to-b from-card via-card to-soft-sage/40">
      {/* Subtle accent right edge */}
      <div className="pointer-events-none absolute inset-y-0 right-0 w-px bg-gradient-to-b from-accent/0 via-accent/30 to-accent/0" />

      {/* Logo header */}
      <div className="flex h-16 shrink-0 items-center border-b border-sidebar-border/80 px-5">
        <BrandLogo onClick={() => { navigate(["admin", "overview"]); onNavigate?.(); }} />
      </div>

      <ScrollArea className="min-h-0 flex-1">
        <nav className="space-y-6 px-3 py-5">
          {NAV_SECTIONS.map((section) => (
            <div key={section.label} className="space-y-1">
              <p className="px-3 pb-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground/70">
                {t(section.label)}
              </p>
              {section.items.map((item) => {
                const active = current === item.segments[1];
                return (
                  <button
                    key={item.label}
                    onClick={() => { navigate(item.segments); onNavigate?.(); }}
                    className={cn(
                      "group relative flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-all duration-200",
                      active
                        ? "bg-soft-sage text-primary font-semibold"
                        : "font-medium text-muted-foreground hover:bg-muted/60 hover:text-foreground"
                    )}
                  >
                    {active && (
                      <span className="absolute left-0 top-1/2 h-6 -translate-y-1/2 w-1 rounded-r-full bg-primary" />
                    )}
                    <item.icon className={cn(
                      "h-4 w-4 shrink-0 transition-colors duration-200",
                      active
                        ? "text-primary"
                        : "text-muted-foreground/70 group-hover:text-foreground"
                    )} />
                    <span className="truncate">{t(item.label)}</span>
                  </button>
                );
              })}
            </div>
          ))}
        </nav>
      </ScrollArea>

      {/* Logout footer with separator */}
      <div className="relative shrink-0 border-t border-sidebar-border/80 p-3">
        <button
          onClick={logout}
          className="group flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-muted-foreground transition-all duration-200 hover:bg-destructive/5 hover:text-destructive"
        >
          <LogOut className="h-4 w-4 shrink-0 transition-colors duration-200 group-hover:text-destructive" />
          {t("common.logout")}
        </button>
      </div>
    </aside>
  );
}
