"use client";

import { useState } from "react";
import { useAppStore } from "@/stores/app-store";
import { BrandLogo } from "@/components/shared/brand-logo";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard, BookOpen, PlayCircle, ClipboardList, CreditCard,
  Award, User, LogOut, GraduationCap, Building2,
  StickyNote, Bookmark, MessagesSquare, Bell, UserCheck, ChevronDown,
} from "lucide-react";
import { apiPost, useApiFetch } from "@/hooks/use-api";
import { useI18n } from "@/lib/i18n/store";

interface SidebarCertificate {
  id: string;
  certificateNumber: string;
  courseId: string;
  courseTitle: string;
  appName?: string;
  organizationName: string;
  universityName?: string | null;
  instructorName?: string | null;
  instructorSignatureUrl?: string | null;
  issuedAt: string;
}

const NAV = [
  { labelKey: "nav.dashboard", icon: LayoutDashboard, segments: ["student", "overview"] },
  { labelKey: "nav.exploreUniversities", icon: Building2, segments: ["student", "universities"] },
  { labelKey: "nav.exploreCourses", icon: BookOpen, segments: ["student", "courses"] },
  { labelKey: "nav.myAssignments", icon: ClipboardList, segments: ["student", "assignments"] },
  { labelKey: "nav.myNotes", icon: StickyNote, segments: ["student", "notes"] },
  { labelKey: "nav.myBookmarks", icon: Bookmark, segments: ["student", "bookmarks"] },
  { labelKey: "nav.discussions", icon: MessagesSquare, segments: ["student", "discussions"] },
  { labelKey: "nav.notifications", icon: Bell, segments: ["student", "notifications"] },
  { labelKey: "nav.mySubscription", icon: CreditCard, segments: ["student", "subscription"] },
  { labelKey: "nav.myCertificates", icon: Award, segments: ["student", "certificates"] },
  { labelKey: "nav.myProfile", icon: User, segments: ["student", "profile"] },
];

