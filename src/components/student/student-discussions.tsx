"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { EmptyState } from "@/components/shared/empty-state";
import { useApiFetch } from "@/hooks/use-api";
import { cn } from "@/lib/utils";
import {
  MessageSquare, Search, Pin, Lock, Reply, ChevronRight,
  BookOpen, X, MessagesSquare,
} from "lucide-react";
import { formatDateTime, formatDate } from "@/types";
import { useAppStore } from "@/stores/app-store";
import { useI18n } from "@/lib/i18n/store";

interface DiscussionItem {
  id: string;
  courseId: string;
  authorId: string;
  title: string;
  content: string;
  isPinned: boolean;
  isLocked: boolean;
  createdAt: string;
  updatedAt: string;
  author: { id: string; name: string; profilePhoto: string | null };
  course: { id: string; title: string } | null;
  replyCount: number;
}

interface DiscussionsResponse {
  discussions: DiscussionItem[];
}

/**
 * StudentDiscussions — full-page discussion list.
 *
 * Aggregates every discussion thread across the student's enrolled
 * courses into a single scannable list. Each row shows the post title,
 * the course it belongs to, the author chip, reply count, and the
 * updated date. Clicking a row deep-links into the learning page with
 * `?tab=discussions&discussion=<id>` so the learning page can open the
 * discussion tab and auto-scroll to that thread.
 *
 * Pinned posts float to the top of each course group and are marked with
 * a pin icon; locked posts show a lock badge and remain read-only.
 */
