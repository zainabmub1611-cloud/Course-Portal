"use client";

import { useState } from "react";
import { useAppStore } from "@/stores/app-store";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { EmptyState } from "@/components/shared/empty-state";
import { useApiFetch, apiPost } from "@/hooks/use-api";
import { toast } from "@/hooks/use-toast";
import {
  formatPrice, durationUnitLabel, formatDate, type SubscriptionPlanPublic,
} from "@/types";
import {
  CheckCircle2, CreditCard, Clock, ShieldCheck, AlertTriangle, Sparkles,
  ArrowRight, History, CalendarDays,
} from "lucide-react";
import { useI18n } from "@/lib/i18n/store";

interface SubscriptionInfo {
  subscriptionId: string;
  planId: string;
  planName: string;
  planPrice: number;
  planCurrency: string;
  planDuration: number;
  planDurationUnit: string;
  startDate: string;
  expiryDate: string;
  status: "ACTIVE" | "EXPIRED";
  remainingDays: number;
  elapsedPercent: number;
}

export function StudentSubscription() {
  const { t } = useI18n();
  const navigate = useAppStore((s) => s.navigate);
  const refreshUser = useAppStore((s) => s.refreshUser);
  const [renewOpen, setRenewOpen] = useState(false);
  const [subscribingPlanId, setSubscribingPlanId] = useState<string | null>(null);

  const { data, loading, error, refetch } = useApiFetch<{
    subscription: SubscriptionInfo | null;
  }>("/api/student/subscription");

  const { data: plansData, loading: plansLoading } = useApiFetch<{
    plans: SubscriptionPlanPublic[];
  }>("/api/public/plans");

  const plans = plansData?.plans || [];
  const sub = data?.subscription;
  const isExpired = sub?.status === "EXPIRED";

  async function subscribeToPlan(planId: string) {
    setSubscribingPlanId(planId);
    try {
      await apiPost("/api/student/subscription/renew", { planId });
      toast({
        title: t("subscription.activated"),
        description: t("subscription.activatedDesc"),
      });
      setRenewOpen(false);
      await refetch();
      await refreshUser();
    } catch {
    } finally {
      setSubscribingPlanId(null);
    }
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-72 rounded-xl" />
        <Skeleton className="h-48 rounded-xl" />
      </div>
    );
  }

  if (error) {
    return (
      <EmptyState
        icon={<CreditCard className="h-5 w-5" />}
        title={t("subscription.couldntLoad")}
        description={error}
        action={<Button onClick={() => window.location.reload()}>{t("common.reload")}</Button>}
      />
    );
  }

  return (
    <div className="space-y-6">
      {/* Current subscription card */}
      {sub ? (
        <Card className={`overflow-hidden shadow-sm transition-all duration-200 hover:shadow-md ${isExpired ? "border-destructive/30" : "border-accent/30"}`}>
          {/* Accent top border */}
          <div className={`h-1 w-full ${isExpired ? "bg-destructive" : "bg-gradient-to-r from-accent to-primary"}`} />
          <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0">
            <div>
              <CardTitle className="text-base flex items-center gap-2">
                <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-accent/10 text-accent">
                  <CreditCard className="h-4 w-4" />
                </span>
                {t("subscription.currentPlan")}
              </CardTitle>
              <CardDescription className="mt-1.5">
                {sub.planName} · {formatPrice(sub.planPrice, sub.planCurrency)}
              </CardDescription>
            </div>
            <Badge
              className={
                isExpired
                  ? "bg-destructive/10 text-destructive border-transparent"
                  : "bg-success/15 text-success border-transparent"
              }
            >
              {isExpired ? t("common.expired") : t("common.active")}
            </Badge>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <MetaBox label={t("subscription.planDuration")} value={`${sub.planDuration} ${durationUnitLabel(sub.planDurationUnit).toLowerCase()}`} icon={<Clock className="h-3.5 w-3.5" />} />
              <MetaBox label={t("subscription.started")} value={formatDate(sub.startDate)} icon={<CalendarDays className="h-3.5 w-3.5" />} />
              <MetaBox label={t("subscription.expires")} value={formatDate(sub.expiryDate)} icon={<CalendarDays className="h-3.5 w-3.5" />} />
              <MetaBox label={t("subscription.daysLeftShort")} value={`${sub.remainingDays}`} icon={<Clock className="h-3.5 w-3.5" />} highlight={!isExpired} />
            </div>

            <div>
              <div className="flex justify-between text-xs text-muted-foreground mb-1.5">
                <span>{t("subscription.subscriptionProgress")}</span>
                <span className="font-medium text-foreground">{Math.round(sub.elapsedPercent)}% {t("subscription.elapsed")}</span>
              </div>
              <Progress
                value={sub.elapsedPercent}
                className={`h-2 bg-muted ${isExpired ? "[&_[data-slot=progress-indicator]]:bg-destructive" : "[&_[data-slot=progress-indicator]]:bg-accent"}`}
              />
              <div className="flex justify-between text-xs text-muted-foreground mt-1.5">
                <span>{formatDate(sub.startDate)}</span>
                <span>{formatDate(sub.expiryDate)}</span>
              </div>
            </div>

            {isExpired ? (
              <div className="flex items-start gap-3 rounded-lg border border-destructive/30 bg-destructive/5 p-4">
                <AlertTriangle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="font-semibold text-foreground">{t("subscription.yourSubscriptionExpired")}</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    {t("subscription.renewNowDesc")}
                  </p>
                </div>
                <Button onClick={() => setRenewOpen(true)} className="shrink-0 gap-2 shadow-sm">
                  <ArrowRight className="h-4 w-4" /> {t("subscription.renewNow")}
                </Button>
              </div>
            ) : (
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-gradient-to-br from-soft-sage/60 to-card p-4">
                <div className="flex items-start gap-3">
                  <Clock className="h-5 w-5 text-accent shrink-0 mt-0.5" />
                  <div>
                    <p className="font-medium text-foreground">{t("subscription.wantToExtend")}</p>
                    <p className="text-sm text-muted-foreground mt-0.5">
                      {t("subscription.renewEarlyDesc")}
                    </p>
                  </div>
                </div>
                <Button variant="outline" onClick={() => setRenewOpen(true)} className="shrink-0 gap-2 shadow-sm">
                  <Sparkles className="h-4 w-4" /> {t("subscription.renewEarly")}
                </Button>
              </div>
            )}

            <div className="flex items-start gap-3 rounded-lg border border-border bg-card p-3.5 text-sm text-muted-foreground">
              <History className="h-4 w-4 text-accent shrink-0 mt-0.5" />
              <span>
                {t("subscription.historyPreserved")}
              </span>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-6">
            <EmptyState
              icon={<CreditCard className="h-5 w-5" />}
              title={t("subscription.noActiveSubscription")}
              description={t("subscription.choosePlanDesc")}
              action={<Button onClick={() => navigate(["student", "subscription"])} className="gap-2 shadow-sm">
                {t("subscription.viewPlans")} <ArrowRight className="h-4 w-4" />
              </Button>}
            />
          </CardContent>
        </Card>
      )}

      {/* Plans section — shown if expired or no subscription */}
      {(!sub || isExpired) && (
        <div>
          <div className="mb-4">
            <h2 className="font-heading text-xl font-semibold text-foreground">
              {isExpired ? t("subscription.chooseNewPlanShort") : t("subscription.availablePlans")}
            </h2>
            <p className="text-sm text-muted-foreground mt-1">
              {t("subscription.allPlansGrantAccess")}
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
                <PlanCard
                  key={p.id}
                  plan={p}
                  subscribing={subscribingPlanId}
                  onSubscribe={() => subscribeToPlan(p.id)}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Renew dialog (when active, lets student renew early) */}
      <Dialog open={renewOpen && !isExpired && !!sub} onOpenChange={(o) => !isExpired && setRenewOpen(o)}>
        <DialogContent className="animate-scale-in w-[95vw] max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t("subscription.renewYourSubscription")}</DialogTitle>
            <DialogDescription>
              {t("subscription.pickPlanExtend")}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 md:grid-cols-2 max-h-[60vh] overflow-y-auto scrollbar-thin pr-1">
            {plans.map((p) => (
              <PlanCard
                key={p.id}
                plan={p}
                compact
                subscribing={subscribingPlanId}
                onSubscribe={() => subscribeToPlan(p.id)}
              />
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRenewOpen(false)}>{t("common.cancel")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function MetaBox({ label, value, icon, highlight }: { label: string; value: string; icon?: React.ReactNode; highlight?: boolean }) {
  return (
    <div className={`rounded-lg border p-3.5 ${highlight ? "border-accent/30 bg-soft-sage/60" : "border-border bg-card"}`}>
      <p className="text-xs text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
        {icon && <span className="text-accent">{icon}</span>}
        {label}
      </p>
      <p className={`font-heading font-semibold mt-1 ${highlight ? "text-accent" : "text-foreground"}`}>{value}</p>
    </div>
  );
}

function PlanCard({
  plan, onSubscribe, subscribing, compact,
}: {
  plan: SubscriptionPlanPublic;
  onSubscribe: () => void;
  subscribing: string | null;
  compact?: boolean;
}) {
  const { t } = useI18n();
  const busy = subscribing !== null;
  const isCurrent = subscribing === plan.id;
  return (
    <Card
      className={`relative p-6 flex flex-col shadow-sm transition-all duration-200 hover:shadow-md ${
        plan.isPopular ? "border-accent ring-2 ring-accent/30 shadow-md" : ""
      }`}
    >
      {plan.isPopular && (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2">
          <Badge className="bg-accent text-accent-foreground shadow-sm">{t("subscription.mostPopularShort")}</Badge>
        </div>
      )}
      <div className="mb-4">
        <h3 className="font-heading text-xl font-bold text-foreground">{plan.name}</h3>
        {plan.description && (
          <p className={`text-sm text-muted-foreground mt-1 ${compact ? "line-clamp-2" : "line-clamp-3"}`}>
            {plan.description}
          </p>
        )}
      </div>
      <div className="mb-4">
        <span className="font-heading text-3xl font-bold text-foreground">
          {formatPrice(plan.price, plan.currency)}
        </span>
        <span className="text-sm text-muted-foreground ml-1">
          {" "}/ {plan.duration} {durationUnitLabel(plan.durationUnit).toLowerCase().replace(/s$/, "")}
          {plan.duration > 1 ? "s" : ""}
        </span>
      </div>
      <ul className="mb-6 space-y-2.5 flex-1">
        {plan.features.slice(0, compact ? 4 : 6).map((f, i) => (
          <li key={i} className="flex items-start gap-2 text-sm text-foreground">
            <CheckCircle2 className="h-4 w-4 text-accent mt-0.5 shrink-0" />
            <span>{f}</span>
          </li>
        ))}
        {!compact && plan.features.length > 6 && (
          <li className="text-xs text-muted-foreground">{t("subscription.more").replace("{count}", String(plan.features.length - 6))}</li>
        )}
      </ul>
      <Button
        onClick={onSubscribe}
        disabled={busy}
        variant={plan.isPopular ? "default" : "outline"}
        className="w-full gap-2 shadow-sm"
      >
        {isCurrent ? t("subscription.activating") : t("subscription.subscribe")}
        {!isCurrent && <ArrowRight className="h-4 w-4" />}
      </Button>
    </Card>
  );
}
