"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
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
  Collapsible,
  CollapsibleTrigger,
  CollapsibleContent,
} from "@/components/ui/collapsible";
import { EmptyState } from "@/components/shared/empty-state";
import { useApiFetch, apiPost } from "@/hooks/use-api";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import {
  Bookmark as BookmarkIcon, BookOpen, ChevronDown, ChevronRight,
  Link2, PlayCircle, Trash2, FolderOpen,
} from "lucide-react";
import { formatDate } from "@/types";
import { useAppStore } from "@/stores/app-store";
import { useI18n } from "@/lib/i18n/store";

interface BookmarkItem {
  id: string;
  courseId: string;
  topicId: string | null;
  videoId: string | null;
  videoTimestamp: number | null;
  label: string | null;
  createdAt: string;
  course: { id: string; title: string };
  topic: { id: string; title: string } | null;
  video: { id: string; title: string } | null;
}

interface BookmarksResponse {
  bookmarks: BookmarkItem[];
}

/**
 * StudentBookmarks — full-page bookmark view.
 *
 * Bookmarks are grouped by course (the natural unit students think in).
 * Each group is rendered as a collapsible <Card> with a header count and a
 * list of individual bookmark rows. Each row shows the optional label,
 * the topic/video context, a clickable timestamp deep-link, and a remove
 * button.
 */
