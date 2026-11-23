"use client";

import { useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { EmptyState } from "@/components/shared/empty-state";
import { useApiFetch, apiPost } from "@/hooks/use-api";
import { useAppStore } from "@/stores/app-store";
import { useI18n } from "@/lib/i18n/store";
import { toast } from "@/hooks/use-toast";
import { formatDate } from "@/types";
import {
  ArrowLeft, Building2, Mail, BookOpen, Video, Layers,
  ClipboardList, Pencil, Trash2, MoreHorizontal, GraduationCap,
  Eye, EyeOff, Calendar, FileText,
} from "lucide-react";

// ─── Types ──────────────────────────────────────────────────────────────
interface UniversityCourseRow {
  id: string;
  title: string;
  description: string | null;
  thumbnail: string | null;
  category: string | null;
  accessType: "FREE" | "PAID";
  isPublished: boolean;
  createdAt: string;
  videosCount: number;
  topicsCount: number;
  assignmentsCount: number;
}

interface UniversityDetail {
  id: string;
  name: string;
  logo: string | null;
  description: string | null;
  email: string;
  createdAt: string;
  updatedAt: string;
  courseCount: number;
  courses: UniversityCourseRow[];
}

interface UniversityDetailResponse {
  university: UniversityDetail;
}

// ─── Main Component ─────────────────────────────────────────────────────
export function AdminUniversityDetail({
  universityId,
  onBack,
}: {
  universityId: string;
  onBack: () => void;
}) {
  const { t } = useI18n();
  const navigate = useAppStore((s) => s.navigate);
  const [deleteOpen, setDeleteOpen] = useState(false);

  const { data, loading, error, refetch } = useApiFetch<UniversityDetailResponse>(
    `/api/admin/universities/${universityId}`
  );

  const university = data?.university;
  const publishedCourses = university?.courses.filter((c) => c.isPublished).length ?? 0;
  const totalVideos = university?.courses.reduce((sum, c) => sum + c.videosCount, 0) ?? 0;
  const totalTopics = university?.courses.reduce((sum, c) => sum + c.topicsCount, 0) ?? 0;
  const totalAssignments = university?.courses.reduce((sum, c) => sum + c.assignmentsCount, 0) ?? 0;

  const initials = useMemo(() => {
    if (!university) return "";
    return university.name
      .split(/\s+/)
      .map((w) => w[0])
      .filter(Boolean)
      .slice(0, 2)
      .join("")
      .toUpperCase();
  }, [university]);

  async function handleDelete() {
    if (!university) return;
    try {
      await apiPost(`/api/admin/universities/${university.id}`, null, { method: "DELETE" });
      toast({ title: t("common.success"), description: university.name });
      onBack();
    } catch {
      /* toast handled by apiPost */
    }
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <Skeleton className="h-9 w-9 rounded-lg" />
          <Skeleton className="h-6 w-32" />
        </div>
        <Skeleton className="h-40 w-full rounded-xl" />
        <div className="grid grid-cols-2 gap-3 sm:gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-24 rounded-xl" />
          ))}
        </div>
        <Skeleton className="h-64 w-full rounded-xl" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" size="sm" onClick={onBack} className="gap-2">
          <ArrowLeft className="h-4 w-4" /> {t("common.back")}
        </Button>
        <EmptyState
          icon={<Building2 className="h-5 w-5" />}
          title={t("common.error")}
          description={error}
          action={
            <Button onClick={onBack} className="gap-2">
              <ArrowLeft className="h-4 w-4" /> {t("common.back")}
            </Button>
          }
        />
      </div>
    );
  }

  if (!university) return null;

  return (
    <div className="space-y-6 animate-page-in">
      {/* Back button */}
      <Button variant="ghost" size="sm" onClick={onBack} className="gap-2 text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> {t("common.back")}
      </Button>

      {/* ─── University Header ─── */}
      <Card className="overflow-hidden border-border p-0 shadow-[0_2px_8px_rgba(37,51,43,0.06)]">
        {/* Gradient banner */}
        <div className="relative h-28 bg-gradient-to-br from-primary via-primary to-[#2A3F35]">
          <div
            className="absolute inset-0 opacity-30"
            style={{
              backgroundImage:
                "radial-gradient(circle at 20% 50%, rgba(120,151,134,0.55), transparent 55%), radial-gradient(circle at 80% 20%, rgba(252,252,250,0.12), transparent 45%)",
            }}
          />
        </div>
        <CardContent className="relative -mt-12 p-0">
          <div className="px-5 pb-5">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
              <div className="flex items-end gap-4">
                {/* Logo */}
                {university.logo ? (
                  <img
                    src={university.logo}
                    alt={`${university.name} logo`}
                    className="h-20 w-20 rounded-xl bg-background object-contain p-1.5 ring-4 ring-background shadow-md"
                  />
                ) : (
                  <div className="flex h-20 w-20 items-center justify-center rounded-xl bg-background text-primary font-heading text-2xl font-bold ring-4 ring-background shadow-md">
                    {initials || <GraduationCap className="h-7 w-7" />}
                  </div>
                )}
                <div className="pb-1">
                  <Badge className="gap-1 bg-soft-sage text-primary border-0 mb-2">
                    <Building2 className="h-3 w-3" /> {t("admin.universityPartner")}
                  </Badge>
                  <h1 className="font-heading text-2xl font-bold text-foreground">
                    {university.name}
                  </h1>
                  {university.description && (
                    <p className="text-sm text-muted-foreground mt-1 max-w-xl">
                      {university.description}
                    </p>
                  )}
                </div>
              </div>
              {/* Actions */}
              <div className="flex items-center gap-2 shrink-0">
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-2"
                  onClick={() => navigate(["admin", "universities"], { action: "edit", id: university.id })}
                >
                  <Pencil className="h-4 w-4" /> {t("common.edit")}
                </Button>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm" className="px-2" aria-label="More actions">
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => setDeleteOpen(true)} variant="destructive" className="gap-2">
                      <Trash2 className="h-4 w-4" /> {t("common.delete")}
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ─── Contact Info ─── */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Card className="border-border p-4 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-soft-sage text-primary shrink-0">
              <Mail className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{t("common.email")}</p>
              <p className="text-sm font-semibold text-foreground truncate">{university.email}</p>
            </div>
          </div>
        </Card>
        <Card className="border-border p-4 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary shrink-0">
              <Calendar className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{t("common.date")}</p>
              <p className="text-sm font-semibold text-foreground">{formatDate(university.createdAt)}</p>
            </div>
          </div>
        </Card>
        <Card className="border-border p-4 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-success/15 text-success shrink-0">
              <BookOpen className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{t("admin.totalCourses")}</p>
              <p className="text-sm font-semibold text-foreground">{university.courseCount}</p>
            </div>
          </div>
        </Card>
      </div>

      {/* ─── Stats Cards ─── */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4 sm:grid-cols-3 lg:grid-cols-4 stagger-children">
        <StatCard
          icon={<BookOpen className="h-5 w-5" />}
          label={t("dashboard.totalPublishedCourses")}
          value={publishedCourses}
          tone="forest"
        />
        <StatCard
          icon={<Layers className="h-5 w-5" />}
          label={t("common.topics")}
          value={totalTopics}
          tone="sage"
        />
        <StatCard
          icon={<Video className="h-5 w-5" />}
          label={t("dashboard.totalVideoLessons")}
          value={totalVideos}
          tone="forest"
        />
        <StatCard
          icon={<ClipboardList className="h-5 w-5" />}
          label={t("common.assignments")}
          value={totalAssignments}
          tone="sage"
        />
      </div>

      {/* ─── Courses Section ─── */}
      <div>
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="font-heading text-xl font-semibold text-foreground">{t("common.courses")}</h2>
            <p className="text-sm text-muted-foreground mt-0.5">
              {university.name}
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="gap-2"
            onClick={() => navigate(["admin", "courses"])}
          >
            <BookOpen className="h-4 w-4" /> {t("courses.viewInCourses")}
          </Button>
        </div>

        {university.courses.length === 0 ? (
          <EmptyState
            icon={<BookOpen className="h-5 w-5" />}
            title={t("empty.noCourses")}
            description={t("empty.noCoursesDesc")}
          />
        ) : (
          <Card className="overflow-hidden border-border p-0 shadow-sm">
            <div className="overflow-x-auto scrollbar-thin">
              <table className="w-full text-sm">
                <thead className="border-b border-border bg-muted/30">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">{t("table.course")}</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground hidden md:table-cell">{t("common.category")}</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">{t("common.type")}</th>
                    <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wider text-muted-foreground hidden sm:table-cell">{t("common.topics")}</th>
                    <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wider text-muted-foreground hidden sm:table-cell">{t("common.videos")}</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">{t("common.status")}</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-muted-foreground">{t("table.actions")}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {university.courses.map((c) => (
                    <tr key={c.id} className="transition-colors hover:bg-muted/30">
                      <td className="px-4 py-3">
                        <button
                          onClick={() => navigate(["admin", "courses", c.id])}
                          className="text-left"
                        >
                          <p className="font-medium text-foreground hover:text-accent transition-colors">{c.title}</p>
                          <p className="text-xs text-muted-foreground line-clamp-1 max-w-[240px]">
                            {c.description || t("common.description")}
                          </p>
                        </button>
                      </td>
                      <td className="px-4 py-3 text-sm text-muted-foreground hidden md:table-cell">
                        {c.category || "—"}
                      </td>
                      <td className="px-4 py-3">
                        {c.accessType === "FREE" ? (
                          <Badge className="bg-success/15 text-success border-0">{t("common.free")}</Badge>
                        ) : (
                          <Badge className="bg-primary text-primary-foreground border-0">{t("common.paid")}</Badge>
                        )}
                      </td>
                      <td className="px-4 py-3 text-center text-sm text-foreground hidden sm:table-cell">{c.topicsCount}</td>
                      <td className="px-4 py-3 text-center text-sm text-foreground hidden sm:table-cell">{c.videosCount}</td>
                      <td className="px-4 py-3">
                        {c.isPublished ? (
                          <Badge className="bg-success/15 text-success border-0 gap-1">
                            <span className="h-1.5 w-1.5 rounded-full bg-success" /> {t("common.published")}
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-muted-foreground">{t("common.draft")}</Badge>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="gap-1.5 h-8"
                          onClick={() => navigate(["admin", "courses", c.id])}
                        >
                          <Eye className="h-3.5 w-3.5" /> {t("common.manage")}
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        )}
      </div>

      {/* ─── Delete Confirmation ─── */}
      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("admin.deleteUniversityTitle")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("admin.deleteUniversityConfirm").replace("{name}", university.name)}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-white hover:bg-destructive/90"
              onClick={handleDelete}
            >
              {t("common.delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// ─── Stat Card Helper ───────────────────────────────────────────────────
function StatCard({
  icon,
  label,
  value,
  tone,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  tone: "forest" | "sage";
}) {
  const toneClass =
    tone === "forest" ? "bg-primary/10 text-primary" : "bg-soft-sage text-accent";
  return (
    <Card className="border-border p-4 sm:p-5 shadow-sm transition-all duration-200 hover:shadow-md overflow-hidden">
      <div className="flex items-center gap-3 min-w-0">
        <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${toneClass} shrink-0`}>
          {icon}
        </div>
        <div className="min-w-0">
          <p className="font-heading text-xl sm:text-2xl font-bold text-foreground leading-none truncate">
            {value.toLocaleString()}
          </p>
          <p className="text-xs font-medium text-muted-foreground mt-1.5 truncate">{label}</p>
        </div>
      </div>
    </Card>
  );
}
