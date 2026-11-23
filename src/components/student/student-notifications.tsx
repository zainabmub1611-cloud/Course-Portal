"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/shared/empty-state";
import { useApiFetch, apiPost } from "@/hooks/use-api";
import { useI18n } from "@/lib/i18n/store";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import {
  Bell, Check, CheckCheck, MessageSquare, Award, BookOpen,
  Info, AlertCircle, CalendarClock,
} from "lucide-react";
import { formatDateTime } from "@/types";
import { useAppStore } from "@/stores/app-store";

interface NotificationItem {
  id: string;
  type: string;
  title: string;
  content: string;
  relatedId: string | null;
  isRead: boolean;
  createdAt: string;
}

interface NotificationsResponse {
  notifications: NotificationItem[];
  unreadCount: number;
}

/**
 * Maps a notification `type` string → icon + colour + heading label used
 * when grouping. Unknown types fall back to a generic info style so new
 * server-side notification types don't break the UI.
 */
const TYPE_META: Record<
  string,
  { icon: React.ElementType; labelKey: string; tone: string }
> = {
  DISCUSSION_REPLY: {
    icon: MessageSquare,
    labelKey: "notifications.labelDiscussions",
    tone: "text-accent bg-accent/10",
  },
  CERTIFICATE: {
    icon: Award,
    labelKey: "notifications.labelCertificates",
    tone: "text-success bg-success/10",
  },
  COURSE: {
    icon: BookOpen,
    labelKey: "notifications.labelCourses",
    tone: "text-accent bg-accent/10",
  },
  ANNOUNCEMENT: {
    icon: Info,
    labelKey: "notifications.labelAnnouncements",
    tone: "text-primary bg-primary/10",
  },
  ASSIGNMENT: {
    icon: AlertCircle,
    labelKey: "notifications.labelAssignments",
    tone: "text-warning bg-warning/10",
  },
  SYSTEM: {
    icon: Info,
    labelKey: "notifications.labelSystem",
    tone: "text-muted-foreground bg-muted",
  },
};

function metaFor(type: string) {
  return (
    TYPE_META[type] ?? {
      icon: Info,
      labelKey: "notifications.labelGeneral",
      tone: "text-muted-foreground bg-muted",
    }
  );
}

/**
 * StudentNotifications — full-page notification centre.
 *
 * - Notifications are grouped by `type` (Discussions, Certificates,
 *   Announcements, etc.). Unread items always render at the top of their
 *   group with a sage dot + a slightly highlighted background.
 * - Clicking an unread notification marks it as read inline (the server
 *   PATCH returns the new unread count so we don't need a refetch).
 * - A "Mark all as read" button calls PATCH ?all=true.
 */
