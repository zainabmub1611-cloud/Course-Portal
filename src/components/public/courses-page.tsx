"use client";

import { useState, useMemo } from "react";
import { useAppStore } from "@/stores/app-store";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/shared/empty-state";
import { CourseThumbnail } from "@/components/shared/course-thumbnail";
import { UniversityBadge, type UniversityRef } from "@/components/shared/university-badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { useApiFetch } from "@/hooks/use-api";
import { BookOpen, Video, ShieldCheck, Search, Lock, SlidersHorizontal, X, Building2, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";
import type { CoursePublic } from "@/types";
import { useI18n } from "@/lib/i18n/store";

interface CoursesResponse {
  courses: CoursePublic[];
  universities?: UniversityRef[];
}

export function CoursesPage() {
  const { t } = useI18n();
  const navigate = useAppStore((s) => s.navigate);
  const { data, loading } = useApiFetch<CoursesResponse>("/api/public/courses");
  const [q, setQ] = useState("");
  const [category, setCategory] = useState("");
  const [universityFilter, setUniversityFilter] = useState<string>("all");

  const courses = data?.courses || [];
  const universities = data?.universities || [];

  const categories = useMemo(
    () => Array.from(new Set(courses.map((c) => c.category).filter(Boolean))) as string[],
    [courses]
  );

  const filtered = useMemo(() => {
    return courses.filter((c) => {
      if (category && c.category !== category) return false;
      if (universityFilter !== "all") {
        if (!c.university || c.university.id !== universityFilter) return false;
      }
      if (q && !`${c.title} ${c.description || ""}`.toLowerCase().includes(q.toLowerCase()))
        return false;
      return true;
    });
  }, [courses, q, category, universityFilter]);

  const activeUniversity = useMemo(() => {
    if (universityFilter === "all") return null;
    return universities.find((u) => u.id === universityFilter) || null;
  }, [universityFilter, universities]);

  function clearUniversityFilter() {
    setUniversityFilter("all");
  }

  function clearAll() {
    setQ("");
    setCategory("");
    setUniversityFilter("all");
  }

  const hasActiveFilters = q !== "" || category !== "" || universityFilter !== "all";

  return (
    <div className="mx-auto max-w-7xl px-4 md:px-6 lg:px-8 py-12 md:py-16">
      {/* Header */}
      <div className="mb-10 space-y-2">
        <p className="text-xs font-semibold uppercase tracking-wider text-accent">{t("courses.courseCatalog")}</p>
        <h1 className="font-heading text-2xl font-semibold tracking-tight text-foreground md:text-[32px]">
          {t("common.exploreCourses")}
        </h1>
        <p className="max-w-2xl text-sm text-muted-foreground md:text-base">
          {t("courses.browseCatalogDesc")}
        </p>
      </div>

      {/* Explore by University */}
      {universities.length > 0 && (
        <div className="mb-8">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-soft-sage text-accent">
                <Building2 className="h-4 w-4" />
              </span>
              <h2 className="font-heading text-base font-semibold tracking-tight text-foreground">
                {t("courses.exploreByUniversity")}
              </h2>
            </div>
            {activeUniversity && (
              <Button
                variant="ghost"
                size="sm"
                onClick={clearUniversityFilter}
                className="h-8 gap-1 text-muted-foreground hover:bg-soft-sage/60"
              >
                <X className="h-3.5 w-3.5" /> {t("courses.clear")}
              </Button>
            )}
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
            {universities.map((u) => {
              const isActive = universityFilter === u.id;
              return (
                <button
                  key={u.id}
                  onClick={() => setUniversityFilter(isActive ? "all" : u.id)}
                  className={cn(
                    "group flex min-h-[56px] items-center gap-3 rounded-lg border bg-card p-3 text-start shadow-sm transition-all duration-200 hover:shadow-md hover:-translate-y-0.5",
                    isActive
                      ? "border-primary ring-1 ring-primary/25"
                      : "border-border hover:border-accent/40"
                  )}
                  aria-pressed={isActive}
                >
                  {u.logo ? (
                    <img
                      src={u.logo}
                      alt={`${u.name} logo`}
                      className="h-9 w-9 shrink-0 rounded-lg object-cover bg-white ring-1 ring-border"
                    />
                  ) : (
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground ring-1 ring-primary/30">
                      <Building2 className="h-4 w-4" />
                    </span>
                  )}
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-foreground line-clamp-1 group-hover:text-primary transition-colors">
                      {u.name}
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {isActive ? t("courses.filtering") : t("courses.viewCourses")}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Active university banner */}
      {activeUniversity && (
        <Card className="mb-6 border-primary/20 bg-soft-sage/40 shadow-sm">
          <CardContent className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-soft-sage text-accent shrink-0 ring-1 ring-accent/20">
                <Building2 className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-foreground">
                  {t("courses.filteredBy")} {activeUniversity.name}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {t("common.showing")} {filtered.length} {t("courses.coursesFromUniversity")}
                </p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2 shrink-0">
              <Button
                variant="outline"
                size="sm"
                onClick={() => navigate(["universities", activeUniversity.id])}
                className="gap-1.5 h-9 border-border bg-card hover:bg-soft-sage"
              >
                {t("admin.viewDetails")}
                <ArrowRight className="h-3.5 w-3.5 rtl-mirror" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={clearUniversityFilter}
                className="gap-1.5 h-9 border-border bg-card hover:bg-soft-sage"
              >
                <X className="h-3.5 w-3.5" /> {t("courses.removeFilter")}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Filters */}
      <div className="mb-6 flex flex-col gap-3 rounded-lg border border-border bg-card p-4 md:flex-row md:items-center md:gap-4 shadow-sm">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={t("courses.searchPlaceholder")}
            className="h-11 sm:h-9 ps-9"
          />
        </div>
        {universities.length > 0 && (
          <Select value={universityFilter} onValueChange={setUniversityFilter}>
            <SelectTrigger className="md:w-52 w-full h-9" aria-label={t("courses.filterByUniversity")}>
              <Building2 className="h-3.5 w-3.5 text-muted-foreground mr-1.5" />
              <SelectValue placeholder={t("common.allUniversities")} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("common.allUniversities")}</SelectItem>
              {universities.map((u) => (
                <SelectItem key={u.id} value={u.id}>
                  {u.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        {categories.length > 0 && (
          <div className="flex items-center gap-2 overflow-x-auto pb-1 md:pb-0">
            <span className="hidden items-center gap-1.5 text-xs font-medium uppercase tracking-wider text-muted-foreground md:inline-flex">
              <SlidersHorizontal className="h-3.5 w-3.5" /> {t("courses.filter")}
            </span>
            <Button
              variant={category === "" ? "default" : "outline"}
              size="sm"
              onClick={() => setCategory("")}
              className={cn(
                "h-8 shrink-0",
                category === "" ? "bg-primary text-primary-foreground hover:bg-primary/90" : "border-border bg-card hover:bg-soft-sage"
              )}
            >
              {t("common.all")}
            </Button>
            {categories.map((cat) => (
              <Button
                key={cat}
                variant={category === cat ? "default" : "outline"}
                size="sm"
                onClick={() => setCategory(cat)}
                className={cn(
                  "h-8 shrink-0",
                  category === cat ? "bg-primary text-primary-foreground hover:bg-primary/90" : "border-border bg-card hover:bg-soft-sage"
                )}
              >
                {cat}
              </Button>
            ))}
          </div>
        )}
      </div>

      {/* Result count + clear all */}
      {!loading && (
        <div className="mb-4 flex items-center justify-between gap-3">
          <p className="text-xs text-muted-foreground">
            {t("common.showing")} <span className="font-medium text-foreground">{filtered.length}</span> {t("common.of")}{" "}
            <span className="font-medium text-foreground">{courses.length}</span> {t("common.courses")}
          </p>
          {hasActiveFilters && (
            <Button
              variant="ghost"
              size="sm"
              onClick={clearAll}
              className="h-7 gap-1 text-muted-foreground hover:bg-soft-sage/60"
            >
              <X className="h-3 w-3" /> {t("common.clearFilters")}
            </Button>
          )}
        </div>
      )}

      {loading ? (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <Card key={i} className="overflow-hidden p-0">
              <Skeleton className="h-44 w-full rounded-none" />
              <div className="space-y-3 p-5">
                <Skeleton className="h-4 w-1/3" />
                <Skeleton className="h-6 w-3/4" />
                <Skeleton className="h-4 w-full" />
              </div>
            </Card>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={<BookOpen className="h-5 w-5" />}
          title={t("courses.noCoursesFound")}
          description={t("courses.tryAdjusting")}
          action={
            hasActiveFilters ? (
              <Button variant="outline" onClick={clearAll} className="gap-1 border-border bg-card hover:bg-soft-sage">
                <X className="h-4 w-4" /> {t("courses.clearFilters")}
              </Button>
            ) : undefined
          }
        />
      ) : (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((c) => (
            <Card
              key={c.id}
              className="group cursor-pointer overflow-hidden p-0 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md hover:border-accent/40"
              onClick={() => navigate(["register"])}
            >
              <div className="relative h-44 overflow-hidden bg-muted">
                <CourseThumbnail
                  thumbnail={c.thumbnail}
                  firstVideoUrl={(c as any).firstVideoUrl}
                  firstVideoSource={(c as any).firstVideoSource}
                  alt={c.title}
                  className="h-full w-full"
                  showPlayOverlay
                />
                <div className="absolute top-3 left-3 flex gap-1.5">
                  <Badge
                    variant={c.accessType === "FREE" ? "secondary" : "default"}
                    className={cn(
                      c.accessType === "FREE"
                        ? "bg-success/15 text-success hover:bg-success/20"
                        : "bg-primary text-primary-foreground"
                    )}
                  >
                    {c.accessType === "FREE" ? t("common.free") : t("common.paid")}
                  </Badge>
                  {c.category && (
                    <Badge variant="outline" className="border-border bg-background/85 backdrop-blur">
                      {c.category}
                    </Badge>
                  )}
                </div>
                {c.accessType === "PAID" && (
                  <div className="absolute top-3 right-3">
                    <div className="flex items-center gap-1 rounded-full bg-background/85 px-2 py-1 text-xs font-medium text-muted-foreground backdrop-blur">
                      <Lock className="h-3 w-3" /> {t("courses.subscription")}
                    </div>
                  </div>
                )}
              </div>
              <CardContent className="space-y-2.5 p-5">
                <div className="space-y-2">
                  <h3 className="font-heading text-[15px] font-semibold tracking-tight text-foreground line-clamp-1 transition-colors group-hover:text-primary">
                    {c.title}
                  </h3>
                  {c.university && (
                    <UniversityBadge university={c.university} size="xs" />
                  )}
                  <p className="min-h-[2.5rem] text-sm text-muted-foreground line-clamp-2">
                    {c.description || t("courses.noDescription")}
                  </p>
                </div>
                <div className="flex items-center gap-4 border-t border-border pt-3 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1.5">
                    <BookOpen className="h-3.5 w-3.5" /> {c.topicsCount} {t("courses.topics")}
                  </span>
                  <span className="flex items-center gap-1.5">
                    <Video className="h-3.5 w-3.5" /> {c.videosCount} {t("courses.lessons")}
                  </span>
                  {c.accessType === "PAID" && c.planNames.length > 0 && (
                    <span className="flex items-center gap-1.5 truncate text-accent">
                      <ShieldCheck className="h-3.5 w-3.5" /> {c.planNames.join(", ")}
                    </span>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* CTA when filtering by university */}
      {activeUniversity && filtered.length > 0 && (
        <div className="mt-10 flex flex-col items-center gap-3 rounded-lg border border-accent/20 bg-soft-sage/40 p-6 text-center">
          <p className="text-sm text-muted-foreground">
            {t("courses.readyToStartAt").replace("{name}", activeUniversity.name)}
          </p>
          <Button
            onClick={() => navigate(["register"])}
            className="gap-2 shadow-sm bg-primary text-primary-foreground hover:bg-primary/90"
          >
            {t("courses.createAnAccount")}
            <ArrowRight className="h-4 w-4" />
          </Button>
        </div>
      )}
    </div>
  );
}
