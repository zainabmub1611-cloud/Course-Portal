"use client";

import { useAppStore } from "@/stores/app-store";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/shared/empty-state";
import { CourseThumbnail } from "@/components/shared/course-thumbnail";
import { UniversityBadge } from "@/components/shared/university-badge";
import { useApiFetch } from "@/hooks/use-api";
import {
  ArrowRight, BookOpen, Award, Users, Clock, CheckCircle2,
  Sparkles, GraduationCap, Video, FileText, ShieldCheck, Star, TrendingUp,
  Building2, PlayCircle, Timer, Trophy, ChevronDown, Handshake
} from "lucide-react";
import { formatPrice, durationUnitLabel, type CoursePublic, type SubscriptionPlanPublic } from "@/types";
import { useI18n } from "@/lib/i18n/store";

export function HomePage() {
  const { t } = useI18n();
  const navigate = useAppStore((s) => s.navigate);

  const { data: coursesData, loading: coursesLoading } = useApiFetch<{ courses: CoursePublic[] }>(
    "/api/public/courses"
  );
  const { data: plansData, loading: plansLoading } = useApiFetch<{ plans: SubscriptionPlanPublic[] }>(
    "/api/public/plans"
  );
  const { data: uniData } = useApiFetch<{ universities: { id: string; name: string; logo: string | null; description: string | null; courseCount: number }[] }>(
    "/api/public/universities"
  );
  const { data: statsData } = useApiFetch<{
    universities: number;
    courses: number;
    lessons: number;
    students: number;
    certificates: number;
  }>("/api/public/stats");

  const courses = coursesData?.courses || [];
  const featured = courses.slice(0, 6);
  const plans = plansData?.plans || [];

  // Use universities from the dedicated API, falling back to course-derived data
  const universities = (() => {
    if (uniData?.universities && uniData.universities.length > 0) {
      return uniData.universities.slice(0, 6);
    }
    const map = new Map<string, { id: string; name: string; logo?: string | null; courseCount: number }>();
    for (const c of courses) {
      if (!c.university) continue;
      const existing = map.get(c.university.id);
      if (existing) existing.courseCount += 1;
      else map.set(c.university.id, { id: c.university.id, name: c.university.name, logo: c.university.logo ?? null, courseCount: 1 });
    }
    return Array.from(map.values()).sort((a, b) => b.courseCount - a.courseCount).slice(0, 6);
  })();

  const stats = [
    { icon: Building2, label: t("common.universities"), value: String(statsData?.universities ?? universities.length) },
    { icon: BookOpen, label: t("common.courses"), value: String(statsData?.courses ?? courses.length) },
    { icon: Users, label: t("public.enrolledStudents"), value: String(statsData?.students ?? 0) },
    { icon: Award, label: t("public.certificatesIssued"), value: String(statsData?.certificates ?? 0) },
  ];

  return (
    <div>
      {/* ─────────── Hero ─────────── */}
      <section className="relative overflow-hidden border-b border-border bg-soft-sage/40">
        <div
          className="pointer-events-none absolute inset-0 -z-10 opacity-90"
          style={{
            background:
              "radial-gradient(circle at 80% 20%, rgba(91,84,217,0.12), transparent 55%), radial-gradient(circle at 10% 80%, rgba(91,84,217,0.06), transparent 55%)",
          }}
        />
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-12 sm:py-16 lg:py-24">
          <div className="grid items-center gap-10 lg:grid-cols-2 lg:gap-16">
            {/* Left column */}
            <div className="space-y-6 animate-fade-in-up">
              <p className="text-xs font-semibold uppercase tracking-wider text-accent">
                {t("public.heroLabel")}
              </p>
              <h1 className="font-heading text-3xl font-bold leading-[1.12] tracking-tight text-foreground sm:text-4xl lg:text-[46px] text-balance">
                {t("public.heroTitleAlt")}
              </h1>
              <p className="text-base text-muted-foreground max-w-xl leading-relaxed md:text-lg">
                {t("public.heroDescAlt")}
              </p>
              <div className="flex flex-wrap items-center gap-3 pt-1">
                <Button
                  size="lg"
                  onClick={() => navigate(["courses"])}
                  className="gap-2 h-11 px-6 bg-primary text-primary-foreground hover:bg-primary/90 whitespace-nowrap"
                >
                  {t("common.exploreCourses")}
                  <ArrowRight className="h-4 w-4 rtl-mirror" />
                </Button>
                <Button
                  size="lg"
                  variant="outline"
                  onClick={() => {
                    const el = document.getElementById("featured-universities");
                    if (el) el.scrollIntoView({ behavior: "smooth" });
                    else navigate(["courses"]);
                  }}
                  className="gap-2 h-11 px-6 border-border bg-card hover:bg-soft-sage whitespace-nowrap"
                >
                  <Building2 className="h-4 w-4" />
                  {t("public.discoverUniversities")}
                </Button>
              </div>
              <div className="flex flex-wrap items-center gap-x-6 gap-y-2.5 pt-2 text-sm text-muted-foreground">
                <span className="flex items-center gap-1.5">
                  <Video className="h-4 w-4 text-accent" /> {t("public.recordedVideoLessons")}
                </span>
                <span className="flex items-center gap-1.5">
                  <Award className="h-4 w-4 text-accent" /> {t("public.verifiableCertificatesShort")}
                </span>
                <span className="flex items-center gap-1.5">
                  <ShieldCheck className="h-4 w-4 text-accent" /> {t("public.structuredLearningPaths")}
                </span>
              </div>
            </div>

            {/* Right column — visual composition */}
            <div className="relative animate-fade-in-up">
              <div className="relative space-y-4">
                {/* Top: university identity strip */}
                <div className="rounded-lg border border-border bg-card p-4 shadow-sm">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                        <GraduationCap className="h-5 w-5" />
                      </div>
                      <div>
                        <p className="font-heading text-sm font-semibold tracking-tight text-foreground">
                          {t("public.multiUniversityCatalog")}
                        </p>
                        <p className="text-xs text-muted-foreground">{t("public.browseCoursesAcrossInstitutions")}</p>
                      </div>
                    </div>
                    <Badge className="bg-success/15 text-success hover:bg-success/15" variant="secondary">
                      {t("public.live")}
                    </Badge>
                  </div>
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    {universities.slice(0, 4).map((u) => (
                      <button
                        key={u.id}
                        type="button"
                        onClick={() => navigate(["universities", u.id])}
                        className="inline-flex items-center gap-1.5 rounded-md border border-border bg-muted/50 px-2.5 py-1 text-xs font-medium text-foreground transition-colors hover:border-primary/40 hover:bg-soft-sage"
                      >
                        {u.logo ? (
                          <img src={u.logo} alt="" className="h-3.5 w-3.5 rounded object-cover" />
                        ) : (
                          <Building2 className="h-3 w-3 text-accent" />
                        )}
                        <span className="truncate max-w-[140px]">{u.name}</span>
                      </button>
                    ))}
                    {universities.length === 0 && (
                      <span className="text-xs text-muted-foreground">{t("empty.noUniversities")}</span>
                    )}
                  </div>
                </div>

                {/* Middle: featured course card */}
                {featured[0] && (
                  <button
                    type="button"
                    onClick={() => navigate(["courses"])}
                    className="w-full text-start rounded-lg border border-border bg-card p-4 shadow-sm transition-all duration-200 hover:shadow-md hover:border-accent/40"
                  >
                    <div className="flex items-start gap-3">
                      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-soft-sage text-accent">
                        <PlayCircle className="h-6 w-6" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="mb-1 flex items-center gap-2 text-xs text-muted-foreground">
                          <span className="font-semibold text-primary">
                            {featured[0].accessType === "FREE" ? t("common.free") : t("common.paid")}
                          </span>
                          {featured[0].category && (
                            <>
                              <span aria-hidden="true">·</span>
                              <span>{featured[0].category}</span>
                            </>
                          )}
                        </div>
                        <p className="font-heading text-sm font-semibold tracking-tight text-foreground line-clamp-1">
                          {featured[0].title}
                        </p>
                        <p className="mt-0.5 text-xs text-muted-foreground line-clamp-1">
                          {featured[0].description || t("courses.noDescription")}
                        </p>
                      </div>
                    </div>
                    <div className="mt-3 flex items-center justify-between border-t border-border pt-3 text-xs text-muted-foreground tabular-nums">
                      <span className="flex items-center gap-1.5">
                        <Video className="h-3.5 w-3.5 text-accent" /> {featured[0].videosCount} {t("courses.lessons")}
                      </span>
                      <span className="flex items-center gap-1.5">
                        <BookOpen className="h-3.5 w-3.5 text-accent" /> {featured[0].topicsCount} {t("courses.topics")}
                      </span>
                    </div>
                  </button>
                )}

                {/* Bottom: certificate preview */}
                <div className="rounded-lg border border-border bg-card p-4 shadow-sm">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-success/15 text-success">
                      <Trophy className="h-5 w-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-heading text-sm font-semibold tracking-tight text-foreground">
                        {t("public.certificateEarnedShort")}
                      </p>
                      <p className="text-xs text-muted-foreground">{t("public.verifiableId")} · {t("public.feature.certificates")}</p>
                    </div>
                    <ShieldCheck className="h-5 w-5 text-success shrink-0" />
                  </div>
                </div>
              </div>
              <div className="hidden lg:block absolute -bottom-4 -right-4 -z-10 h-full w-full rounded-lg border border-accent/20 bg-soft-sage/50" />
            </div>
          </div>
        </div>
      </section>

      {/* ─────────── Stats bar ─────────── */}
      <section className="border-b border-border bg-card">
        <div className="mx-auto max-w-7xl px-4 md:px-6 lg:px-8 py-10">
          <div className="grid grid-cols-2 gap-6 md:grid-cols-4 md:divide-x md:divide-border stagger-children">
            {stats.map((s, idx) => (
              <div
                key={s.label}
                className={`flex items-center gap-3 ${idx > 0 ? "md:pl-6" : ""}`}
              >
                <div className="stat-icon bg-soft-sage text-accent">
                  <s.icon className="h-5 w-5" />
                </div>
                <div>
                  <p className="font-heading text-2xl font-bold tabular-nums leading-none text-foreground">
                    {s.value}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">{s.label}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─────────── Featured Universities ─────────── */}
      <section id="featured-universities" className="mx-auto max-w-7xl px-4 md:px-6 lg:px-8 py-16">
        <div className="mb-8 flex flex-col items-start justify-between gap-4 md:flex-row md:items-end">
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wider text-accent">
              {t("public.featuredUniversities")}
            </p>
            <h2 className="font-heading text-2xl font-semibold tracking-tight text-foreground md:text-[28px]">
              {t("public.learnFromTrustedInstitutions")}
            </h2>
          </div>
          <Button
            variant="outline"
            onClick={() => navigate(["courses"])}
            className="gap-2 h-9 border-border bg-card hover:bg-soft-sage"
          >
            {t("public.browseAllCourses")}
            <ArrowRight className="h-4 w-4 rtl-mirror" />
          </Button>
        </div>

        {coursesLoading && universities.length === 0 ? (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3].map((i) => (
              <Card key={i} className="p-5 shadow-sm">
                <div className="flex items-center gap-3">
                  <Skeleton className="h-12 w-12 rounded-lg" />
                  <div className="space-y-2">
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className="h-3 w-20" />
                  </div>
                </div>
                <Skeleton className="mt-4 h-3 w-full" />
              </Card>
            ))}
          </div>
        ) : universities.length === 0 ? (
          <Card className="border-dashed p-8 text-center">
            <Building2 className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
            <p className="text-sm font-medium text-foreground">{t("empty.noUniversities")}</p>
            <p className="text-xs text-muted-foreground mt-1">{t("empty.noUniversitiesDesc")}</p>
          </Card>
        ) : (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {universities.map((u) => (
              <Card
                key={u.id}
                className="group cursor-pointer p-5 shadow-sm transition-all duration-200 hover:shadow-md hover:-translate-y-0.5 hover:border-accent/40"
                onClick={() => navigate(["universities", u.id])}
              >
                <div className="flex items-center gap-4">
                  {u.logo ? (
                    <img
                      src={u.logo}
                      alt={`${u.name} logo`}
                      className="h-12 w-12 rounded-lg object-cover bg-white ring-1 ring-border"
                    />
                  ) : (
                    <span className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary text-primary-foreground ring-1 ring-primary/30">
                      <Building2 className="h-5 w-5" />
                    </span>
                  )}
                  <div className="min-w-0 flex-1">
                    <h3 className="font-heading text-base font-semibold tracking-tight text-foreground line-clamp-1 transition-colors group-hover:text-primary">
                      {u.name}
                    </h3>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {u.courseCount} {t("public.coursesPublished")}
                    </p>
                  </div>
                </div>
                <div className="mt-4 flex items-center justify-between border-t border-border pt-3">
                  <span className="text-xs text-muted-foreground">{t("public.exploreCatalog")}</span>
                  <ArrowRight className="h-4 w-4 text-accent transition-transform group-hover:translate-x-0.5" />
                </div>
              </Card>
            ))}
          </div>
        )}
      </section>

      {/* ─────────── Explore Courses ─────────── */}
      <section id="courses" className="border-y border-border bg-muted/40">
        <div className="mx-auto max-w-7xl px-4 md:px-6 lg:px-8 py-16">
          <div className="mb-8 flex flex-col items-start justify-between gap-4 md:flex-row md:items-end">
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wider text-accent">
                {t("common.exploreCourses")}
              </p>
              <h2 className="font-heading text-2xl font-semibold tracking-tight text-foreground md:text-[28px]">
                {t("public.startLearningPopular")}
              </h2>
            </div>
            <Button
              variant="outline"
              onClick={() => navigate(["courses"])}
              className="gap-2 h-9 border-border bg-card hover:bg-soft-sage"
            >
              {t("public.viewAllCourses")}
              <ArrowRight className="h-4 w-4" />
            </Button>
          </div>

          {coursesLoading ? (
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {[1, 2, 3].map((i) => (
                <Card key={i} className="overflow-hidden p-0">
                  <Skeleton className="h-44 w-full rounded-none" />
                  <div className="space-y-3 p-5">
                    <Skeleton className="h-4 w-1/3" />
                    <Skeleton className="h-6 w-3/4" />
                    <Skeleton className="h-4 w-full" />
                    <Skeleton className="h-4 w-2/3" />
                  </div>
                </Card>
              ))}
            </div>
          ) : featured.length === 0 ? (
            <EmptyState
              icon={<BookOpen className="h-5 w-5" />}
              title={t("public.noCoursesPublishedYet")}
              description={t("public.noCoursesPublishedDesc")}
            />
          ) : (
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {featured.map((c) => (
                <CourseCardMini key={c.id} course={c} onOpen={() => navigate(["courses"])} />
              ))}
            </div>
          )}
        </div>
      </section>

      {/* ─────────── How It Works ─────────── */}
      <section className="mx-auto max-w-7xl px-4 md:px-6 lg:px-8 py-20">
        <div className="mb-12 space-y-2 text-center">
          <p className="text-xs font-semibold uppercase tracking-wider text-accent">{t("public.howItWorks")}</p>
          <h2 className="font-heading text-2xl font-semibold tracking-tight text-foreground md:text-[28px]">
            {t("public.threeStepsToCertificate")}
          </h2>
          <p className="mx-auto max-w-2xl text-sm text-muted-foreground md:text-base">
            {t("public.howItWorksDesc")}
          </p>
        </div>
        <div className="grid gap-5 md:grid-cols-3">
          {[
            { icon: BookOpen, step: "01", title: t("public.stepDiscover"), desc: t("public.stepDiscoverDesc") },
            { icon: ShieldCheck, step: "02", title: t("public.stepChoose"), desc: t("public.stepChooseDesc") },
            { icon: Award, step: "03", title: t("public.stepLearnEarn"), desc: t("public.stepLearnEarnDesc") },
          ].map((s) => (
            <Card key={s.step} className="relative p-6 shadow-sm transition-all duration-200 hover:shadow-md">
              <div className="absolute right-5 top-5 font-heading text-3xl font-bold tabular-nums text-soft-sage">
                {s.step}
              </div>
              <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-lg bg-soft-sage text-accent">
                <s.icon className="h-5 w-5" />
              </div>
              <h3 className="font-heading text-base font-semibold tracking-tight text-foreground">
                {s.title}
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{s.desc}</p>
            </Card>
          ))}
        </div>
      </section>

      {/* ─────────── Interactive Learning ─────────── */}
      <section className="border-y border-border bg-muted/40">
        <div className="mx-auto max-w-7xl px-4 md:px-6 lg:px-8 py-20">
          <div className="grid items-center gap-12 lg:grid-cols-2 lg:gap-16">
            <div className="space-y-5">
              <p className="text-xs font-semibold uppercase tracking-wider text-accent">
                {t("public.interactiveLearning")}
              </p>
              <h2 className="font-heading text-2xl font-semibold tracking-tight text-foreground md:text-[28px]">
                {t("public.builtForActiveLearning")}
              </h2>
              <p className="text-sm leading-relaxed text-muted-foreground md:text-base">
                {t("public.interactiveLearningDesc")}
              </p>
              <div className="space-y-3 pt-2">
                {[
                  { icon: Video, title: t("public.feature.videoBased"), desc: t("public.feature.videoBasedDesc") },
                  { icon: Timer, title: t("public.feature.timedQuestions"), desc: t("public.feature.timedQuestionsDesc") },
                  { icon: FileText, title: t("public.feature.assignments"), desc: t("public.feature.assignmentsDesc") },
                  { icon: Trophy, title: t("public.feature.certificates"), desc: t("public.feature.certificatesDesc") },
                ].map((f) => (
                  <div
                    key={f.title}
                    className="flex items-start gap-3 rounded-lg border border-border bg-card p-4 transition-all duration-200 hover:border-accent/40 hover:shadow-sm"
                  >
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-soft-sage text-accent">
                      <f.icon className="h-4 w-4" />
                    </div>
                    <div>
                      <p className="font-heading text-sm font-semibold tracking-tight text-foreground">
                        {f.title}
                      </p>
                      <p className="mt-0.5 text-xs text-muted-foreground">{f.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Visual: assessment mockup */}
            <div className="relative">
              <div className="rounded-lg border border-border bg-card p-6 shadow-sm">
                <div className="mb-4 flex items-center justify-between border-b border-border pb-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                      <Timer className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="font-heading text-sm font-semibold tracking-tight text-foreground">
                        {t("public.assessmentMockup")}
                      </p>
                      <p className="text-xs text-muted-foreground">{t("public.question2Of5")}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 rounded-full bg-warning/15 px-2.5 py-1 text-xs font-medium text-warning">
                    <Clock className="h-3 w-3" /> 00:47
                  </div>
                </div>
                <p className="text-sm font-medium text-foreground">
                  {t("public.contentFunnelQuestion")}
                </p>
                <div className="mt-4 space-y-2">
                  {[
                    { label: t("public.increaseSocialFollowers"), selected: false },
                    { label: t("public.guideProspectsConversion"), selected: true },
                    { label: t("public.reduceAdSpend"), selected: false },
                    { label: t("public.improveEmailDeliverability"), selected: false },
                  ].map((opt) => (
                    <div
                      key={opt.label}
                      className={`flex items-center gap-3 rounded-lg border p-3 text-sm transition-all duration-200 ${
                        opt.selected
                          ? "border-primary bg-soft-sage text-foreground"
                          : "border-border bg-card text-muted-foreground"
                      }`}
                    >
                      <span
                        className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border ${
                          opt.selected ? "border-primary bg-primary text-primary-foreground" : "border-border"
                        }`}
                      >
                        {opt.selected && <CheckCircle2 className="h-3 w-3" />}
                      </span>
                      {opt.label}
                    </div>
                  ))}
                </div>
                <div className="mt-4 flex items-center justify-between border-t border-border pt-4">
                  <span className="text-xs text-muted-foreground">{t("public.autoGradedOnSubmit")}</span>
                  <span className="inline-flex items-center gap-1.5 text-xs font-medium text-success">
                    <ShieldCheck className="h-3.5 w-3.5" /> {t("public.verifiedProgress")}
                  </span>
                </div>
              </div>
              <div className="absolute -bottom-3 -right-3 -z-10 h-full w-full rounded-lg border border-accent/20 bg-soft-sage/40" />
            </div>
          </div>
        </div>
      </section>

      {/* ─────────── Learning Plans ─────────── */}
      <section id="plans" className="mx-auto max-w-7xl px-4 md:px-6 lg:px-8 py-20">
        <div className="mb-10 space-y-3 text-center">
          <p className="text-xs font-semibold uppercase tracking-wider text-accent">
            {t("nav.learningPlans")}
          </p>
          <h2 className="font-heading text-2xl font-semibold tracking-tight text-foreground md:text-[28px]">
            {t("public.choosePlanFitsGoals")}
          </h2>
          <p className="mx-auto max-w-2xl text-sm text-muted-foreground">
            {t("public.transparentPricing")}
          </p>
        </div>

        {plansLoading ? (
          <div className="grid gap-5 md:grid-cols-3">
            {[1, 2, 3].map((i) => (
              <Card key={i} className="p-6">
                <Skeleton className="mb-4 h-6 w-1/3" />
                <Skeleton className="mb-2 h-10 w-2/3" />
                <Skeleton className="mb-6 h-4 w-1/2" />
                <div className="space-y-3">
                  {[1, 2, 3, 4].map((j) => (
                    <Skeleton key={j} className="h-4 w-full" />
                  ))}
                </div>
                <Skeleton className="mt-6 h-10 w-full" />
              </Card>
            ))}
          </div>
        ) : plans.length === 0 ? (
          <EmptyState
            icon={<TrendingUp className="h-5 w-5" />}
            title={t("public.noSubscriptionPlansYet")}
            description={t("public.noPlansDesc")}
          />
        ) : (
          <div className="mx-auto grid max-w-5xl gap-5 md:grid-cols-3 md:items-start">
            {plans.map((p) => (
              <PlanCard
                key={p.id}
                plan={p}
                onSelect={() => navigate(["register"], { planId: p.id })}
              />
            ))}
          </div>
        )}
      </section>

      {/* ─────────── University Partnership ─────────── */}
      <section className="border-y border-border bg-soft-sage/40">
        <div className="mx-auto max-w-7xl px-4 md:px-6 lg:px-8 py-20">
          <div className="grid items-center gap-10 lg:grid-cols-2 lg:gap-16">
            <div className="space-y-5">
              <p className="text-xs font-semibold uppercase tracking-wider text-accent">
                {t("public.universityPartnership")}
              </p>
              <h2 className="font-heading text-2xl font-semibold tracking-tight text-foreground md:text-[28px]">
                {t("public.bringInstitutionToCourseLearn")}
              </h2>
              <p className="text-sm leading-relaxed text-muted-foreground md:text-base">
                {t("public.partnershipDescAlt")}
              </p>
              <div className="flex flex-wrap items-center gap-3 pt-2">
                <Button
                  size="lg"
                  onClick={() => navigate(["register"])}
                  className="gap-2 h-11 px-6 bg-primary text-primary-foreground hover:bg-primary/90"
                >
                  <Handshake className="h-4 w-4" />
                  {t("public.becomePartner")}
                </Button>
                <Button
                  size="lg"
                  variant="outline"
                  onClick={() => navigate(["about"])}
                  className="h-11 px-6 border-border bg-card hover:bg-soft-sage"
                >
                  {t("public.learnMore")}
                </Button>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              {[
                { icon: Building2, title: t("public.publishCourses"), desc: t("public.publishCoursesDesc") },
                { icon: Video, title: t("public.deliverLessons"), desc: t("public.deliverLessonsDesc") },
                { icon: FileText, title: t("public.assessLearners"), desc: t("public.assessLearnersDesc") },
                { icon: Award, title: t("public.issueCertificates"), desc: t("public.issueCertificatesDesc") },
              ].map((f) => (
                <Card key={f.title} className="p-5 shadow-sm transition-all duration-200 hover:shadow-md">
                  <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-soft-sage text-accent">
                    <f.icon className="h-5 w-5" />
                  </div>
                  <h3 className="font-heading text-sm font-semibold tracking-tight text-foreground">
                    {f.title}
                  </h3>
                  <p className="mt-1 text-xs text-muted-foreground">{f.desc}</p>
                </Card>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ─────────── FAQ ─────────── */}
      <section className="mx-auto max-w-3xl px-4 md:px-6 lg:px-8 py-20">
        <div className="mb-10 space-y-2 text-center">
          <p className="text-xs font-semibold uppercase tracking-wider text-accent">{t("public.faqAlt")}</p>
          <h2 className="font-heading text-2xl font-semibold tracking-tight text-foreground md:text-[28px]">
            {t("public.faq")}
          </h2>
        </div>
        <div className="space-y-3">
          {[
            {
              q: t("public.faqStarted"),
              a: t("public.faqStartedAns"),
            },
            {
              q: t("public.faqCertificatesVerifiable"),
              a: t("public.faqCertificatesVerifiableAns"),
            },
            {
              q: t("public.faqProgressTracking"),
              a: t("public.faqProgressTrackingAns"),
            },
            {
              q: t("public.faqMultipleUniversities"),
              a: t("public.faqMultipleUniversitiesAns"),
            },
            {
              q: t("public.faqPlanExpire"),
              a: t("public.faqPlanExpireAns"),
            },
          ].map((item) => (
            <details
              key={item.q}
              className="group rounded-lg border border-border bg-card p-0 shadow-sm transition-all duration-200 hover:border-accent/40 [&[open]]:shadow-md"
            >
              <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-5 py-4">
                <span className="font-heading text-sm font-semibold tracking-tight text-foreground">
                  {item.q}
                </span>
                <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200 group-open:rotate-180" />
              </summary>
              <div className="px-5 pb-5 text-sm leading-relaxed text-muted-foreground">
                {item.a}
              </div>
            </details>
          ))}
        </div>
      </section>

      {/* ─────────── CTA ─────────── */}
      <section className="hero-gradient bg-primary text-primary-foreground">
        <div className="mx-auto max-w-7xl px-4 md:px-6 lg:px-8 py-16 text-center md:py-20">
          <h2 className="font-heading text-2xl font-semibold tracking-tight md:text-[32px]">
            {t("public.readyToStartJourney")}
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-sm text-primary-foreground/80 md:text-base">
            {t("public.ctaCreateAccount")}
          </p>
          <div className="mt-7 flex flex-wrap justify-center gap-3">
            <Button
              size="lg"
              variant="secondary"
              onClick={() => navigate(["register"])}
              className="gap-2 h-11 px-6 bg-primary-foreground text-primary hover:bg-primary-foreground/90"
            >
              {t("common.getStarted")}
              <ArrowRight className="h-4 w-4" />
            </Button>
            <Button
              size="lg"
              variant="outline"
              onClick={() => navigate(["courses"])}
              className="h-11 border-primary-foreground/30 bg-transparent px-6 text-primary-foreground hover:bg-primary-foreground/10 hover:text-primary-foreground"
            >
              {t("public.browseCoursesShort")}
            </Button>
          </div>
        </div>
      </section>
    </div>
  );
}

function CourseCardMini({ course, onOpen }: { course: CoursePublic; onOpen: () => void }) {
  const { t } = useI18n();
  return (
    <Card
      className="group card-glow cursor-pointer overflow-hidden p-0 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md hover:border-accent/40"
      onClick={onOpen}
    >
      <div className="relative h-44 overflow-hidden bg-muted">
        <CourseThumbnail
          thumbnail={course.thumbnail}
          firstVideoUrl={(course as any).firstVideoUrl}
          firstVideoSource={(course as any).firstVideoSource}
          alt={course.title}
          className="h-full w-full"
          showPlayOverlay
        />
        <div className="absolute top-3 left-3 flex gap-1.5">
          <Badge
            variant={course.accessType === "FREE" ? "secondary" : "default"}
            className={
              course.accessType === "FREE"
                ? "bg-success/15 text-success hover:bg-success/20"
                : "bg-primary text-primary-foreground"
            }
          >
            {course.accessType === "FREE" ? t("common.free") : t("common.paid")}
          </Badge>
          {course.category && (
            <Badge variant="outline" className="border-border bg-background/85 backdrop-blur">
              {course.category}
            </Badge>
          )}
        </div>
      </div>
      <CardContent className="space-y-2.5 p-5">
        <h3 className="font-heading text-[15px] font-semibold tracking-tight text-foreground line-clamp-1 transition-colors group-hover:text-primary">
          {course.title}
        </h3>
        {course.university && (
          <UniversityBadge university={course.university} size="xs" />
        )}
        <p className="min-h-[2.5rem] text-sm text-muted-foreground line-clamp-2">
          {course.description || t("courses.noDescription")}
        </p>
        <div className="flex items-center gap-4 border-t border-border pt-3 text-xs text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <BookOpen className="h-3.5 w-3.5" /> {course.topicsCount} {t("courses.topics")}
          </span>
          <span className="flex items-center gap-1.5">
            <Video className="h-3.5 w-3.5" /> {course.videosCount} {t("courses.lessons")}
          </span>
          {course.accessType === "PAID" && course.planNames.length > 0 && (
            <span className="flex items-center gap-1.5 text-accent">
              <ShieldCheck className="h-3.5 w-3.5" /> {course.planNames.join(", ")}
            </span>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function PlanCard({ plan, onSelect }: { plan: SubscriptionPlanPublic; onSelect: () => void }) {
  const { t } = useI18n();
  return (
    <Card
      className={`relative flex flex-col ${plan.isPopular ? "card-glow" : "card-elevated"} p-6 transition-all duration-200 hover:shadow-md ${
        plan.isPopular
          ? "border-accent/60 ring-1 ring-accent/25 shadow-md"
          : "hover:border-accent/40"
      }`}
    >
      {plan.isPopular && (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2">
          <Badge className="bg-primary text-primary-foreground shadow-sm">
            <Star className="h-3 w-3 fill-current" /> {t("common.popularPlan")}
          </Badge>
        </div>
      )}
      <div className="mb-4">
        <h3 className="font-heading text-lg font-semibold tracking-tight text-foreground">
          {plan.name}
        </h3>
        {plan.description && (
          <p className="mt-1 text-sm text-muted-foreground line-clamp-2">{plan.description}</p>
        )}
      </div>
      <div className="mb-5">
        <span className="font-heading text-3xl font-bold tracking-tight text-foreground">
          {formatPrice(plan.price, plan.currency)}
        </span>
        <span className="ml-1 text-sm text-muted-foreground">
          / {plan.duration}{" "}
          {durationUnitLabel(plan.durationUnit).toLowerCase().replace(/s$/, "")}
          {plan.duration > 1 ? "s" : ""}
        </span>
      </div>
      <ul className="mb-6 flex-1 space-y-2.5">
        {plan.features.slice(0, 6).map((f, i) => (
          <li key={i} className="flex items-start gap-2 text-sm text-foreground">
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
            <span>{f}</span>
          </li>
        ))}
        {plan.features.length > 6 && (
          <li className="text-xs text-muted-foreground">+ {plan.features.length - 6} {t("common.more")}</li>
        )}
      </ul>
      <Button
        onClick={onSelect}
        variant={plan.isPopular ? "default" : "outline"}
        className={`h-10 w-full gap-2 ${
          plan.isPopular
            ? "bg-primary text-primary-foreground hover:bg-primary/90"
            : "border-border bg-card hover:bg-soft-sage"
        }`}
      >
        {t("common.selectPlan")}
        <ArrowRight className="h-4 w-4" />
      </Button>
    </Card>
  );
}