export function StudentNotifications() {
  const { t } = useI18n();
  const navigate = useAppStore((s) => s.navigate);
  const user = useAppStore((s) => s.user);
  const { data, loading, error, refetch, setData } =
    useApiFetch<NotificationsResponse>("/api/notifications");

  const [markingAll, setMarkingAll] = useState(false);
  const [markingId, setMarkingId] = useState<string | null>(null);

  const groups = useMemo(() => {
    const map = new Map<string, NotificationItem[]>();
    for (const n of data?.notifications ?? []) {
      const key = metaFor(n.type).labelKey;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(n);
    }
    return Array.from(map.entries()).map(([labelKey, items]) => ({
      labelKey,
      items,
      unread: items.filter((n) => !n.isRead).length,
    }));
  }, [data?.notifications]);

  async function markRead(notification: NotificationItem) {
    if (notification.isRead || markingId) return;
    setMarkingId(notification.id);
    try {
      const res = await apiPost<{ ok: boolean; unreadCount: number }>(
        `/api/notifications?id=${notification.id}`,
        null,
        { method: "PATCH" }
      );
      if (data) {
        setData({
          notifications: data.notifications.map((n) =>
            n.id === notification.id ? { ...n, isRead: true } : n
          ),
          unreadCount: res.unreadCount,
        });
      }
      window.dispatchEvent(new Event("notifications-updated"));
    } catch {
    } finally {
      setMarkingId(null);
    }
  }

  async function markAllRead() {
    if (markingAll) return;
    setMarkingAll(true);
    try {
      const res = await apiPost<{ ok: boolean; unreadCount: number }>(
        `/api/notifications?all=true`,
        null,
        { method: "PATCH" }
      );
      if (data) {
        setData({
          notifications: data.notifications.map((n) => ({
            ...n,
            isRead: true,
          })),
          unreadCount: res.unreadCount,
        });
      }
      window.dispatchEvent(new Event("notifications-updated"));
      toast({ title: t("notifications.allMarkedRead") });
    } catch {
    } finally {
      setMarkingAll(false);
    }
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-full rounded-xl" />
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-32 rounded-xl" />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <EmptyState
        icon={<Bell className="h-5 w-5" />}
        title={t("notifications.couldntLoad")}
        description={error}
        action={<Button onClick={() => refetch()}>{t("notifications.tryAgain")}</Button>}
      />
    );
  }

  const notifications = data?.notifications ?? [];
  const unread = data?.unreadCount ?? 0;

  return (
    <div className="space-y-5">
      {/* ─── Header ─── */}
      <div className="rounded-xl border border-border bg-gradient-to-br from-soft-sage/60 via-card to-card p-4 md:p-5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="relative flex h-10 w-10 items-center justify-center rounded-xl bg-accent/15 text-accent ring-1 ring-accent/20">
              <Bell className="h-5 w-5" />
              {unread > 0 && (
                <span className="absolute -top-1.5 -right-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-bold text-destructive-foreground ring-2 ring-card">
                  {unread > 9 ? "9+" : unread}
                </span>
              )}
            </div>
            <div className="min-w-0">
              <h1 className="font-heading text-lg font-semibold text-foreground truncate">
                {t("common.notifications")}
              </h1>
              <p className="text-sm text-muted-foreground mt-0.5">
                {notifications.length === 0
                  ? t("notifications.allCaughtUp")
                  : t("notifications.unreadTotal").replace("{unread}", String(unread)).replace("{total}", String(notifications.length))}
              </p>
            </div>
          </div>
          {unread > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={markAllRead}
              disabled={markingAll}
              className="gap-2"
            >
              <CheckCheck className="h-4 w-4" />
              {markingAll ? t("notifications.marking") : t("notifications.markAllReadShort")}
            </Button>
          )}
        </div>
      </div>

      {/* ─── Grouped lists ─── */}
      {notifications.length === 0 ? (
        <EmptyState
          icon={<Bell className="h-5 w-5" />}
          title={t("common.noNotifications")}
          description={t("notifications.noNotificationsDesc")}
          action={
            <Button
              onClick={() =>
                navigate(
                  user?.role === "STUDENT"
                    ? ["student", "overview"]
                    : ["university", "overview"]
                )
              }
              className="gap-2"
            >
              {t("notifications.backToDashboard")}
            </Button>
          }
        />
      ) : (
        <div className="space-y-5">
          {groups.map((group) => (
            <NotificationGroup
              key={group.labelKey}
              labelKey={group.labelKey}
              items={group.items}
              unread={group.unread}
              markingId={markingId}
              onMarkRead={markRead}
            />
          ))}
        </div>
      )}
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────────────── */

