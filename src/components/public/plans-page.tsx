"use client";

import { useAppStore } from "@/stores/app-store";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/shared/empty-state";
import { useApiFetch } from "@/hooks/use-api";
import { CheckCircle2, ArrowRight, TrendingUp, Clock, Star, ShieldCheck, Sparkles, Users } from "lucide-react";
import { formatPrice, durationUnitLabel, type SubscriptionPlanPublic } from "@/types";
import { useI18n } from "@/lib/i18n/store";

const TRUST_POINTS = [
  { icon: ShieldCheck, labelKey: "public.noHiddenFees" },
  { icon: Clock, labelKey: "public.flexibleDuration" },
];

export function PlansPage() {
  const { t } = useI18n();
  const navigate = useAppStore((s) => s.navigate);
  const { data, loading } = useApiFetch<{ plans: SubscriptionPlanPublic[] }>("/api/public/plans");
  const { data: stats } = useApiFetch<{
    universities: number;
    courses: number;
    lessons: number;
    students: number;
    certificates: number;
  }>("/api/public/stats");
  const plans = data?.plans || [];

  return (
    <div>
      {/* Hero header */}
      <section className="relative overflow-hidden border-b border-border bg-soft-sage/40">
        <div
          className="pointer-events-none absolute inset-0 -z-10 opacity-90"
          style={{
            background:
              "radial-gradient(circle at 80% 20%, rgba(120,151,134,0.18), transparent 55%), radial-gradient(circle at 10% 80%, rgba(52,79,66,0.06), transparent 55%)",
          }}
        />
        <div className="mx-auto max-w-7xl px-4 md:px-6 lg:px-8 py-14 md:py-20">
          <div className="space-y-3 text-center">
            <p className="text-xs font-semibold uppercase tracking-wider text-accent">{t("nav.learningPlans")}</p>
            <h1 className="font-heading text-2xl font-semibold tracking-tight text-foreground md:text-[40px] md:leading-[1.1]">
              {t("public.choosePlanFitsGoals")}
            </h1>
            <p className="mx-auto max-w-2xl text-sm text-muted-foreground md:text-base">
              {t("plans.transparentPricingDesc")}
            </p>
            <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 pt-3 text-xs text-muted-foreground">
              {TRUST_POINTS.map((tp) => (
                <span key={tp.labelKey} className="flex items-center gap-1.5">
                  <tp.icon className="h-3.5 w-3.5 text-accent" /> {t(tp.labelKey as any)}
                </span>
              ))}
              {stats && (
                <span className="flex items-center gap-1.5 tabular-nums">
                  <Users className="h-3.5 w-3.5 text-accent" />
                  {stats.students.toLocaleString()} {t("common.students")} · {stats.courses.toLocaleString()} {t("courses.courses")}
                </span>
              )}
            </div>
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-7xl px-4 md:px-6 lg:px-8 py-16">
        {loading ? (
          <div className="mx-auto grid max-w-5xl gap-5 md:grid-cols-3">
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
              <Card
                key={p.id}
                className={`relative flex h-full flex-col p-6 shadow-sm transition-all duration-200 hover:shadow-md ${
                  p.isPopular
                    ? "border-primary/60 ring-1 ring-primary/25 shadow-md"
                    : "hover:border-accent/40"
                }`}
              >
                {p.isPopular && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <Badge className="bg-primary text-primary-foreground shadow-sm">
                      <Star className="h-3 w-3 fill-current" /> {t("common.popularPlan")}
                    </Badge>
                  </div>
                )}
                <div className="mb-4">
                  <h3 className="font-heading text-lg font-semibold tracking-tight text-foreground">
                    {p.name}
                  </h3>
                  {p.description && (
                    <p className="mt-1 text-sm text-muted-foreground">{p.description}</p>
                  )}
                </div>
                <div className="mb-2">
                  <span className="font-heading text-3xl font-bold tracking-tight text-foreground">
                    {formatPrice(p.price, p.currency)}
                  </span>
                </div>
                <p className="mb-6 flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Clock className="h-3.5 w-3.5" />
                  {t("plans.duration")} {p.duration} {durationUnitLabel(p.durationUnit).toLowerCase()}
                </p>
                <ul className="mb-6 flex-1 space-y-2.5">
                  {p.features.map((f, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-foreground">
                      <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>
                {p.benefits.length > 0 && (
                  <div className="mb-6 rounded-lg bg-soft-sage/60 p-3.5">
                    <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-accent">
                      <Sparkles className="h-3 w-3" /> {t("common.benefits")}
                    </p>
                    <ul className="space-y-1.5">
                      {p.benefits.map((b, i) => (
                        <li key={i} className="flex items-start gap-1.5 text-xs text-foreground">
                          <ArrowRight className="mt-0.5 h-3 w-3 shrink-0 text-accent rtl-mirror" />
                          <span>{b}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                <Button
                  onClick={() => navigate(["register"], { planId: p.id })}
                  variant={p.isPopular ? "default" : "outline"}
                  className={`h-11 sm:h-10 w-full gap-2 ${
                    p.isPopular
                      ? "bg-primary text-primary-foreground hover:bg-primary/90"
                      : "border-border bg-card hover:bg-soft-sage"
                  }`}
                >
                  {t("common.selectPlan")}
                  <ArrowRight className="h-4 w-4 rtl-mirror" />
                </Button>
              </Card>
            ))}
          </div>
        )}

        {/* Info strip */}
        <div className="mx-auto mt-12 max-w-3xl rounded-lg border border-border bg-card p-5 text-center shadow-sm">
          <p className="text-sm text-muted-foreground">
            {t("plans.needHelpChoosing")}{" "}
            <button
              onClick={() => navigate(["about"])}
              className="font-medium text-primary transition-colors hover:text-primary/80"
            >
              {t("plans.learnMoreAbout")}
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}
