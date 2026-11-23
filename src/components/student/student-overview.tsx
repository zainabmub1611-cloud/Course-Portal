"use client";

import { useAppStore } from "@/stores/app-store";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/shared/empty-state";
import { CourseThumbnail } from "@/components/shared/course-thumbnail";
import { useApiFetch } from "@/hooks/use-api";
import {
  BookOpen, PlayCircle, ClipboardList, Award, TrendingUp, ArrowRight,
  CalendarDays, CheckCircle2, Lock, Clock, Sparkles, GraduationCap, CreditCard,
  History, Video, FileText, XCircle, AlertTriangle, ArrowUpRight, Building2, UserCheck,
} from "lucide-react";
import { formatDate, formatDateTime, formatPrice } from "@/types";
import { useI18n } from "@/lib/i18n/store";

interface SubscriptionInfo {
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

interface OverviewData {
  welcomeName: string;
  subscription: SubscriptionInfo | null;
  learning: {
    availableCourses: number;
    inProgressCourses: number;
    completedCourses: number;
    overallPercent: number;
  };
  continueLearning: {
    courseId: string;
    courseTitle: string;
    thumbnail: string | null;
    lastVideoId: string;
    lastVideoTitle: string;
    percent: number;
  }[];
  upcomingAssignments: {
    id: string;
    courseId: string;
    courseTitle: string;
    assignmentTitle: string;
    dueDate: string | null;
    unlocked: boolean;
    submitted: boolean;
    coursePercent: number;
  }[];
  recentCertificates: {
    id: string;
    courseId?: string;
    courseTitle: string;
    issuedAt: string;
    certificateNumber: string;
    appName?: string;
    organizationName?: string;
    universityName?: string | null;
    instructorName?: string | null;
    instructorSignatureUrl?: string | null;
  }[];
  upcomingActivities?: UpcomingActivity[];
}

interface UpcomingActivity {
  id: string;
  type: "assignment" | "assessment";
  courseId: string;
  courseTitle: string;
  title: string;
  dueDate: string | null;
  status: "available" | "locked" | "pending" | "submitted";
  priority: "normal" | "overdue";
}

interface ActivityItem {
  id: string;
  type: "video_completed" | "assessment" | "submission" | "certificate";
  courseId: string;
  courseTitle: string;
  title: string;
  detail: string;
  timestamp: string;
  score?: number;
  passed?: boolean;
  certificateNumber?: string;
}

export function StudentOverview() {
  const { t } = useI18n();
  const navigate = useAppStore((s) => s.navigate);
  const { data, loading, error } = useApiFetch<OverviewData>("/api/student/overview", {
    freshOnMount: true,
    revalidateOnFocus: true,
  });
  const { data: activityData, loading: activityLoading } = useApiFetch<{ activities: ActivityItem[] }>(
    "/api/student/recent-activity"
  );

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-36 w-full rounded-xl" />
        <div className="grid gap-3 sm:gap-4 sm:grid-cols-2 lg:grid-cols-4 stagger-children">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-28 rounded-xl" />
          ))}
        </div>
        <Skeleton className="h-72 w-full rounded-xl" />
        <div className="grid gap-4 lg:grid-cols-2">
          <Skeleton className="h-64 rounded-xl" />
          <Skeleton className="h-64 rounded-xl" />
        </div>
        <Skeleton className="h-72 w-full rounded-xl" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <EmptyState
        icon={<GraduationCap className="h-5 w-5" />}
        title={t("student.couldntLoadOverview")}
        description={error || t("student.pleaseTryAgain")}
        action={<Button onClick={() => window.location.reload()}>{t("common.reload")}</Button>}
      />
    );
  }

  const today = new Date().toLocaleDateString("en-GB", {
    weekday: "long", day: "2-digit", month: "long", year: "numeric",
  });

  return (
    <div className="space-y-6">
      {/* ─── Premium welcome header ─── */}
      <Card className="hero-gradient relative overflow-hidden border-border shadow-sm">
        {/* Deep forest gradient backdrop */}
        <div className="absolute inset-0 bg-gradient-to-br from-primary via-primary to-accent/80" />
        {/* Decorative sage glow */}
        <div
          className="pointer-events-none absolute -right-20 -top-20 h-72 w-72 rounded-full opacity-60"
          style={{ background: "radial-gradient(circle, rgba(120,151,134,0.45), transparent 70%)" }}
        />
        <div
          className="pointer-events-none absolute -right-10 bottom-0 h-40 w-40 rounded-full opacity-40"
          style={{ background: "radial-gradient(circle, rgba(232,239,234,0.3), transparent 70%)" }}
        />
        <CardContent className="relative p-6 md:p-8 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="text-primary-foreground">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs font-medium text-white/90 backdrop-blur-sm mb-3">
              <CalendarDays className="h-3.5 w-3.5" />
              <span>{today}</span>
            </div>
            <h1 className="font-heading text-2xl md:text-3xl font-bold text-white">
              {t("dashboard.welcome")}, {data.welcomeName}
            </h1>
            <p className="text-white/80 mt-2 max-w-xl text-sm md:text-base">
              {data.learning.inProgressCourses > 0
                ? `${data.learning.inProgressCourses} ${t("dashboard.inProgressCourses")}.`
                : data.learning.availableCourses > 0
                  ? t("student.startCourseToSeeList")
                  : t("student.subscribeToAccess")}
            </p>
          </div>
          <Button
            size="lg"
            onClick={() => navigate(["student", "courses"])}
            className="gap-2 self-start md:self-center bg-white text-primary hover:bg-white/90 shadow-md"
          >
            <BookOpen className="h-4 w-4" /> {t("student.browseCoursesShort")}
          </Button>
        </CardContent>
      </Card>

      {/* ─── Subscription status ─── */}
      {data.subscription ? (
        <Card className="shadow-premium overflow-hidden border-border transition-all duration-200 hover:shadow-md">
          <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0">
            <div>
              <CardTitle className="text-base flex items-center gap-2">
                <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-accent/10 text-accent">
                  <CreditCard className="h-4 w-4" />
                </span>
                {t("student.subscriptionStatus")}
              </CardTitle>
              <CardDescription className="mt-1.5">
                {data.subscription.planName} · {formatPrice(data.subscription.planPrice, data.subscription.planCurrency)}
              </CardDescription>
            </div>
            <Badge
              className={
                data.subscription.status === "ACTIVE"
                  ? "bg-success/15 text-success border-transparent"
                  : "bg-destructive/10 text-destructive border-transparent"
              }
            >
              {data.subscription.status === "ACTIVE" ? t("common.active") : t("common.expired")}
            </Badge>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
              <span className="flex items-center gap-1.5 text-muted-foreground">
                <Clock className="h-3.5 w-3.5 text-accent" />
                {t("student.started")} {formatDate(data.subscription.startDate)}
              </span>
              <span className="flex items-center gap-1.5 text-muted-foreground">
                <CalendarDays className="h-3.5 w-3.5 text-accent" />
                {t("student.expires")} {formatDate(data.subscription.expiryDate)}
              </span>
              <span className="flex items-center gap-1.5 font-semibold text-foreground">
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-accent/10 text-accent text-[10px]">⏱</span>
                {data.subscription.remainingDays} {t("subscription.daysLeft")}
              </span>
            </div>
            <div>
              <div className="flex justify-between text-xs text-muted-foreground mb-1.5">
                <span>{t("student.planUsage")}</span>
                <span className="font-medium text-foreground">{Math.round(data.subscription.elapsedPercent)}%</span>
              </div>
              <Progress
                value={data.subscription.elapsedPercent}
                className="h-2 bg-muted [&_[data-slot=progress-indicator]]:bg-accent"
              />
            </div>
            <Button variant="outline" size="sm" onClick={() => navigate(["student", "subscription"])} className="mt-1">
              {t("student.manageSubscription")}
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Card className="border-accent/30 bg-gradient-to-br from-soft-sage to-card shadow-sm">
          <CardContent className="p-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-accent/10 text-accent shrink-0 ring-1 ring-accent/20">
                <Sparkles className="h-5 w-5" />
              </div>
              <div>
                <p className="font-heading font-semibold text-foreground">{t("student.unlockPremiumCourses")}</p>
                <p className="text-sm text-muted-foreground mt-0.5">
                  {t("student.subscribeToAccess")}
                </p>
              </div>
            </div>
            <Button onClick={() => navigate(["student", "subscription"])} className="gap-2 shadow-sm">
              {t("student.viewPlans")} <ArrowRight className="h-4 w-4" />
            </Button>
          </CardContent>
        </Card>
      )}

      {/* ─── Summary stat cards ─── */}
      <div className="grid gap-3 sm:gap-4 sm:grid-cols-2 lg:grid-cols-4 stagger-children">
        <StatCard
          icon={<BookOpen className="h-5 w-5" />}
          label={t("student.availableCourses")}
          value={data.learning.availableCourses}
          tint="accent"
        />
        <StatCard
          icon={<PlayCircle className="h-5 w-5" />}
          label={t("dashboard.inProgressCourses")}
          value={data.learning.inProgressCourses}
          tint="primary"
        />
        <StatCard
          icon={<CheckCircle2 className="h-5 w-5" />}
          label={t("dashboard.completedCourses")}
          value={data.learning.completedCourses}
          tint="success"
        />
        <StatCard
          icon={<TrendingUp className="h-5 w-5" />}
          label={t("student.overallProgress")}
          value={`${data.learning.overallPercent}%`}
          tint="warning"
        />
      </div>

      {/* ─── Continue Learning ─── */}
      <Card className="shadow-sm transition-all duration-200 hover:shadow-md">
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <div>
            <CardTitle className="text-base flex items-center gap-2">
              <PlayCircle className="h-4 w-4 text-accent" />
              {t("dashboard.continueLearning")}
            </CardTitle>
            <CardDescription className="mt-1">{t("student.pickUpWhereLeftOff")}</CardDescription>
          </div>
          {data.continueLearning.length > 0 && (
            <Button variant="ghost" size="sm" onClick={() => navigate(["student", "courses"])} className="gap-1 text-accent hover:bg-accent/10 hover:text-accent">
              {t("common.viewAll")} <ArrowRight className="h-4 w-4" />
            </Button>
          )}
        </CardHeader>
        <CardContent>
          {data.continueLearning.length === 0 ? (
            <EmptyState
              icon={<PlayCircle className="h-5 w-5" />}
              title={t("student.noLessonsWatchedYet")}
              description={t("student.startCourseToSeeList")}
              action={<Button size="sm" onClick={() => navigate(["student", "courses"])} className="gap-2">
                {t("common.exploreCourses")} <ArrowRight className="h-4 w-4" />
              </Button>}
            />
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {data.continueLearning.map((c) => (
                <button
                  key={c.courseId}
                  onClick={() => navigate(["student", "learn", c.courseId])}
                  className="group card-glow hover-lift relative text-left rounded-xl border border-border bg-card p-4 hover:shadow-md hover:border-accent/40 transition-all duration-200"
                >
                  <div className="flex gap-3">
                    <div className="relative h-14 w-20 shrink-0 overflow-hidden rounded-lg bg-muted ring-1 ring-border">
                      <CourseThumbnail
                        thumbnail={c.thumbnail}
                        firstVideoUrl={(c as any).firstVideoUrl}
                        firstVideoSource={(c as any).firstVideoSource}
                        alt={c.courseTitle}
                        className="h-full w-full"
                        showPlayOverlay
                      />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-foreground line-clamp-1 group-hover:text-accent transition-colors">
                        {c.courseTitle}
                      </p>
                      <p className="text-xs text-muted-foreground line-clamp-1 mt-0.5">
                        {t("student.upNext")} {c.lastVideoTitle}
                      </p>
                    </div>
                  </div>
                  <div className="mt-3">
                    <div className="flex justify-between text-xs text-muted-foreground mb-1.5">
                      <span>{t("student.progress")}</span>
                      <span className="font-medium text-foreground">{c.percent}%</span>
                    </div>
                    <Progress
                      value={c.percent}
                      className={`h-1.5 bg-muted ${c.percent === 100 ? "[&_[data-slot=progress-indicator]]:bg-success" : "[&_[data-slot=progress-indicator]]:bg-accent"}`}
                    />
                  </div>
                </button>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* ─── Upcoming Assignments + Recent Certificates ─── */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="shadow-sm transition-all duration-200 hover:shadow-md">
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <div>
              <CardTitle className="text-base flex items-center gap-2">
                <ClipboardList className="h-4 w-4 text-accent" />
                {t("student.upcomingAssignments")}
              </CardTitle>
              <CardDescription className="mt-1">{t("student.submitAfterCompletion")}</CardDescription>
            </div>
            <Button variant="ghost" size="sm" onClick={() => navigate(["student", "assignments"])} className="gap-1 text-accent hover:bg-accent/10 hover:text-accent">
              {t("common.viewAll")} <ArrowRight className="h-4 w-4" />
            </Button>
          </CardHeader>
          <CardContent>
            {data.upcomingAssignments.length === 0 ? (
              <EmptyState
                icon={<ClipboardList className="h-5 w-5" />}
                title={t("student.noAssignmentsAvailable")}
                description={t("student.assignmentsAppearHere")}
              />
            ) : (
              <ul className="space-y-2">
                {data.upcomingAssignments.slice(0, 5).map((a) => (
                  <li
                    key={a.id}
                    className="group flex items-start justify-between gap-3 rounded-lg border border-border bg-card p-3 hover:border-accent/30 hover:bg-soft-sage/30 transition-all duration-200"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-foreground line-clamp-1">{a.assignmentTitle}</p>
                      <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{a.courseTitle}</p>
                      <div className="mt-1.5 flex items-center gap-3 text-xs text-muted-foreground">
                        {a.dueDate && (
                          <span className="flex items-center gap-1">
                            <Clock className="h-3 w-3 text-accent" /> {t("student.due")} {formatDate(a.dueDate)}
                          </span>
                        )}
                        <span>{a.coursePercent}% {t("student.courseProgress")}</span>
                      </div>
                    </div>
                    <Badge
                      className={
                        a.submitted
                          ? "bg-success/15 text-success border-transparent"
                          : a.unlocked
                            ? "bg-accent/10 text-accent border-transparent"
                            : "bg-muted text-muted-foreground border-transparent"
                      }
                    >
                      {a.submitted ? t("student.submitted") : a.unlocked ? t("student.available") : (
                        <span className="flex items-center gap-1"><Lock className="h-3 w-3" /> {t("common.locked")}</span>
                      )}
                    </Badge>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card className="shadow-sm transition-all duration-200 hover:shadow-md">
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <div>
              <CardTitle className="text-base flex items-center gap-2">
                <Award className="h-4 w-4 text-accent" />
                {t("dashboard.recentCertificates")}
              </CardTitle>
              <CardDescription className="mt-1">{t("student.yourAchievements")}</CardDescription>
            </div>
            <Button variant="ghost" size="sm" onClick={() => navigate(["student", "certificates"])} className="gap-1 text-accent hover:bg-accent/10 hover:text-accent">
              {t("common.viewAll")} <ArrowRight className="h-4 w-4" />
            </Button>
          </CardHeader>
          <CardContent>
            {data.recentCertificates.length === 0 ? (
              <EmptyState
                icon={<Award className="h-5 w-5" />}
                title={t("certificates.noCertificates")}
                description={t("certificates.earnFirst")}
              />
            ) : (
              <ul className="space-y-2">
                {data.recentCertificates.map((c) => (
                  <li
                    key={c.id}
                    className="group flex items-start justify-between gap-3 rounded-lg border border-border bg-card p-3 hover:border-accent/30 hover:bg-soft-sage/30 transition-all duration-200"
                  >
                    <div className="flex items-start gap-3 min-w-0 flex-1">
                      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br from-accent/15 to-accent/5 text-accent shrink-0 ring-1 ring-accent/20">
                        <Award className="h-5 w-5" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold text-foreground line-clamp-1">{c.courseTitle}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {t("certificates.issuedOn")} {formatDate(c.issuedAt)} · {c.certificateNumber}
                        </p>
                        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px] text-muted-foreground">
                          {c.universityName && (
                            <span className="flex items-center gap-1">
                              <Building2 className="h-3 w-3 text-accent" /> {c.universityName}
                            </span>
                          )}
                          {c.instructorName && (
                            <span className="flex items-center gap-1">
                              <UserCheck className="h-3 w-3 text-accent" /> {c.instructorName}
                            </span>
                          )}
                          {(c.appName || c.organizationName) && (
                            <span className="text-primary/80 font-medium">
                              {c.appName || c.organizationName}
                            </span>
                          )}
                        </div>
                        {c.instructorSignatureUrl && (
                          <div className="mt-1.5 inline-flex items-center gap-2 rounded border border-border/70 bg-white px-2 py-0.5">
                            <img
                              src={c.instructorSignatureUrl}
                              alt={`${c.instructorName || "Instructor"} signature`}
                              className="h-5 max-w-[100px] object-contain"
                            />
                            <span className="text-[10px] text-muted-foreground">Instructor Signature</span>
                          </div>
                        )}
                      </div>
                    </div>
                    <Button size="sm" variant="outline" onClick={() => navigate(["student", "certificates", c.id])} className="shrink-0">
                      {t("common.view")}
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ─── Upcoming Activities (assignments + pending assessments) ─── */}
      {data.upcomingActivities && data.upcomingActivities.length > 0 && (
        <Card className="shadow-sm transition-all duration-200 hover:shadow-md">
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <div>
              <CardTitle className="text-base flex items-center gap-2">
                <CalendarDays className="h-4 w-4 text-accent" />
                {t("dashboard.upcomingActivities")}
              </CardTitle>
              <CardDescription className="mt-1">
                {t("student.pendingAssessments")}
              </CardDescription>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate(["student", "assignments"])}
              className="gap-1 text-accent hover:bg-accent/10 hover:text-accent"
            >
              {t("common.viewAll")} <ArrowRight className="h-4 w-4" />
            </Button>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 sm:grid-cols-2">
              {data.upcomingActivities.map((act) => (
                <UpcomingActivityCard
                  key={act.id}
                  activity={act}
                  onClick={() => navigate(["student", "learn", act.courseId])}
                />
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* ─── Recent Activity timeline ─── */}
      <Card className="shadow-sm transition-all duration-200 hover:shadow-md">
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <div>
            <CardTitle className="text-base flex items-center gap-2">
              <History className="h-4 w-4 text-accent" />
              {t("dashboard.recentActivity")}
            </CardTitle>
            <CardDescription className="mt-1">
              {t("student.recentActivityDesc")}
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          {activityLoading ? (
            <div className="space-y-3">
              {[1, 2, 3, 4].map((i) => (
                <Skeleton key={i} className="h-14 w-full rounded-lg" />
              ))}
            </div>
          ) : activityData?.activities && activityData.activities.length > 0 ? (
            <ol className="relative space-y-1 max-h-[28rem] overflow-y-auto scrollbar-thin pr-1">
              {/* vertical spine */}
              <span
                aria-hidden
                className="pointer-events-none absolute left-[1.45rem] top-2 bottom-2 w-px bg-gradient-to-b from-accent/40 via-border to-transparent"
              />
              {activityData.activities.map((a, i) => (
                <ActivityTimelineRow key={a.id} item={a} isFirst={i === 0} />
              ))}
            </ol>
          ) : (
            <EmptyState
              icon={<History className="h-5 w-5" />}
              title={t("student.noActivityYet")}
              description={t("student.startCourseActivity")}
              action={
                <Button size="sm" onClick={() => navigate(["student", "courses"])} className="gap-2">
                  {t("student.browseCoursesShort")} <ArrowRight className="h-4 w-4" />
                </Button>
              }
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function UpcomingActivityCard({
  activity,
  onClick,
}: {
  activity: UpcomingActivity;
  onClick: () => void;
}) {
  const { t } = useI18n();
  const isAssignment = activity.type === "assignment";
  const isOverdue = activity.priority === "overdue";

  const Icon = isAssignment ? ClipboardList : Video;

  const statusBadge = (() => {
    switch (activity.status) {
      case "submitted":
        return (
          <Badge className="bg-success/15 text-success border-transparent">
            <CheckCircle2 className="h-3 w-3" /> {t("student.submitted")}
          </Badge>
        );
      case "available":
        return (
          <Badge className="bg-accent/10 text-accent border-transparent">
            <CheckCircle2 className="h-3 w-3" /> {t("student.available")}
          </Badge>
        );
      case "pending":
        return (
          <Badge className="bg-warning/15 text-warning border-transparent">
            <Clock className="h-3 w-3" /> {t("common.scheduled")}
          </Badge>
        );
      case "locked":
      default:
        return (
          <Badge className="bg-muted text-muted-foreground border-transparent">
            <Lock className="h-3 w-3" /> {t("common.locked")}
          </Badge>
        );
    }
  })();

  return (
    <button
      onClick={onClick}
      className="group relative text-left rounded-xl border border-border bg-card p-4 shadow-sm hover:shadow-md hover:border-accent/40 hover:-translate-y-0.5 transition-all duration-200"
    >
      <div className="flex items-start gap-3">
        <div
          className={`flex h-10 w-10 items-center justify-center rounded-lg shrink-0 ring-1 ${
            isOverdue
              ? "bg-destructive/10 text-destructive ring-destructive/20"
              : isAssignment
                ? "bg-accent/10 text-accent ring-accent/20"
                : "bg-primary/10 text-primary ring-primary/20"
          }`}
        >
          <Icon className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <p className="text-sm font-semibold text-foreground line-clamp-1 group-hover:text-accent transition-colors">
              {activity.title}
            </p>
            <ArrowUpRight className="h-4 w-4 text-muted-foreground/60 group-hover:text-accent shrink-0 transition-colors" />
          </div>
          <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">
            {activity.courseTitle}
          </p>
          <div className="mt-2 flex items-center justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              <span className="flex items-center gap-1 rounded-full bg-muted/60 px-2 py-0.5 text-[10px] uppercase tracking-wide font-medium text-muted-foreground">
                {isAssignment ? t("student.assignment") : t("student.assessment")}
              </span>
              {activity.dueDate && (
                <span
                  className={`flex items-center gap-1 ${
                    isOverdue ? "text-destructive font-medium" : ""
                  }`}
                >
                  <Clock className="h-3 w-3" />
                  {isOverdue ? t("student.overdue") : t("student.due") + " "}
                  {formatDate(activity.dueDate)}
                </span>
              )}
            </div>
            {statusBadge}
          </div>
        </div>
      </div>
    </button>
  );
}

function ActivityTimelineRow({
  item,
  isFirst,
}: {
  item: ActivityItem;
  isFirst: boolean;
}) {
  const { t } = useI18n();
  const meta = activityMeta(item, t);
  return (
    <li
      className={`animate-entrance relative flex gap-3 rounded-lg px-2 py-2.5 transition-colors duration-200 hover:bg-muted/40 ${
        isFirst ? "" : ""
      }`}
    >
      {/* node */}
      <div className="relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full ring-2 ring-background bg-soft-sage text-accent">
        {meta.icon}
      </div>
      <div className="min-w-0 flex-1 pt-0.5">
        <div className="flex items-start justify-between gap-2">
          <p className="text-sm font-medium text-foreground line-clamp-1">
            {item.title}
          </p>
          <span className="text-[11px] text-muted-foreground whitespace-nowrap shrink-0">
            {formatDateTime(item.timestamp)}
          </span>
        </div>
        <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">
          <span className="text-muted-foreground/80">{item.courseTitle}</span>
          {" · "}
          {item.detail}
        </p>
        {meta.badge && <div className="mt-1.5">{meta.badge}</div>}
      </div>
    </li>
  );
}

function activityMeta(item: ActivityItem, t: (key: any) => string): {
  icon: React.ReactNode;
  badge?: React.ReactNode;
} {
  switch (item.type) {
    case "video_completed":
      return {
        icon: <Video className="h-4 w-4" />,
        badge: (
          <Badge className="bg-accent/10 text-accent border-transparent">
            <CheckCircle2 className="h-3 w-3" /> {t("common.completed")}
          </Badge>
        ),
      };
    case "assessment":
      return {
        icon: item.passed ? (
          <CheckCircle2 className="h-4 w-4 text-success" />
        ) : (
          <XCircle className="h-4 w-4 text-destructive" />
        ),
        badge: (
          <Badge
            className={
              item.passed
                ? "bg-success/15 text-success border-transparent"
                : "bg-destructive/15 text-destructive border-transparent"
            }
          >
            {item.passed ? t("student.passedShort") : t("common.failed")}
            {typeof item.score === "number" ? ` · ${item.score}%` : ""}
          </Badge>
        ),
      };
    case "submission":
      return {
        icon: <FileText className="h-4 w-4" />,
        badge: (
          <Badge className="bg-primary/10 text-primary border-transparent">
            <CheckCircle2 className="h-3 w-3" /> {t("student.submitted")}
          </Badge>
        ),
      };
    case "certificate":
      return {
        icon: <Award className="h-4 w-4 text-success" />,
        badge: item.certificateNumber ? (
          <Badge className="bg-success/15 text-success border-transparent">
            <Award className="h-3 w-3" /> {item.certificateNumber}
          </Badge>
        ) : undefined,
      };
    default:
      return {
        icon: <XCircle className="h-4 w-4" />,
      };
  }
}

function StatCard({
  icon, label, value, tint,
}: {
  icon: React.ReactNode;
  label: string;
  value: number | string;
  tint: "accent" | "primary" | "success" | "warning";
}) {
  const tintClasses: Record<typeof tint, string> = {
    accent: "bg-accent/10 text-accent ring-accent/20",
    primary: "bg-primary/10 text-primary ring-primary/20",
    success: "bg-success/15 text-success ring-success/20",
    warning: "bg-warning/15 text-warning ring-warning/20",
  };
  return (
    <Card className="card-glow p-4 sm:p-5 transition-all duration-200 hover:shadow-md hover:-translate-y-0.5 overflow-hidden">
      <div className="flex items-center gap-3 min-w-0">
        <div className={`flex h-10 w-10 sm:h-11 sm:w-11 items-center justify-center rounded-xl icon-gradient ring-1 ${tintClasses[tint]} shrink-0`}>
          {icon}
        </div>
        <div className="min-w-0">
          <p className="animate-count font-heading text-xl sm:text-2xl font-bold text-foreground leading-none truncate">{value}</p>
          <p className="text-xs text-muted-foreground mt-1.5 truncate">{label}</p>
        </div>
      </div>
    </Card>
  );
}