function NotificationGroup({
  labelKey,
  items,
  unread,
  markingId,
  onMarkRead,
}: {
  labelKey: string;
  items: NotificationItem[];
  unread: number;
  markingId: string | null;
  onMarkRead: (n: NotificationItem) => void;
}) {
  const { t } = useI18n();
  const meta = useMemo(() => {
    // Use the first item's type to pick the icon/tone — every item in a
    // group shares the same TYPE_META label, so the icon is consistent.
    if (items.length === 0) return null;
    return metaFor(items[0].type);
  }, [items]);

  if (!meta) return null;
  const Icon = meta.icon;

  return (
    <section>
      {/* Group header */}
      <div className="flex items-center gap-2 mb-2 px-1">
        <span
          className={cn(
            "flex h-6 w-6 items-center justify-center rounded-md",
            meta.tone
          )}
        >
          <Icon className="h-3.5 w-3.5" />
        </span>
        <h2 className="text-xs font-semibold uppercase tracking-[0.12em] text-foreground/80">
          {t(labelKey as any)}
        </h2>
        <span className="h-px flex-1 bg-gradient-to-r from-border to-transparent" />
        {unread > 0 && (
          <Badge className="bg-accent/15 text-accent border-transparent text-[10px] px-1.5 py-0 h-4">
            {unread} {t("notifications.new")}
          </Badge>
        )}
      </div>

      {/* Items */}
      <Card className="shadow-sm border-border overflow-hidden">
        <CardContent className="p-0">
          <ul className="divide-y divide-border/60">
            {items.map((n) => (
              <NotificationRow
                key={n.id}
                notification={n}
                meta={meta}
                marking={markingId === n.id}
                onClick={() => onMarkRead(n)}
              />
            ))}
          </ul>
        </CardContent>
      </Card>
    </section>
  );
}

/* ──────────────────────────────────────────────────────────────────────── */

function NotificationRow({
  notification,
  meta,
  marking,
  onClick,
}: {
  notification: NotificationItem;
  meta: { icon: React.ElementType; labelKey: string; tone: string };
  marking: boolean;
  onClick: () => void;
}) {
  const { t } = useI18n();
  const Icon = meta.icon;
  const wasRecent =
    Date.now() - new Date(notification.createdAt).getTime() < 24 * 60 * 60 * 1000;

  return (
    <li
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onClick();
        }
      }}
      className={cn(
        "group flex items-start gap-3 px-4 py-3 cursor-pointer transition-colors",
        notification.isRead
          ? "bg-card hover:bg-muted/30"
          : "bg-soft-sage/40 hover:bg-soft-sage/70"
      )}
    >
      {/* Left status column */}
      <div className="flex flex-col items-center gap-1 shrink-0 pt-0.5">
        <span
          className={cn(
            "flex h-7 w-7 items-center justify-center rounded-lg",
            meta.tone
          )}
        >
          <Icon className="h-3.5 w-3.5" />
        </span>
        {!notification.isRead && (
          <span
            className="h-1.5 w-1.5 rounded-full bg-accent ring-2 ring-card"
            aria-label={t("notifications.unread")}
          />
        )}
      </div>

      {/* Title + content */}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 mb-0.5">
          <p
            className={cn(
              "text-sm truncate",
              notification.isRead
                ? "font-medium text-foreground/80"
                : "font-semibold text-foreground"
            )}
          >
            {notification.title}
          </p>
        </div>
        <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">
          {notification.content}
        </p>
        <div className="mt-1.5 flex items-center gap-1 text-[11px] text-muted-foreground">
          <CalendarClock className="h-3 w-3" />
          {formatDateTime(notification.createdAt)}
          {wasRecent && (
            <Badge
              variant="outline"
              className="ml-1.5 text-[10px] px-1.5 py-0 h-4 border-border text-muted-foreground"
            >
              {t("notifications.recent")}
            </Badge>
          )}
        </div>
      </div>

      {/* Right action */}
      <div className="shrink-0">
        {!notification.isRead ? (
          <Button
            variant="ghost"
            size="sm"
            className="h-7 gap-1.5 text-muted-foreground hover:text-accent opacity-0 group-hover:opacity-100 transition-opacity"
            disabled={marking}
            onClick={(e) => {
              e.stopPropagation();
              onClick();
            }}
          >
            {marking ? (
              <>
                <span className="h-3.5 w-3.5 border-2 border-current border-t-transparent rounded-full animate-spin" />
              </>
            ) : (
              <>
                <Check className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">{t("notifications.markRead")}</span>
              </>
            )}
          </Button>
        ) : (
          <Check className="h-4 w-4 text-success opacity-60" />
        )}
      </div>
    </li>
  );
}

// Unused export kept for tree-shaking clarity
export const _icons = { Bell };