export function StudentBookmarks() {
  const { t } = useI18n();
  const navigate = useAppStore((s) => s.navigate);
  const { data, loading, error, refetch, setData } = useApiFetch<BookmarksResponse>(
    "/api/student/bookmarks"
  );

  const [deleting, setDeleting] = useState<BookmarkItem | null>(null);

  // Group bookmarks by course, preserving server order (which is created
  // desc) within each group. We also alphabetise the groups by title for
  // a predictable scanning order.
  const grouped = useMemo(() => {
    const map = new Map<string, { title: string; items: BookmarkItem[] }>();
    for (const b of data?.bookmarks ?? []) {
      if (!map.has(b.courseId)) {
        map.set(b.courseId, { title: b.course.title, items: [] });
      }
      map.get(b.courseId)!.items.push(b);
    }
    return Array.from(map.entries())
      .map(([id, g]) => ({ courseId: id, title: g.title, items: g.items }))
      .sort((a, b) => a.title.localeCompare(b.title));
  }, [data?.bookmarks]);

  const totalCount = data?.bookmarks.length ?? 0;

  async function confirmDelete() {
    if (!deleting) return;
    try {
      await apiPost(`/api/student/bookmarks/${deleting.id}`, null, {
        method: "DELETE",
      });
      if (data) {
        setData({
          bookmarks: data.bookmarks.filter((b) => b.id !== deleting.id),
        });
      }
      toast({ title: t("bookmarks.removedToast") });
    } catch {
    } finally {
      setDeleting(null);
    }
  }

  if (loading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-40 rounded-xl" />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <EmptyState
        icon={<BookmarkIcon className="h-5 w-5" />}
        title={t("bookmarks.couldntLoad")}
        description={error}
        action={<Button onClick={() => refetch()}>{t("bookmarks.tryAgain")}</Button>}
      />
    );
  }

  return (
    <div className="space-y-5">
      {/* ─── Header ─── */}
      <div className="rounded-xl border border-border bg-gradient-to-br from-soft-sage/60 via-card to-card p-4 md:p-5 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent/15 text-accent ring-1 ring-accent/20">
            <BookmarkIcon className="h-5 w-5" />
          </div>
          <div>
            <h1 className="font-heading text-lg font-semibold text-foreground">
              {t("bookmarks.myBookmarks")}
            </h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              {totalCount === 0
                ? t("bookmarks.saveKeyMoments")
                : t("bookmarks.bookmarksInCourses").replace("{count}", String(totalCount)).replace("{courses}", String(grouped.length))}
            </p>
          </div>
        </div>
      </div>

      {/* ─── Grouped list ─── */}
      {grouped.length === 0 ? (
        <EmptyState
          icon={<BookmarkIcon className="h-5 w-5" />}
          title={t("bookmarks.noBookmarks")}
          description={t("bookmarks.noBookmarksDesc")}
          action={
            <Button onClick={() => navigate(["student", "courses"])} className="gap-2">
              {t("bookmarks.browseCourses")} <ChevronRight className="h-4 w-4" />
            </Button>
          }
        />
      ) : (
        <div className="space-y-4">
          {grouped.map((group, idx) => (
            <BookmarkGroup
              key={group.courseId}
              group={group}
              defaultOpen={idx === 0}
              onDelete={(b) => setDeleting(b)}
              onSeekVideo={(courseId) => navigate(["student", "learn", courseId])}
            />
          ))}
        </div>
      )}

      {/* ─── Delete confirmation ─── */}
      <AlertDialog open={deleting !== null} onOpenChange={(o) => !o && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("bookmarks.removeThisBookmark")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("bookmarks.removeCannotUndo")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {t("bookmarks.remove")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────────────── */

function BookmarkGroup({
  group,
  defaultOpen,
  onDelete,
  onSeekVideo,
}: {
  group: { courseId: string; title: string; items: BookmarkItem[] };
  defaultOpen: boolean;
  onDelete: (b: BookmarkItem) => void;
  onSeekVideo: (courseId: string) => void;
}) {
  const { t } = useI18n();
  return (
    <Collapsible defaultOpen={defaultOpen}>
      <Card className="shadow-sm border-border overflow-hidden">
        <CollapsibleTrigger asChild>
          <CardHeader className="cursor-pointer hover:bg-soft-sage/40 transition-colors border-b border-border/60">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5 min-w-0">
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent/10 text-accent shrink-0">
                  <BookOpen className="h-4 w-4" />
                </span>
                <div className="min-w-0">
                  <CardTitle className="text-base truncate">
                    {group.title}
                  </CardTitle>
                  <CardDescription className="mt-0.5">
                    {t("bookmarks.bookmarkCount").replace("{count}", String(group.items.length))}
                  </CardDescription>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <Badge variant="outline" className="border-accent/30 text-accent">
                  {group.items.length}
                </Badge>
                <ChevronDown className="h-4 w-4 text-muted-foreground [[data-state=open]_&]:rotate-180 transition-transform" />
              </div>
            </div>
          </CardHeader>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <CardContent className="p-0">
            <ul className="divide-y divide-border/60">
              {group.items.map((b) => (
                <BookmarkRow
                  key={b.id}
                  bookmark={b}
                  onDelete={() => onDelete(b)}
                  onSeekVideo={() => onSeekVideo(b.courseId)}
                />
              ))}
            </ul>
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}

/* ──────────────────────────────────────────────────────────────────────── */

function BookmarkRow({
  bookmark,
  onDelete,
  onSeekVideo,
}: {
  bookmark: BookmarkItem;
  onDelete: () => void;
  onSeekVideo: () => void;
}) {
  const { t } = useI18n();
  const hasVideo = bookmark.videoId && bookmark.video;
  const hasTimestamp = hasVideo && bookmark.videoTimestamp !== null;

  return (
    <li className="group flex items-start gap-3 px-4 py-3 hover:bg-soft-sage/30 transition-colors">
      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent/10 text-accent shrink-0 mt-0.5">
        {hasVideo ? <PlayCircle className="h-4 w-4" /> : <Link2 className="h-4 w-4" />}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 mb-0.5">
          <p className="text-sm font-medium text-foreground truncate">
            {bookmark.label || (hasVideo ? bookmark.video!.title : t("bookmarks.bookmarkDefault"))}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted-foreground">
          {bookmark.topic && (
            <span className="flex items-center gap-1">
              <FolderOpen className="h-3 w-3" />
              {bookmark.topic.title}
            </span>
          )}
          {hasVideo && (
            <span className="flex items-center gap-1">
              <PlayCircle className="h-3 w-3" />
              {bookmark.video!.title}
            </span>
          )}
        </div>
        <div className="mt-1.5 flex items-center gap-3">
          {hasTimestamp && (
            <button
              onClick={onSeekVideo}
              className="inline-flex items-center gap-1 rounded-md border border-accent/30 bg-accent/5 px-2 py-0.5 text-[11px] font-medium text-accent hover:bg-accent/10 transition-colors"
              title={t("bookmarks.openVideoAtMoment")}
            >
              <PlayCircle className="h-3 w-3" />
              {formatTimestamp(bookmark.videoTimestamp!)}
            </button>
          )}
          <span className="text-[11px] text-muted-foreground">
            {formatDate(bookmark.createdAt)}
          </span>
        </div>
      </div>
      <Button
        variant="ghost"
        size="icon"
        className="h-7 w-7 shrink-0 text-muted-foreground hover:text-destructive opacity-60 group-hover:opacity-100 transition-opacity"
        onClick={onDelete}
        aria-label={t("bookmarks.removeAria")}
      >
        <Trash2 className="h-3.5 w-3.5" />
      </Button>
    </li>
  );
}

/* ──────────────────────────────────────────────────────────────────────── */

function formatTimestamp(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) {
    return `${h}:${m.toString().padStart(2, "0")}:${sec.toString().padStart(2, "0")}`;
  }
  return `${m}:${sec.toString().padStart(2, "0")}`;
}

// Unused export kept for tree-shaking clarity
export const _icons = { cn };