export function StudentDiscussions() {
  const { t } = useI18n();
  const navigate = useAppStore((s) => s.navigate);
  const { data, loading, error, refetch } = useApiFetch<DiscussionsResponse>(
    "/api/student/discussions"
  );

  const [search, setSearch] = useState("");
  const [courseFilter, setCourseFilter] = useState<string>("all");

  const courseOptions = useMemo(() => {
    const seen = new Map<string, string>();
    for (const d of data?.discussions ?? []) {
      if (d.course && !seen.has(d.course.id)) {
        seen.set(d.course.id, d.course.title);
      }
    }
    return Array.from(seen.entries()).map(([id, title]) => ({ id, title }));
  }, [data?.discussions]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (data?.discussions ?? []).filter((d) => {
      if (courseFilter !== "all" && d.course?.id !== courseFilter) return false;
      if (!q) return true;
      return (
        d.title.toLowerCase().includes(q) ||
        d.content.toLowerCase().includes(q) ||
        (d.course?.title.toLowerCase().includes(q) ?? false) ||
        d.author.name.toLowerCase().includes(q)
      );
    });
  }, [data?.discussions, search, courseFilter]);

  function openDiscussion(d: DiscussionItem) {
    // Deep-link into the learning page's discussion tab; the learning page
    // reads the `discussion` query param to auto-scroll / highlight.
    navigate(
      ["student", "learn", d.courseId],
      { tab: "discussions", discussion: d.id }
    );
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-full rounded-xl" />
        {[1, 2, 3, 4].map((i) => (
          <Skeleton key={i} className="h-24 rounded-xl" />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <EmptyState
        icon={<MessageSquare className="h-5 w-5" />}
        title={t("discussions.couldntLoad")}
        description={error}
        action={<Button onClick={() => refetch()}>{t("discussions.tryAgain")}</Button>}
      />
    );
  }

  const discussions = data?.discussions ?? [];
  const total = discussions.length;

  return (
    <div className="space-y-5">
      {/* ─── Header ─── */}
      <div className="rounded-xl border border-border bg-gradient-to-br from-soft-sage/60 via-card to-card p-4 md:p-5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent/15 text-accent ring-1 ring-accent/20">
              <MessagesSquare className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <h1 className="font-heading text-lg font-semibold text-foreground truncate">
                {t("discussions.title")}
              </h1>
              <p className="text-sm text-muted-foreground mt-0.5">
                {total === 0
                  ? t("discussions.joinConversation")
                  : t("discussions.threadsAcrossCourses").replace("{count}", String(total)).replace("{courses}", String(courseOptions.length))}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* ─── Search + filter ─── */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t("discussions.searchPlaceholder")}
            className="pl-9"
            aria-label={t("discussions.searchDiscussions")}
          />
          {search && (
            <button
              onClick={() => setSearch("")}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded p-0.5 text-muted-foreground hover:text-foreground"
              aria-label={t("discussions.clearSearch")}
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
        {courseOptions.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            <FilterChip
              active={courseFilter === "all"}
              onClick={() => setCourseFilter("all")}
            >
              {t("common.all")}
            </FilterChip>
            {courseOptions.map((c) => (
              <FilterChip
                key={c.id}
                active={courseFilter === c.id}
                onClick={() => setCourseFilter(c.id)}
              >
                {c.title}
              </FilterChip>
            ))}
          </div>
        )}
      </div>

      {/* ─── Discussion list ─── */}
      {filtered.length === 0 ? (
        <EmptyState
          icon={<MessageSquare className="h-5 w-5" />}
          title={
            total === 0 ? t("discussions.noDiscussions") : t("discussions.noThreadsMatchSearch")
          }
          description={
            total === 0
              ? t("discussions.createInsideCourse")
              : t("discussions.tryDifferentOrClear")
          }
          action={
            total === 0 ? (
              <Button
                onClick={() => navigate(["student", "courses"])}
                className="gap-2"
              >
                {t("discussions.browseCourses")} <ChevronRight className="h-4 w-4" />
              </Button>
            ) : (
              <Button
                variant="outline"
                onClick={() => {
                  setSearch("");
                  setCourseFilter("all");
                }}
              >
                {t("discussions.clearFilters")}
              </Button>
            )
          }
        />
      ) : (
        <div className="space-y-3">
          {filtered.map((d) => (
            <DiscussionRow
              key={d.id}
              discussion={d}
              onClick={() => openDiscussion(d)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────────────── */

function FilterChip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "rounded-full px-3 py-1.5 text-xs font-medium border transition-colors whitespace-nowrap",
        active
          ? "bg-primary text-primary-foreground border-primary"
          : "bg-card text-muted-foreground border-border hover:border-accent/40 hover:text-foreground"
      )}
    >
      {children}
    </button>
  );
}

/* ──────────────────────────────────────────────────────────────────────── */

function DiscussionRow({
  discussion,
  onClick,
}: {
  discussion: DiscussionItem;
  onClick: () => void;
}) {
  const { t } = useI18n();
  const initials = discussion.author.name
    .split(" ")
    .map((s) => s[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  const wasUpdated =
    new Date(discussion.updatedAt).getTime() >
    new Date(discussion.createdAt).getTime() + 1000;

  return (
    <Card
      className="group cursor-pointer shadow-sm border-border hover:border-accent/40 hover:shadow-md transition-all duration-200"
      onClick={onClick}
      role="link"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onClick();
        }
      }}
    >
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          {/* Author avatar */}
          <Avatar className="h-9 w-9 ring-2 ring-accent/15 ring-offset-2 ring-offset-background shrink-0">
            {discussion.author.profilePhoto ? (
              <AvatarImage
                src={discussion.author.profilePhoto}
                alt={discussion.author.name}
              />
            ) : null}
            <AvatarFallback className="bg-gradient-to-br from-primary to-accent text-[11px] font-semibold text-primary-foreground">
              {initials}
            </AvatarFallback>
          </Avatar>

          <div className="min-w-0 flex-1">
            {/* Title row */}
            <div className="flex items-start gap-2 mb-1">
              <h3 className="text-sm font-semibold text-foreground group-hover:text-accent transition-colors line-clamp-1 flex-1 min-w-0">
                {discussion.title}
              </h3>
              <div className="flex items-center gap-1 shrink-0">
                {discussion.isPinned && (
                  <Badge className="bg-accent/15 text-accent border-transparent px-1.5 py-0 h-5 gap-0.5">
                    <Pin className="h-3 w-3" /> {t("discussions.pinned")}
                  </Badge>
                )}
                {discussion.isLocked && (
                  <Badge className="bg-muted text-muted-foreground border-transparent px-1.5 py-0 h-5 gap-0.5">
                    <Lock className="h-3 w-3" /> {t("discussions.locked")}
                  </Badge>
                )}
              </div>
            </div>

            {/* Content preview */}
            <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">
              {discussion.content}
            </p>

            {/* Meta row */}
            <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
              <span className="flex items-center gap-1 font-medium text-foreground/80">
                {discussion.author.name}
              </span>
              {discussion.course && (
                <span className="flex items-center gap-1">
                  <BookOpen className="h-3 w-3" />
                  {discussion.course.title}
                </span>
              )}
              <span className="flex items-center gap-1">
                <Reply className="h-3 w-3" />
                {t("discussions.replyCount").replace("{count}", String(discussion.replyCount)).replace("{word}", discussion.replyCount === 1 ? t("discussions.replyWordSingular") : t("discussions.replyWordPlural"))}
              </span>
              <span>
                {wasUpdated
                  ? `${t("discussions.updatedShort")} ${formatDate(discussion.updatedAt)}`
                  : `${formatDateTime(discussion.createdAt)}`}
              </span>
            </div>
          </div>

          <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0 mt-1 group-hover:text-accent group-hover:translate-x-0.5 transition-all" />
        </div>
      </CardContent>
    </Card>
  );
}

// Unused export kept for tree-shaking clarity
export const _icons = { MessageSquare };
