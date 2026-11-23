"use client";
import { useI18n } from "@/lib/i18n/store";

import { useMemo, useState } from "react";
import { useAppStore } from "@/stores/app-store";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/shared/empty-state";
import { CourseThumbnail } from "@/components/shared/course-thumbnail";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { useApiFetch } from "@/hooks/use-api";
import {
  ArrowLeft, ArrowRight, BookOpen, Video, Building2, Globe, Mail,
  Phone, MapPin, ShieldCheck, Lock, Search, X, GraduationCap,
  Sparkles, Users, SlidersHorizontal,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface UniversityProfile {
  id: string;
  name: string;
  logo: string | null;
  coverImage: string | null;
  description: string | null;
  website: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  location: string | null;
  socialLinks: Record<string, string>;
}

interface ProfileCourse {
  id: string;
  title: string;
  description: string | null;
  thumbnail: string | null;
  firstVideoUrl: string | null;
  firstVideoSource: string | null;
  category: string | null;
  accessType: "FREE" | "PAID";
  level: "BEGINNER" | "INTERMEDIATE" | "ADVANCED";
  topicsCount: number;
  videosCount: number;
  planNames: string[];
}

interface UniversityProfileData {
  university: UniversityProfile;
  courses: ProfileCourse[];
  categories: string[];
  totalCourses: number;
}

const LEVEL_LABELS: Record<ProfileCourse["level"], string> = {
  BEGINNER: "Beginner",
  INTERMEDIATE: "Intermediate",
  ADVANCED: "Advanced",
};

const LEVEL_BADGE_CLASS: Record<ProfileCourse["level"], string> = {
  BEGINNER: "bg-success/15 text-success border-transparent",
  INTERMEDIATE: "bg-warning/15 text-warning border-transparent",
  ADVANCED: "bg-destructive/10 text-destructive border-transparent",
};

export function UniversityProfilePage({ universityId }: { universityId: string }) {
  const { t } = useI18n();
  const navigate = useAppStore((s) => s.navigate);
  const { data, loading, error } = useApiFetch<UniversityProfileData>(
    `/api/public/universities/${universityId}`
  );

  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("all");
  const [level, setLevel] = useState("all");
  const [accessType, setAccessType] = useState("all");
  const [sort, setSort] = useState("newest");

  const courses = data?.courses || [];

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = courses.filter((c) => {
      if (q) {
        const hay = `${c.title} ${c.description || ""} ${c.category || ""}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      if (category !== "all" && c.category !== category) return false;
      if (level !== "all" && c.level !== level) return false;
      if (accessType !== "all" && c.accessType !== accessType) return false;
      return true;
    });
    // Sorting
    if (sort === "alphabetical") {
      list.sort((a, b) => a.title.localeCompare(b.title, undefined, { sensitivity: "base" }));
    } else if (sort === "popular") {
      // popularity proxy — more lessons/videos = more content; we don't have
      // direct enrollment counts on the public endpoint.
      list.sort((a, b) => (b.videosCount + b.topicsCount) - (a.videosCount + a.topicsCount));
    }
    // "newest" — already sorted by createdAt desc from API
    return list;
  }, [courses, query, category, level, accessType, sort]);

  const hasActiveFilters =
    query !== "" ||
    category !== "all" ||
    level !== "all" ||
    accessType !== "all" ||
    sort !== "newest";

  function clearAll() {
    setQuery("");
    setCategory("all");
    setLevel("all");
    setAccessType("all");
    setSort("newest");
  }

  if (loading) {
    return <ProfileSkeleton />;
  }

  if (error || !data) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-16">
        <EmptyState
          icon={<Building2 className="h-5 w-5" />}
          title={error || "University not found"}
          description="The university you're looking for may have been removed or is temporarily unavailable."
          action={
            <Button onClick={() => navigate(["courses"])} className="gap-2">
              <ArrowLeft className="h-4 w-4" /> Back to catalog
            </Button>
          }
        />
      </div>
    );
  }

  const { university } = data;
  const socials = university.socialLinks || {};
  const socialEntries = Object.entries(socials).filter(([, v]) => v);

  return (
    <div className="mx-auto max-w-7xl px-4 md:px-6 lg:px-8 py-8 md:py-12">
      {/* Back link */}
      <button
        onClick={() => navigate(["courses"])}
        className="group inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-accent transition-colors mb-6"
      >
        <ArrowLeft className="h-4 w-4 group-hover:-translate-x-0.5 transition-transform" />
        Back to catalog
      </button>

      {/* ─── Hero cover + branding ─── */}
      <Card className="overflow-hidden border-border shadow-sm">
        {/* Cover banner */}
        <div className="relative h-48 sm:h-56 md:h-64 overflow-hidden bg-gradient-to-br from-primary via-primary to-accent/80">
          {university.coverImage ? (
            <img
              src={university.coverImage}
              alt={`${university.name} cover`}
              className="h-full w-full object-cover"
            />
          ) : (
            <div
              className="absolute inset-0"
              style={{
                backgroundImage:
                  "radial-gradient(circle at 20% 50%, rgba(120,151,134,0.45), transparent 55%), radial-gradient(circle at 85% 15%, rgba(252,252,250,0.14), transparent 45%), radial-gradient(circle at 70% 90%, rgba(67,134,106,0.35), transparent 50%)",
              }}
            />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-primary/40 via-transparent to-transparent" />
        </div>

        {/* Branding row */}
        <CardContent className="relative p-4 sm:p-6 md:p-8">
          {/* Logo overlapping cover */}
          <div className="-mt-14 sm:-mt-20 md:-mt-24 mb-4 flex flex-col sm:flex-row sm:items-end gap-4">
            <div className="flex h-20 w-20 sm:h-24 sm:w-24 md:h-28 md:w-28 items-center justify-center rounded-2xl bg-card shadow-md ring-1 ring-border overflow-hidden shrink-0">
              {university.logo ? (
                <img
                  src={university.logo}
                  alt={university.name}
                  className="h-full w-full object-cover"
                />
              ) : (
                <span className="flex h-full w-full items-center justify-center bg-primary text-primary-foreground">
                  <GraduationCap className="h-10 w-10" />
                </span>
              )}
            </div>
            <div className="flex-1 min-w-0 sm:pb-2">
              <div className="flex items-center gap-2 mb-1">
                <Badge className="bg-soft-sage text-primary border-accent/15">
                  <Building2 className="h-3 w-3" /> University
                </Badge>
                <Badge variant="outline" className="text-muted-foreground border-border">
                  <BookOpen className="h-3 w-3" /> {data.totalCourses} course{data.totalCourses === 1 ? "" : "s"}
                </Badge>
              </div>
              <h1 className="font-heading text-2xl md:text-3xl font-bold tracking-tight text-foreground">
                {university.name}
              </h1>
            </div>
            <div className="flex flex-wrap gap-2 sm:pb-2">
              {university.website && (
                <Button
                  size="sm"
                  variant="outline"
                  asChild
                  className="gap-1.5 border-border bg-card hover:bg-soft-sage"
                >
                  <a
                    href={university.website}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <Globe className="h-4 w-4 text-accent" /> Website
                  </a>
                </Button>
              )}
              <Button
                size="sm"
                onClick={() => navigate(["register"])}
                className="gap-2 shadow-sm"
              >
                Enroll <ArrowRight className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Description + contact info */}
          <div className="grid gap-6 md:grid-cols-[2fr_1fr] mt-4">
            <div>
              {university.description ? (
                <p className="text-sm md:text-base text-muted-foreground leading-relaxed">
                  {university.description}
                </p>
              ) : (
                <p className="text-sm text-muted-foreground italic">
                  No description provided.
                </p>
              )}
            </div>
            <div className="space-y-2 text-sm">
              {(university.contactEmail || university.contactPhone || university.location) && (
                <>
                  {university.contactEmail && (
                    <a
                      href={`mailto:${university.contactEmail}`}
                      className="flex items-center gap-2 text-muted-foreground hover:text-accent transition-colors"
                    >
                      <Mail className="h-4 w-4 text-accent shrink-0" />
                      <span className="truncate">{university.contactEmail}</span>
                    </a>
                  )}
                  {university.contactPhone && (
                    <a
                      href={`tel:${university.contactPhone}`}
                      className="flex items-center gap-2 text-muted-foreground hover:text-accent transition-colors"
                    >
                      <Phone className="h-4 w-4 text-accent shrink-0" />
                      <span className="truncate">{university.contactPhone}</span>
                    </a>
                  )}
                  {university.location && (
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <MapPin className="h-4 w-4 text-accent shrink-0" />
                      <span className="truncate">{university.location}</span>
                    </div>
                  )}
                </>
              )}
              {socialEntries.length > 0 && (
                <div className="flex flex-wrap gap-2 pt-1">
                  {socialEntries.map(([key, value]) => (
                    <a
                      key={key}
                      href={value}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 rounded-full border border-border bg-card px-2.5 py-1 text-xs text-muted-foreground hover:text-accent hover:border-accent/30 transition-colors capitalize"
                    >
                      <Globe className="h-3 w-3" />
                      {key}
                    </a>
                  ))}
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ─── Stats strip ─── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6">
        <StatPill
          icon={<BookOpen className="h-4 w-4" />}
          label="Total Courses"
          value={data.totalCourses}
        />
        <StatPill
          icon={<Video className="h-4 w-4" />}
          label="Video Lessons"
          value={data.courses.reduce((s, c) => s + c.videosCount, 0)}
        />
        <StatPill
          icon={<Users className="h-4 w-4" />}
          label="Categories"
          value={data.categories.length}
        />
        <StatPill
          icon={<Sparkles className="h-4 w-4" />}
          label="Free Courses"
          value={data.courses.filter((c) => c.accessType === "FREE").length}
        />
      </div>

      {/* ─── Course catalog section ─── */}
      <div className="mt-10">
        <div className="mb-6 space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wider text-accent">
            Available Courses
          </p>
          <h2 className="font-heading text-xl md:text-2xl font-semibold tracking-tight text-foreground">
            Explore {university.name}&apos;s catalog
          </h2>
          <p className="text-sm text-muted-foreground max-w-2xl">
            Browse all published courses from this university. Register an account and pick a
            learning plan to start your journey.
          </p>
        </div>

        {/* Filters toolbar */}
        <Card className="p-4 mb-6 shadow-sm">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[1fr_auto_auto_auto_auto] lg:items-center">
            <div className="relative sm:col-span-2 lg:col-span-1">
              <Search className="pointer-events-none absolute start-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search this university's courses..."
                className="w-full h-10 ps-9 pe-3 rounded-md border border-input bg-background text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                aria-label="Search courses"
              />
            </div>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger className="lg:w-44 w-full h-10" aria-label="Filter by category">
                <SelectValue placeholder="All categories" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All categories</SelectItem>
                {data.categories.map((c) => (
                  <SelectItem key={c} value={c}>{c}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={level} onValueChange={setLevel}>
              <SelectTrigger className="lg:w-40 w-full h-10" aria-label="Filter by level">
                <SelectValue placeholder="All levels" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All levels</SelectItem>
                <SelectItem value="BEGINNER">Beginner</SelectItem>
                <SelectItem value="INTERMEDIATE">Intermediate</SelectItem>
                <SelectItem value="ADVANCED">Advanced</SelectItem>
              </SelectContent>
            </Select>
            <Select value={accessType} onValueChange={setAccessType}>
              <SelectTrigger className="lg:w-36 w-full h-10" aria-label="Filter by type">
                <SelectValue placeholder="All types" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All types</SelectItem>
                <SelectItem value="FREE">Free</SelectItem>
                <SelectItem value="PAID">Paid</SelectItem>
              </SelectContent>
            </Select>
            <Select value={sort} onValueChange={setSort}>
              <SelectTrigger className="lg:w-40 w-full h-10" aria-label="Sort courses">
                <SlidersHorizontal className="h-3.5 w-3.5 text-muted-foreground me-1.5" />
                <SelectValue placeholder="Sort" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="newest">Newest</SelectItem>
                <SelectItem value="popular">Most popular</SelectItem>
                <SelectItem value="alphabetical">A → Z</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {hasActiveFilters && (
            <div className="mt-3 flex items-center justify-between border-t border-border pt-3">
              <p className="text-xs text-muted-foreground">
                Showing <span className="font-semibold text-foreground">{filtered.length}</span> of{" "}
                <span className="font-semibold text-foreground">{courses.length}</span> courses
              </p>
              <Button variant="ghost" size="sm" onClick={clearAll} className="h-7 gap-1 text-muted-foreground">
                <X className="h-3 w-3" /> Clear all
              </Button>
            </div>
          )}
        </Card>

        {!hasActiveFilters && (
          <p className="text-sm text-muted-foreground mb-4">
            Showing <span className="font-semibold text-foreground">{filtered.length}</span> of{" "}
            <span className="font-semibold text-foreground">{courses.length}</span> courses
          </p>
        )}

        {filtered.length === 0 ? (
          <EmptyState
            icon={<BookOpen className="h-5 w-5" />}
            title={courses.length === 0 ? "No courses published yet" : "No courses match your filters"}
            description={
              courses.length === 0
                ? "This university hasn't published any courses yet. Check back soon."
                : "Try adjusting your search or filters."
            }
            action={
              hasActiveFilters ? (
                <Button variant="outline" onClick={clearAll} className="gap-1.5">
                  <X className="h-4 w-4" /> Clear filters
                </Button>
              ) : undefined
            }
          />
        ) : (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map((c) => (
              <ProfileCourseCard key={c.id} course={c} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function ProfileCourseCard({ course }: { course: ProfileCourse }) {
  const navigate = useAppStore((s) => s.navigate);
  return (
    <Card
      className="group cursor-pointer overflow-hidden p-0 shadow-sm transition-all duration-200 hover:-translate-y-1 hover:shadow-md hover:border-accent/40"
      onClick={() => navigate(["register"])}
    >
      <div className="relative h-44 overflow-hidden bg-muted">
        <CourseThumbnail
          thumbnail={course.thumbnail}
          firstVideoUrl={course.firstVideoUrl}
          firstVideoSource={course.firstVideoSource}
          alt={course.title}
          className="h-full w-full"
          showPlayOverlay
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/30 via-transparent to-transparent" />
        <div className="absolute top-3 left-3 flex flex-wrap gap-1.5">
          <Badge
            className={cn(
              course.accessType === "FREE"
                ? "bg-success/15 text-success border-transparent backdrop-blur-sm"
                : "bg-primary text-primary-foreground border-transparent shadow-sm"
            )}
          >
            {course.accessType === "FREE" ? "Free" : "Paid"}
          </Badge>
          <Badge
            className={cn("backdrop-blur-sm", LEVEL_BADGE_CLASS[course.level])}
          >
            {LEVEL_LABELS[course.level]}
          </Badge>
          {course.category && (
            <Badge variant="outline" className="bg-background/85 backdrop-blur-sm border-border/60 text-foreground">
              {course.category}
            </Badge>
          )}
        </div>
        {course.accessType === "PAID" && (
          <div className="absolute top-3 right-3">
            <div className="flex items-center gap-1 rounded-full bg-background/85 px-2 py-1 text-xs font-medium text-muted-foreground backdrop-blur">
              <Lock className="h-3 w-3" /> Subscription
            </div>
          </div>
        )}
      </div>

      <CardContent className="p-5 space-y-3">
        <div className="space-y-2">
          <h3 className="font-heading text-base font-semibold text-foreground line-clamp-1 group-hover:text-accent transition-colors">
            {course.title}
          </h3>
          <p className="text-sm text-muted-foreground line-clamp-2 min-h-[2.5rem]">
            {course.description || "No description provided."}
          </p>
        </div>

        <div className="flex items-center gap-4 border-t border-border pt-3 text-xs text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <BookOpen className="h-3.5 w-3.5 text-accent" /> {course.topicsCount} topics
          </span>
          <span className="flex items-center gap-1.5">
            <Video className="h-3.5 w-3.5 text-accent" /> {course.videosCount} lessons
          </span>
          {course.accessType === "PAID" && course.planNames.length > 0 && (
            <span className="flex items-center gap-1.5 truncate text-accent">
              <ShieldCheck className="h-3.5 w-3.5" /> {course.planNames.join(", ")}
            </span>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function StatPill({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
}) {
  return (
    <Card className="p-4 shadow-sm">
      <div className="flex items-center gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-accent/10 text-accent ring-1 ring-accent/20">
          {icon}
        </div>
        <div className="min-w-0">
          <p className="font-heading text-xl font-bold text-foreground leading-none">
            {value.toLocaleString()}
          </p>
          <p className="text-xs text-muted-foreground mt-1.5 truncate">{label}</p>
        </div>
      </div>
    </Card>
  );
}

function ProfileSkeleton() {
  return (
    <div className="mx-auto max-w-7xl px-4 md:px-6 lg:px-8 py-8 md:py-12 space-y-6">
      <Skeleton className="h-4 w-32" />
      <Card className="overflow-hidden">
        <Skeleton className="h-56 w-full rounded-none" />
        <div className="p-6 md:p-8">
          <div className="flex items-end gap-4 -mt-20">
            <Skeleton className="h-24 w-24 rounded-2xl" />
            <div className="space-y-2 flex-1">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-7 w-64" />
            </div>
          </div>
          <div className="mt-6 grid gap-6 md:grid-cols-[2fr_1fr]">
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-20 w-full" />
          </div>
        </div>
      </Card>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <Skeleton key={i} className="h-20 rounded-lg" />
        ))}
      </div>
      <Skeleton className="h-12 w-full" />
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
    </div>
  );
}
