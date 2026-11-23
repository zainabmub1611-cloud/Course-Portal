"use client";

import { useState } from "react";
import { useAppStore } from "@/stores/app-store";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { BrandLogo } from "@/components/shared/brand-logo";
import { EmptyState } from "@/components/shared/empty-state";
import { useApiFetch, apiPost } from "@/hooks/use-api";
import { toast } from "@/hooks/use-toast";
import { formatDate, formatPrice, durationUnitLabel, type SubscriptionPlanPublic } from "@/types";
import {
  AlertTriangle, CheckCircle2, ArrowRight, Lock, ShieldCheck, LogOut, Sparkles,
  CalendarDays,
} from "lucide-react";
import { useI18n } from "@/lib/i18n/store";

export function ExpiredScreen() {
  const { t } = useI18n();
  const navigate = useAppStore((s) => s.navigate);
  const refreshUser = useAppStore((s) => s.refreshUser);
  const [subscribingPlanId, setSubscribingPlanId] = useState<string | null>(null);

  const { data: subData, loading: subLoading } = useApiFetch<{
    subscription: {
      planName: string;
      planPrice: number;
      planCurrency: string;
      expiryDate: string;
      status: "ACTIVE" | "EXPIRED";
    } | null;
  }>("/api/student/subscription");

  const { data: plansData, loading: plansLoading } = useApiFetch<{
    plans: SubscriptionPlanPublic[];
  }>("/api/public/plans");

  const plans = plansData?.plans || [];
  const sub = subData?.subscription;

  async function logout() {
    await apiPost("/api/auth/logout", null, { method: "POST" });
    await refreshUser();
    navigate([""]);
  }

  async function choosePlan(planId: string) {
    setSubscribingPlanId(planId);
    try {
      await apiPost("/api/student/subscription/renew", { planId });
      toast({
        title: t("subscription.activated"),
        description: t("expired.welcomeBackRestoredDesc"),
      });
      // Force a hard re-fetch of subscription state in the parent shell by
      // toggling route — the dashboard refetches on segment change.
      navigate(["student", "overview"]);
      // Also refresh the user object to keep UI in sync
      await refreshUser();
    } catch {
      // apiPost already shows error toast
    } finally {
      setSubscribingPlanId(null);
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-background via-background to-muted/40 flex flex-col">
      <header className="border-b border-border bg-card/80 backdrop-blur-xl sticky top-0 z-10">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
          <BrandLogo onClick={() => navigate([""])} />
          <Button variant="ghost" size="sm" onClick={logout} className="gap-2 text-destructive hover:text-destructive hover:bg-destructive/5">
            <LogOut className="h-4 w-4" /> {t("common.logout")}
          </Button>
        </div>
      </header>

      <main className="flex-1 mx-auto w-full max-w-6xl px-4 py-10 md:py-16">
        {/* Premium header */}
        <div className="text-center mb-10 animate-fade-in-up">
          <div className="inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-warning/15 text-warning mb-5 ring-4 ring-warning/10">
            <AlertTriangle className="h-8 w-8" />
          </div>
          <Badge className="bg-destructive/10 text-destructive border-transparent mb-3">
            {t("subscription.subscriptionExpired")}
          </Badge>
          <h1 className="font-heading text-3xl md:text-4xl font-bold text-foreground">
            {t("expired.letsGetBack")}
          </h1>
          <p className="mt-3 text-muted-foreground max-w-xl mx-auto">
            {t("expired.planExpiredDesc")}
          </p>
        </div>

        {/* Previous subscription card */}
        {subLoading ? (
          <Card className="mb-10 shadow-sm"><CardContent className="p-6"><Skeleton className="h-20 w-full" /></CardContent></Card>
        ) : sub ? (
          <Card className="mb-10 border-warning/30 shadow-sm overflow-hidden">
            <div className="h-1 w-full bg-gradient-to-r from-warning to-warning/30" />
            <CardContent className="p-6">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="flex items-start gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-muted text-muted-foreground shrink-0 ring-1 ring-border">
                    <CalendarDays className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      {t("subscription.previousPlan")}
                    </p>
                    <p className="font-heading text-xl font-semibold text-foreground mt-1">
                      {sub.planName}
                    </p>
                    <p className="text-sm text-muted-foreground mt-1">
                      {t("expired.expiredOn")} {formatDate(sub.expiryDate)} · {formatPrice(sub.planPrice, sub.planCurrency)}
                    </p>
                  </div>
                </div>
                <Badge className="bg-destructive/10 text-destructive border-transparent">
                  {t("common.expired")}
                </Badge>
              </div>
              <div className="mt-4 flex items-start gap-2.5 rounded-lg border border-accent/20 bg-soft-sage/40 p-3.5 text-xs text-muted-foreground">
                <ShieldCheck className="h-4 w-4 text-accent shrink-0 mt-0.5" />
                <span>
                  {t("expired.preservedDesc")}
                </span>
              </div>
            </CardContent>
          </Card>
        ) : null}

        {/* Plans */}
        <div className="mb-6">
          <h2 className="font-heading text-xl font-semibold text-foreground mb-1">
            {t("expired.chooseNewPlanShort")}
          </h2>
          <p className="text-sm text-muted-foreground">
            {t("expired.allPlansRestore")}
          </p>
        </div>

        {plansLoading ? (
          <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3].map((i) => (
              <Card key={i} className="p-6">
                <Skeleton className="h-6 w-1/3 mb-4" />
                <Skeleton className="h-10 w-2/3 mb-2" />
                <Skeleton className="h-4 w-1/2 mb-6" />
                <div className="space-y-3">
                  {[1, 2, 3, 4].map((j) => (
                    <Skeleton key={j} className="h-4 w-full" />
                  ))}
                </div>
                <Skeleton className="h-10 w-full mt-6" />
              </Card>
            ))}
          </div>
        ) : plans.length === 0 ? (
          <EmptyState
            icon={<Sparkles className="h-5 w-5" />}
            title={t("subscription.noPlansAvailableShort")}
            description={t("subscription.checkBackSoon")}
          />
        ) : (
          <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
            {plans.map((p) => (
              <Card
                key={p.id}
                className={`relative p-6 flex flex-col shadow-sm transition-all duration-200 hover:shadow-md hover:-translate-y-1 ${
                  p.isPopular ? "border-accent ring-2 ring-accent/30 shadow-md" : ""
                }`}
              >
                {p.isPopular && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <Badge className="bg-accent text-accent-foreground shadow-sm">{t("expired.mostPopularShort")}</Badge>
                  </div>
                )}
                <div className="mb-4">
                  <h3 className="font-heading text-xl font-bold text-foreground">{p.name}</h3>
                  {p.description && (
                    <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{p.description}</p>
                  )}
                </div>
                <div className="mb-4">
                  <span className="font-heading text-3xl font-bold text-foreground">
                    {formatPrice(p.price, p.currency)}
                  </span>
                  <span className="text-sm text-muted-foreground ml-1">
                    / {p.duration} {durationUnitLabel(p.durationUnit).toLowerCase().replace(/s$/, "")}
                    {p.duration > 1 ? "s" : ""}
                  </span>
                </div>
                <ul className="mb-6 space-y-2.5 flex-1">
                  {p.features.slice(0, 6).map((f, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-foreground">
                      <CheckCircle2 className="h-4 w-4 text-accent mt-0.5 shrink-0" />
                      <span>{f}</span>
                    </li>
                  ))}
                  {p.features.length > 6 && (
                    <li className="text-xs text-muted-foreground">{t("expired.more").replace("{count}", String(p.features.length - 6))}</li>
                  )}
                </ul>
                <Button
                  onClick={() => choosePlan(p.id)}
                  disabled={subscribingPlanId !== null}
                  variant={p.isPopular ? "default" : "outline"}
                  className="w-full gap-2 shadow-sm"
                >
                  {subscribingPlanId === p.id ? t("expired.activating") : t("expired.subscribe")}
                  {subscribingPlanId !== p.id && <ArrowRight className="h-4 w-4" />}
                </Button>
              </Card>
            ))}
          </div>
        )}

        <div className="mt-10 flex flex-col items-center gap-3 text-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1 text-xs text-muted-foreground shadow-sm">
            <Lock className="h-3.5 w-3.5 text-accent" />
            <span>{t("expired.secureSubscription")}</span>
          </div>
          <Button variant="link" onClick={logout} className="text-muted-foreground">
            {t("expired.signOutInstead")}
          </Button>
        </div>
      </main>

      <footer className="border-t border-border bg-card/60">
        <div className="mx-auto max-w-6xl px-4 py-6 text-center text-xs text-muted-foreground">
          {t("expired.platformFooter")}
        </div>
      </footer>
    </div>
  );
}
