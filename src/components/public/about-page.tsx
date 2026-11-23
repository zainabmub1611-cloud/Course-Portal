"use client";

import { useAppStore } from "@/stores/app-store";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useApiFetch } from "@/hooks/use-api";
import {
  Award, Video, FileText, ShieldCheck, Users, Target, ArrowRight, GraduationCap, BookOpen
} from "lucide-react";
import { useI18n } from "@/lib/i18n/store";

export function AboutPage() {
  const { t } = useI18n();
  const navigate = useAppStore((s) => s.navigate);
  const { data: statsData } = useApiFetch<{
    universities: number;
    courses: number;
    lessons: number;
    students: number;
    certificates: number;
  }>("/api/public/stats");

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
        <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 py-14 text-center md:py-20">
          <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-accent">
            {t("about.sinceLabel")}
          </p>
          <h1 className="font-heading text-3xl font-bold tracking-tight text-foreground md:text-[40px] md:leading-[1.12] text-balance">
            {t("public.aboutTitle")}
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-base text-muted-foreground leading-relaxed md:text-lg">
            {t("public.aboutDesc")}
          </p>
        </div>
      </section>

      {/* ─────────── Mission ─────────── */}
      <section className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-16 md:py-20">
        <div className="grid gap-12 lg:grid-cols-2 lg:gap-16 lg:items-center">
          <div className="space-y-5">
            <p className="text-xs font-semibold uppercase tracking-wider text-accent">{t("about.mission")}</p>
            <h2 className="font-heading text-2xl font-semibold tracking-tight text-foreground md:text-[28px]">
              {t("about.missionTitle")}
            </h2>
            <p className="text-sm leading-relaxed text-muted-foreground md:text-base">
              {t("about.missionDesc1")}
            </p>
            <p className="text-sm leading-relaxed text-muted-foreground md:text-base">
              {t("about.missionDesc2")}
            </p>
          </div>
          <div className="grid grid-cols-2 gap-4">
            {[
              { icon: Users, value: (statsData?.students ?? 0).toLocaleString(), label: t("about.activeLearners") },
              { icon: BookOpen, value: (statsData?.courses ?? 0).toLocaleString(), label: t("about.publishedCourses") },
              { icon: Video, value: (statsData?.lessons ?? 0).toLocaleString(), label: t("about.videoLessons") },
              { icon: Award, value: (statsData?.certificates ?? 0).toLocaleString(), label: t("about.certificatesIssuedShort") },
            ].map((s) => (
              <Card key={s.label} className="p-5 text-center shadow-sm transition-all duration-200 hover:shadow-md">
                <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-soft-sage text-accent">
                  <s.icon className="h-5 w-5" />
                </div>
                <p className="font-heading text-2xl font-bold tabular-nums tracking-tight text-foreground">
                  {s.value}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">{s.label}</p>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* ─────────── Approach ─────────── */}
      <section className="border-y border-border bg-muted/40">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-16 md:py-20">
          <div className="mb-12 space-y-2 text-center">
            <p className="text-xs font-semibold uppercase tracking-wider text-accent">{t("about.approach")}</p>
            <h2 className="font-heading text-2xl font-semibold tracking-tight text-foreground md:text-[28px]">
              {t("about.completeJourney")}
            </h2>
          </div>
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {[
              { icon: GraduationCap, title: t("about.registerPlan"), desc: t("about.registerPlanDesc") },
              { icon: Video, title: t("about.watchTrack"), desc: t("about.watchTrackDesc") },
              { icon: FileText, title: t("about.applyAssignments"), desc: t("about.applyAssignmentsDesc") },
              { icon: Award, title: t("about.earnCertificates"), desc: t("about.earnCertificatesDesc") },
            ].map((step, i) => (
              <Card
                key={step.title}
                className="relative p-6 shadow-sm transition-all duration-200 hover:shadow-md"
              >
                <span className="absolute -top-3 start-6 inline-flex h-6 w-6 items-center justify-center rounded-full bg-primary text-xs font-bold tabular-nums text-primary-foreground shadow-sm">
                  {i + 1}
                </span>
                <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-soft-sage text-accent">
                  <step.icon className="h-5 w-5" />
                </div>
                <h3 className="font-heading text-sm font-semibold tracking-tight text-foreground">
                  {step.title}
                </h3>
                <p className="mt-1.5 text-sm text-muted-foreground">{step.desc}</p>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* ─────────── Values ─────────── */}
      <section className="mx-auto max-w-7xl px-4 md:px-6 lg:px-8 py-20">
        <div className="mb-12 space-y-2 text-center">
          <p className="text-xs font-semibold uppercase tracking-wider text-accent">{t("about.whatWeStandFor")}</p>
          <h2 className="font-heading text-2xl font-semibold tracking-tight text-foreground md:text-[28px]">
            {t("about.principlesBehind")}
          </h2>
        </div>
        <div className="grid gap-5 md:grid-cols-3">
          {[
            { icon: Target, title: t("about.outcomeFocused"), desc: t("about.outcomeFocusedDesc") },
            { icon: ShieldCheck, title: t("about.accountability"), desc: t("about.accountabilityDesc") },
            { icon: Sparkles, title: t("about.qualityFirst"), desc: t("about.qualityFirstDesc") },
          ].map((v) => (
            <Card
              key={v.title}
              className="p-6 shadow-sm transition-all duration-200 hover:shadow-md hover:border-accent/40"
            >
              <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-soft-sage text-accent">
                <v.icon className="h-5 w-5" />
              </div>
              <h3 className="font-heading text-sm font-semibold tracking-tight text-foreground">
                {v.title}
              </h3>
              <p className="mt-1.5 text-sm text-muted-foreground">{v.desc}</p>
            </Card>
          ))}
        </div>
      </section>

      {/* ─────────── CTA ─────────── */}
      <section className="bg-primary text-primary-foreground">
        <div className="mx-auto max-w-7xl px-4 md:px-6 lg:px-8 py-16 text-center md:py-20">
          <h2 className="font-heading text-2xl font-semibold tracking-tight md:text-[32px]">
            {t("about.startLearningToday")}
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-sm text-primary-foreground/80 md:text-base">
            {t("about.joinThousands")}
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