export function StudentSidebar({ onNavigate }: { onNavigate?: () => void }) {
  const { t } = useI18n();
  const segments = useAppStore((s) => s.segments);
  const navigate = useAppStore((s) => s.navigate);
  const refreshUser = useAppStore((s) => s.refreshUser);
  const current = segments[1] || "overview";
  const activeCertId = current === "certificates" ? segments[2] || null : null;
  const [certsExpanded, setCertsExpanded] = useState(true);

  const { data: certData } = useApiFetch<{ certificates: SidebarCertificate[] }>(
    "/api/student/certificates",
    { freshOnMount: true, revalidateOnFocus: true }
  );
  const earnedCerts = certData?.certificates || [];

  async function logout() {
    await apiPost("/api/auth/logout", null, { method: "POST" });
    await refreshUser();
    navigate([""]);
  }

  return (
    <aside className="glass-panel relative flex h-full w-full flex-col overflow-hidden border-r border-sidebar-border bg-gradient-to-b from-card via-card to-soft-sage/30">
      {/* Subtle accent right edge */}
      <div className="pointer-events-none absolute inset-y-0 right-0 w-px bg-gradient-to-b from-accent/0 via-accent/20 to-accent/0" />

      {/* Logo header — premium gradient accent */}
      <div className="relative flex h-16 shrink-0 items-center border-b border-sidebar-border/80 px-5">
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-soft-sage/40 via-transparent to-transparent" />
        <BrandLogo onClick={() => { navigate(["student", "overview"]); onNavigate?.(); }} />
      </div>

      <ScrollArea className="min-h-0 flex-1">
        <div className="px-3 py-5">
        <nav className="space-y-1">
          {/* Elegant section label */}
          <div className="flex items-center gap-2 px-3 pb-2.5">
            <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground/70">
              {t("nav.learningHub")}
            </span>
            <span className="h-px flex-1 bg-gradient-to-r from-border to-transparent" />
          </div>
          {NAV.map((item) => {
            const active = current === item.segments[1];
            const isCertItem = item.segments[1] === "certificates";
            return (
              <div key={item.labelKey}>
                <button
                  onClick={() => {
                    navigate(item.segments);
                    if (isCertItem && earnedCerts.length > 0) {
                      setCertsExpanded(true);
                    }
                    onNavigate?.();
                  }}
                  className={cn(
                    "group relative flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-all duration-200",
                    active
                      ? "bg-soft-sage text-primary font-semibold shadow-sm"
                      : "font-medium text-muted-foreground hover:bg-muted/70 hover:text-foreground"
                  )}
                >
                  {active && (
                    <span className="absolute left-0 top-1/2 h-7 -translate-y-1/2 w-1 rounded-r-full bg-primary shadow-[0_0_0_3px_rgba(52,79,66,0.12)]" />
                  )}
                  <item.icon className={cn(
                    "h-4 w-4 shrink-0 transition-colors duration-200",
                    active
                      ? "text-primary"
                      : "text-muted-foreground/70 group-hover:text-foreground"
                  )} />
                  <span className="flex-1 text-left truncate">{t(item.labelKey as any)}</span>
                  {isCertItem && earnedCerts.length > 0 && (
                    <span className="inline-flex items-center gap-1">
                      <Badge className="h-5 px-1.5 text-[10px] font-semibold bg-accent/15 text-accent border-0">
                        {earnedCerts.length}
                      </Badge>
                      <span
                        role="button"
                        tabIndex={0}
                        aria-label="Toggle earned certificates"
                        onClick={(e) => {
                          e.stopPropagation();
                          setCertsExpanded((v) => !v);
                        }}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            e.stopPropagation();
                            setCertsExpanded((v) => !v);
                          }
                        }}
                        className="p-0.5 rounded hover:bg-background/60 text-muted-foreground"
                      >
                        <ChevronDown
                          className={cn(
                            "h-3.5 w-3.5 transition-transform duration-200",
                            certsExpanded ? "rotate-0" : "-rotate-90"
                          )}
                        />
                      </span>
                    </span>
                  )}
                  {(!isCertItem || earnedCerts.length === 0) && active && (
                    <span className="h-1.5 w-1.5 rounded-full bg-primary ring-2 ring-primary/20" />
                  )}
                </button>

                {isCertItem && earnedCerts.length > 0 && certsExpanded && (
                  <div className="mt-1 ml-3 pl-2.5 border-l border-accent/25 space-y-1.5">
                    {earnedCerts.map((cert) => {
                      const certSelected = activeCertId === cert.id;
                      const appLabel = cert.appName || cert.organizationName;
                      return (
                        <button
                          key={cert.id}
                          onClick={() => {
                            navigate(["student", "certificates", cert.id]);
                            onNavigate?.();
                          }}
                          className={cn(
                            "w-full text-left rounded-lg border p-2 transition-all duration-150",
                            certSelected
                              ? "border-accent/50 bg-accent/10 shadow-xs"
                              : "border-border/70 bg-card/80 hover:border-accent/40 hover:bg-soft-sage/40"
                          )}
                        >
                          <p className="text-xs font-semibold text-foreground line-clamp-1">
                            {cert.courseTitle}
                          </p>
                          <div className="mt-1 space-y-0.5 text-[10px] text-muted-foreground">
                            {cert.universityName && (
                              <p className="flex items-center gap-1 truncate">
                                <Building2 className="h-2.5 w-2.5 text-accent shrink-0" />
                                <span className="truncate">{cert.universityName}</span>
                              </p>
                            )}
                            {cert.instructorName && (
                              <p className="flex items-center gap-1 truncate">
                                <UserCheck className="h-2.5 w-2.5 text-accent shrink-0" />
                                <span className="truncate">{cert.instructorName}</span>
                              </p>
                            )}
                            <p className="flex items-center justify-between gap-1 text-[10px]">
                              <span className="truncate text-primary/80 font-medium">{appLabel}</span>
                              <span className="font-mono text-[9px] text-muted-foreground/80 shrink-0">
                                {cert.certificateNumber.slice(-6)}
                              </span>
                            </p>
                          </div>
                          {cert.instructorSignatureUrl && (
                            <div className="mt-1.5 rounded border border-border/60 bg-white px-2 py-1 flex items-center justify-between gap-1.5">
                              <img
                                src={cert.instructorSignatureUrl}
                                alt={`${cert.instructorName || "Instructor"} signature`}
                                className="h-5 max-w-[110px] object-contain"
                              />
                              <span className="text-[9px] uppercase tracking-wider text-muted-foreground">
                                Signed
                              </span>
                            </div>
                          )}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </nav>

        {/* Premium upsell card */}
        <div className="mt-6 rounded-xl border border-accent/20 bg-gradient-to-br from-soft-sage to-accent/[0.04] p-4">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent/15 text-accent">
              <GraduationCap className="h-4 w-4" />
            </div>
            <div>
              <p className="text-xs font-semibold text-foreground">{t("student.keepLearning")}</p>
              <p className="text-[11px] text-muted-foreground">{t("student.stayConsistent")}</p>
            </div>
          </div>
        </div>
        </div>
      </ScrollArea>

      {/* Logout footer with separator */}
      <div className="relative shrink-0 border-t border-sidebar-border/80 p-3">
        <button
          onClick={logout}
          className="group flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-muted-foreground transition-all duration-200 hover:bg-destructive/5 hover:text-destructive"
        >
          <LogOut className="h-4 w-4 shrink-0 transition-colors duration-200 group-hover:text-destructive" />
          <span>{t("common.logout")}</span>
        </button>
      </div>
    </aside>
  );
}

// Unused export kept for tree-shaking clarity
export const _icons = { PlayCircle };
