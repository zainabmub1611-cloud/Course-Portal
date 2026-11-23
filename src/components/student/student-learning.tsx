"use client";

import { useEffect, useRef, useState, useCallback, useMemo } from "react";
import { createPortal } from "react-dom";
import { useAppStore } from "@/stores/app-store";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/shared/empty-state";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle,
} from "@/components/ui/sheet";
import {
  Tooltip, TooltipTrigger, TooltipContent, TooltipProvider,
} from "@/components/ui/tooltip";
import { ScrollArea } from "@/components/ui/scroll-area";
import { LanguageSwitcher } from "@/components/shared/language-switcher";
import {
  useApiFetch,
  apiPost,
  apiUpload,
  authFetch,
  markApiCacheUrlStale,
  registerBeforeLogoutFlush,
} from "@/hooks/use-api";
import { withAuthHeaders } from "@/lib/auth/client-token";
import { VideoNotesPanel } from "@/components/student/video-notes-panel";
import { CourseDiscussionsPanel } from "@/components/student/course-discussions-panel";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import {
  ArrowLeft, PlayCircle, CheckCircle2, Lock, FileText, Download, Link as LinkIcon,
  Upload, Award, ClipboardList, AlertTriangle, Clock, Video as VideoIcon, Info,
  Maximize2, Minimize2, ChevronLeft, ChevronRight, BookOpen, Sparkles,
  HelpCircle, XCircle, RefreshCw, ListChecks, MessageSquare, StickyNote,
  LayoutDashboard, Bookmark, Bell, User as UserIcon, MessagesSquare,
  GraduationCap, Trophy, ChevronDown, Eye, ExternalLink,
  Play, Pause, Volume2, VolumeX, RotateCcw, RotateCw,
} from "lucide-react";
import { formatDateTime } from "@/types";
import { useI18n } from "@/lib/i18n/store";

// ─── YouTube IFrame Player API (loaded once, shared across mounts) ───
declare global {
  interface Window {
    YT?: any;
    onYouTubeIframeAPIReady?: () => void;
  }
}

let ytApiPromise: Promise<any> | null = null;
function loadYouTubeAPI(): Promise<any> {
  if (typeof window === "undefined") return Promise.reject(new Error("no window"));
  if (window.YT && window.YT.Player) return Promise.resolve(window.YT);
  if (ytApiPromise) return ytApiPromise;
  ytApiPromise = new Promise((resolve, reject) => {
    const finish = () => {
      if (window.YT && window.YT.Player) {
        resolve(window.YT);
        return true;
      }
      return false;
    };

    if (finish()) return;

    const prev = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      if (typeof prev === "function") { try { prev(); } catch {} }
      resolve(window.YT);
    };

    if (window.YT && typeof window.YT.ready === "function") {
      try {
        window.YT.ready(() => resolve(window.YT));
        return;
      } catch {}
    }

    const existing = document.querySelector('script[src="https://www.youtube.com/iframe_api"]') as HTMLScriptElement | null;
    if (!existing) {
      const tag = document.createElement("script");
      tag.src = "https://www.youtube.com/iframe_api";
      tag.async = true;
      tag.onerror = () => {
        ytApiPromise = null;
        reject(new Error("Failed to load YouTube IFrame API"));
      };
      document.head.appendChild(tag);
    } else if (window.YT && window.YT.Player) {
      resolve(window.YT);
    }
  });
  return ytApiPromise;
}

// Player abstraction — lets HTML5 <video> and the YouTube IFrame player share
// one set of tracking logic (time ticks, seek handling, question triggers).
interface PlayerApi {
  currentTime: () => number;
  duration: () => number;
  pause: () => void;
  play: () => void;
  seekTo: (t: number) => void;
  paused: () => boolean;
  setMuted?: (m: boolean) => void;
  setVolume?: (v: number) => void;
  setPlaybackRate?: (r: number) => void;
}

interface VideoProgressInfo {
  lastPosition: number;
  watchTimeSeconds: number;
  duration: number;
  isCompleted: boolean;
  completedAt: string | null;
  updatedAt?: string | null;
}

interface LocalVideoSnapshot {
  lastPosition: number;
  watchTimeSeconds: number;
  duration: number;
  updatedAtMs: number;
}

const LOCAL_VIDEO_PROGRESS_PREFIX = "courselearn_vp_";
const LOCAL_LAST_VIDEO_PREFIX = "courselearn_lv_";

function readLocalVideoProgress(
  userId: string | null,
  videoId: string
): LocalVideoSnapshot | null {
  if (!userId || typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(
      `${LOCAL_VIDEO_PROGRESS_PREFIX}${userId}_${videoId}`
    );
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (
      typeof parsed?.lastPosition === "number" &&
      typeof parsed?.updatedAtMs === "number"
    ) {
      return {
        lastPosition: Math.max(0, parsed.lastPosition),
        watchTimeSeconds: Math.max(0, Number(parsed.watchTimeSeconds || 0)),
        duration: Math.max(0, Number(parsed.duration || 0)),
        updatedAtMs: parsed.updatedAtMs,
      };
    }
  } catch {
    /* ignore storage errors */
  }
  return null;
}

function writeLocalVideoProgress(
  userId: string | null,
  videoId: string,
  snap: LocalVideoSnapshot
) {
  if (!userId || typeof window === "undefined") return;
  try {
    window.localStorage.setItem(
      `${LOCAL_VIDEO_PROGRESS_PREFIX}${userId}_${videoId}`,
      JSON.stringify(snap)
    );
  } catch {
    /* ignore storage errors */
  }
}

function readLocalLastVideo(userId: string | null, courseId: string): string | null {
  if (!userId || typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(
      `${LOCAL_LAST_VIDEO_PREFIX}${userId}_${courseId}`
    );
  } catch {
    return null;
  }
}

function writeLocalLastVideo(
  userId: string | null,
  courseId: string,
  videoId: string
) {
  if (!userId || typeof window === "undefined") return;
  try {
    window.localStorage.setItem(
      `${LOCAL_LAST_VIDEO_PREFIX}${userId}_${courseId}`,
      videoId
    );
  } catch {
    /* ignore storage errors */
  }
}

interface VideoItem {
  id: string;
  title: string;
  description: string | null;
  source: "UPLOAD" | "YOUTUBE" | "URL";
  videoUrl: string;
  thumbnail: string | null;
  displayOrder: number;
  duration: number;
  hasQuestions: boolean;
  questionCount: number;
  assessmentPassed: boolean | null; // null = no questions or unattempted, true/false if attempted
  assessmentAttempted?: boolean;
  assessmentScore?: number | null;
  assessmentAttempts?: number;
  progress: VideoProgressInfo | null;
}

function isVideoFullyCompleted(v: VideoItem): boolean {
  return Boolean(v.progress?.isCompleted) && (!v.hasQuestions || v.assessmentPassed === true);
}

function isVideoAssessmentFailed(v: VideoItem): boolean {
  return Boolean(v.hasQuestions && v.assessmentPassed === false);
}

// ─── Video Assessment types ───
// Mirrors the shape returned by GET /api/student/videos/[videoId]/questions
// (note: correctAnswer is intentionally NOT included by the API for security).
interface VideoQuestionData {
  id: string;
  question: string;
  options: string[];
  timestamp: number;
}

interface VideoAssessmentSummary {
  score: number;
  passed: boolean;
  attempts: number;
}

// Mirrors the POST assessment response — includes per-question correctness
// because the server validates answers server-side and reveals them here.
interface AssessmentAnswerResult {
  questionId: string;
  question: string;
  options: string[];
  selectedAnswer: number;
  correctAnswer: number;
  correct: boolean;
}

interface AssessmentResult {
  id?: string;
  score: number;
  passed: boolean;
  attempts: number;
  correctCount: number;
  totalQuestions: number;
  answers: AssessmentAnswerResult[];
}

interface TopicItem {
  id: string;
  title: string;
  description: string | null;
  displayOrder: number;
  videos: VideoItem[];
  materials: MaterialItem[];
}

interface MaterialItem {
  id: string;
  title: string;
  description: string | null;
  type: string;
  fileUrl: string;
  topic?: { id: string; title: string } | null;
}

interface AssignmentInfo {
  id: string;
  title: string | null;
  description: string | null;
  instructions: string | null;
  fileUrl: string | null;
  dueDate: string | null;
  isPublished: boolean;
  allowResubmission: boolean;
}

interface SubmissionInfo {
  id: string;
  fileUrl: string;
  submittedAt: string;
  status: "SUBMITTED" | "PASSED" | "FAILED" | "REVIEWED";
  reviewNotes: string | null;
  reviewedAt: string | null;
}

interface AssignmentEntry extends AssignmentInfo {
  submission: SubmissionInfo | null;
}

interface CourseDetail {
  id: string;
  title: string;
  description: string | null;
  thumbnail: string | null;
  category: string | null;
  accessType: "FREE" | "PAID";
  topics: TopicItem[];
  materials: MaterialItem[];
  assignments?: AssignmentEntry[];
  assignment: AssignmentInfo | null;
  submission: SubmissionInfo | null;
  certificate: {
    id: string;
    certificateNumber: string;
    issuedAt: string;
  } | null;
  courseCompletion: {
    totalVideos: number;
    completedVideos: number;
    completedTopics: number;
    totalTopics: number;
    percent: number;
    allCompleted: boolean;
  };
  certificateTemplate: {
    id: string;
    isEnabled: boolean;
    title: string;
    bodyText: string;
    organizationName: string;
  } | null;
}

interface CourseResponse { course: CourseDetail }

/* ===================== Learning Left Icon Sidebar ===================== */
/*
 * Narrow 56px icon-only navigation rendered as a fixed bar on the left of
 * the learning page. Reuses the same student NAV items as the global
 * StudentSidebar but strips text/labels. Tooltips on hover reveal labels.
 * The brand logo sits at the top, the user avatar at the bottom.
 */
const LEARNING_NAV: Array<{
  labelKey: string;
  icon: typeof LayoutDashboard;
  segments: string[];
}> = [
  { labelKey: "nav.dashboard", icon: LayoutDashboard, segments: ["student", "overview"] },
  { labelKey: "nav.exploreCourses", icon: BookOpen, segments: ["student", "courses"] },
  { labelKey: "nav.myNotes", icon: StickyNote, segments: ["student", "notes"] },
  { labelKey: "nav.myBookmarks", icon: Bookmark, segments: ["student", "bookmarks"] },
  { labelKey: "nav.discussions", icon: MessagesSquare, segments: ["student", "discussions"] },
  { labelKey: "nav.notifications", icon: Bell, segments: ["student", "notifications"] },
  { labelKey: "nav.myProfile", icon: UserIcon, segments: ["student", "profile"] },
];

function LearningLeftSidebar() {
  const { t } = useI18n();
  const segments = useAppStore((s) => s.segments);
  const navigate = useAppStore((s) => s.navigate);
  const user = useAppStore((s) => s.user);
  const branding = useAppStore((s) => s.branding);
  const current = segments[1] || "overview";
  const appName = branding.appName || "CourseLearn";

  const initials = (user?.name || "S")
    .split(" ")
    .map((s) => s[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <TooltipProvider delayDuration={150}>
      <aside className="learn-left-rail fixed left-0 top-0 z-30 hidden h-screen w-14 flex-col items-center gap-1 border-r border-border bg-card py-3 lg:flex">
        {/* Brand logo (icon only) */}
        <button
          onClick={() => navigate(["student", "overview"])}
          className="mb-2 flex h-10 w-10 items-center justify-center overflow-hidden rounded-xl bg-primary text-primary-foreground shadow-sm transition-transform hover:scale-105"
          aria-label={`${appName} home`}
        >
          {branding.logoUrl ? (
            <img
              key="learn-logo-img"
              src={branding.logoUrl}
              alt={appName}
              className="h-full w-full object-contain bg-card p-0.5"
            />
          ) : (
            <GraduationCap key="learn-logo-icon" className="h-5 w-5" />
          )}
        </button>

        {/* Vertical icon nav */}
        <nav className="flex flex-1 flex-col items-center gap-1.5 py-2">
          {LEARNING_NAV.map((item) => {
            const active = current === item.segments[1];
            const Icon = item.icon;
            return (
              <Tooltip key={item.labelKey}>
                <TooltipTrigger asChild>
                  <button
                    onClick={() => navigate(item.segments)}
                    aria-label={t(item.labelKey as any)}
                    className={cn(
                      "group relative flex h-10 w-10 items-center justify-center rounded-xl transition-all duration-200",
                      active
                        ? "bg-primary/10 text-primary ring-1 ring-primary/20"
                        : "text-muted-foreground hover:bg-muted hover:text-foreground"
                    )}
                  >
                    {active && (
                      <span className="absolute left-0 top-1/2 h-5 w-1 -translate-y-1/2 rounded-r-full bg-primary" />
                    )}
                    <Icon className="h-5 w-5" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="right" sideOffset={8}>
                  {t(item.labelKey as any)}
                </TooltipContent>
              </Tooltip>
            );
          })}
        </nav>

        {/* User avatar at the bottom */}
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              onClick={() => navigate(["student", "profile"])}
              className="mt-1 flex h-10 w-10 items-center justify-center rounded-full ring-2 ring-primary/30 ring-offset-2 ring-offset-card transition-shadow hover:ring-primary/50"
              aria-label={user?.name || "Profile"}
            >
              <Avatar className="h-9 w-9">
                {user?.profilePhoto ? (
                  <AvatarImage src={user.profilePhoto} alt={user?.name || ""} />
                ) : null}
                <AvatarFallback className="bg-gradient-to-br from-primary to-primary/70 text-xs font-semibold text-primary-foreground">
                  {initials}
                </AvatarFallback>
              </Avatar>
            </button>
          </TooltipTrigger>
          <TooltipContent side="right" sideOffset={8}>
            {user?.name || "Profile"}
          </TooltipContent>
        </Tooltip>
      </aside>
    </TooltipProvider>
  );
}

/* ===================== Learning Right Sidebar ===================== */
/*
 * ~300px right rail with course title, segmented teal progress bar,
 * a chapter (topic) list using numbered circles (completed = green check,
 * active = purple, locked = gray lock), expandable lessons per chapter,
 * and a "discussion preview" footer showing recent comments with avatars.
 *
 * The discussion preview fetches its own lightweight list via the existing
 * /api/student/discussions endpoint scoped to the course. It's purely
 * informational — clicking the Discussions tab on the main content area
 * is the entry point to the full thread UI.
 */
interface SidebarDiscussion {
  id: string;
  title: string;
  createdAt: string;
  author: { id: string; name: string; profilePhoto: string | null };
  replyCount: number;
}

function LearningCurriculumBody({
  course,
  activeTopic,
  activeVideoId,
  onSelectVideo,
}: {
  course: CourseDetail;
  activeTopic: TopicItem | undefined;
  activeVideoId: string | null;
  onSelectVideo: (id: string) => void;
}) {
  const { t } = useI18n();
  const navigate = useAppStore((s) => s.navigate);
  const [expandedTopics, setExpandedTopics] = useState<Set<string>>(
    () => new Set(activeTopic ? [activeTopic.id] : course.topics[0] ? [course.topics[0].id] : [])
  );

  // Lightweight discussions list (preview only). Uses the same endpoint as
  // the full CourseDiscussionsPanel — this fetch is independent so the
  // preview doesn't block rendering and doesn't share state with the panel.
  const { data: discussionsData } = useApiFetch<{ discussions: SidebarDiscussion[] }>(
    `/api/student/discussions?courseId=${encodeURIComponent(course.id)}`
  );
  const previewDiscussions = (discussionsData?.discussions ?? []).slice(0, 3);

  function toggleTopic(id: string) {
    setExpandedTopics((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  // Segmented progress bar: one segment per topic, lit teal when the
  // topic is fully completed.
  const totalTopics = course.topics.length;
  const completedTopics = course.courseCompletion.completedTopics;
  const segmentCount = Math.max(totalTopics, 1);

  return (
    <div className="space-y-5 p-5">
          {/* Course title */}
          <div className="space-y-1.5">
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              {t("courses.courseContent")}
            </p>
            <h2 className="font-heading text-base font-bold leading-snug text-foreground">
              {course.title}
            </h2>
            {course.category && (
              <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 border-border text-muted-foreground">
                {course.category}
              </Badge>
            )}
          </div>

          {/* Progress — segmented teal bar + trophy */}
          <div className="rounded-xl border border-border bg-muted/30 p-3.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <Trophy className="h-4 w-4 text-teal-600" />
                <span className="text-xs font-semibold text-foreground">
                  {completedTopics}/{totalTopics} {t("learning.completed").toUpperCase()}
                </span>
              </div>
              <span className="text-xs font-semibold tabular-nums text-teal-600">
                {course.courseCompletion.percent}%
              </span>
            </div>
            {/* Segmented bar */}
            <div className="mt-2.5 flex gap-1" aria-hidden>
              {Array.from({ length: segmentCount }).map((_, i) => {
                const topic = course.topics[i];
                const lit =
                  topic &&
                  topic.videos.length > 0 &&
                  topic.videos.every((v) => isVideoFullyCompleted(v));
                return (
                  <div
                    key={i}
                    className={cn(
                      "h-1.5 flex-1 rounded-full",
                      lit ? "bg-teal-500" : "bg-muted"
                    )}
                  />
                );
              })}
            </div>
            <p className="mt-2 text-[10px] text-muted-foreground">
              {course.courseCompletion.completedVideos}/{course.courseCompletion.totalVideos} {t("courses.lessons")}
            </p>
          </div>

          {/* Chapter list */}
          <div className="space-y-1.5">
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              {t("common.topics")}
            </p>
            {course.topics.length === 0 ? (
              <p className="text-xs text-muted-foreground p-3 text-center rounded-lg border border-dashed border-border">
                {t("learning.noTopicsPublished")}
              </p>
            ) : (
              <ul className="space-y-1">
                {course.topics.map((topic, topicIdx) => {
                  const completedInTopic = topic.videos.filter(
                    (v) => isVideoFullyCompleted(v)
                  ).length;
                  const isActiveTopic = topic.id === activeTopic?.id;
                  const topicComplete =
                    completedInTopic === topic.videos.length && topic.videos.length > 0;
                  // Locked = previous topic isn't complete yet (unless it's
                  // the first topic, which is always unlocked).
                  const prevTopic = topicIdx > 0 ? course.topics[topicIdx - 1] : null;
                  const isLocked =
                    !!prevTopic &&
                    prevTopic.videos.length > 0 &&
                    !prevTopic.videos.every((v) => isVideoFullyCompleted(v)) &&
                    !topicComplete;
                  const expanded = expandedTopics.has(topic.id);

                  return (
                    <li key={topic.id}>
                      <button
                        onClick={() => !isLocked && toggleTopic(topic.id)}
                        disabled={isLocked}
                        className={cn(
                          "group flex w-full items-center gap-2.5 rounded-lg px-2 py-2 text-start transition-colors",
                          isActiveTopic
                            ? "bg-primary/5 ring-1 ring-primary/15"
                            : "hover:bg-muted/60",
                          isLocked && "cursor-not-allowed opacity-60 hover:bg-transparent"
                        )}
                      >
                        {/* Numbered circle */}
                        <span
                          className={cn(
                            "flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[11px] font-bold transition-colors",
                            topicComplete
                              ? "bg-teal-500 text-white"
                              : isActiveTopic
                                ? "bg-primary text-primary-foreground"
                                : isLocked
                                  ? "bg-muted text-muted-foreground"
                                  : "bg-muted/70 text-foreground"
                          )}
                        >
                          {topicComplete ? (
                            <CheckCircle2 className="h-4 w-4" />
                          ) : isLocked ? (
                            <Lock className="h-3.5 w-3.5" />
                          ) : (
                            String(topicIdx + 1).padStart(2, "0")
                          )}
                        </span>
                        {/* Title + meta */}
                        <span className="min-w-0 flex-1">
                          <span
                            className={cn(
                              "block truncate text-xs font-semibold",
                              topicComplete
                                ? "text-teal-700"
                                : isActiveTopic
                                  ? "text-primary"
                                  : "text-foreground"
                            )}
                          >
                            {topic.title}
                          </span>
                          <span className="block text-[10px] text-muted-foreground">
                            {completedInTopic}/{topic.videos.length} {t("courses.lessons")}
                          </span>
                        </span>
                        {/* Expand chevron */}
                        {!isLocked && topic.videos.length > 0 && (
                          <ChevronDown
                            className={cn(
                              "h-4 w-4 shrink-0 text-muted-foreground transition-transform",
                              expanded && "rotate-180"
                            )}
                          />
                        )}
                      </button>

                      {/* Lessons */}
                      {expanded && !isLocked && topic.videos.length > 0 && (
                        <ul className="ms-4 mt-0.5 space-y-0.5 border-s border-border/70 ps-3">
                          {topic.videos.map((video) => {
                            const isActive = video.id === activeVideoId;
                            const failed = isVideoAssessmentFailed(video);
                            const completed = isVideoFullyCompleted(video);
                            return (
                              <li key={video.id}>
                                <button
                                  onClick={() => onSelectVideo(video.id)}
                                  className={cn(
                                    "group flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-start text-[11px] transition-colors",
                                    isActive
                                      ? "bg-primary/10 text-primary font-semibold"
                                      : "text-foreground hover:bg-muted/60"
                                  )}
                                >
                                  <span className="shrink-0 flex h-4 w-4 items-center justify-center">
                                    {failed ? (
                                      <XCircle className="h-3.5 w-3.5 text-destructive" />
                                    ) : completed ? (
                                      <CheckCircle2 className="h-3.5 w-3.5 text-teal-600" />
                                    ) : isActive ? (
                                      <PlayCircle className="h-3.5 w-3.5 text-primary" />
                                    ) : (
                                      <PlayCircle className="h-3.5 w-3.5 text-muted-foreground/40 group-hover:text-foreground" />
                                    )}
                                  </span>
                                  <span className="min-w-0 flex-1 truncate">{video.title}</span>
                                  {video.hasQuestions && (
                                    <span
                                      className={cn(
                                        "inline-flex shrink-0 items-center gap-0.5 rounded px-1 py-0.5 text-[9px] font-semibold",
                                        video.assessmentPassed === true
                                          ? "bg-teal-50 text-teal-700"
                                          : video.assessmentPassed === false
                                            ? "bg-destructive/10 text-destructive"
                                            : "bg-primary/10 text-primary"
                                      )}
                                    >
                                      <HelpCircle className="h-2.5 w-2.5" />
                                      {video.questionCount}
                                    </span>
                                  )}
                                </button>
                              </li>
                            );
                          })}
                        </ul>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          {/* Discussion preview */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                {t("nav.discussions")}
              </p>
              <button
                onClick={() => navigate(["student", "discussions"])}
                className="text-[10px] font-semibold text-primary hover:underline"
              >
                {t("learning.tab.discussion")} →
              </button>
            </div>
            {previewDiscussions.length === 0 ? (
              <div className="rounded-lg border border-dashed border-border p-3 text-center">
                <MessageSquare className="mx-auto h-4 w-4 text-muted-foreground/60" />
                <p className="mt-1 text-[11px] text-muted-foreground">
                  {t("learning.beFirstToAsk")}
                </p>
              </div>
            ) : (
              <ul className="space-y-2">
                {previewDiscussions.map((d) => {
                  const initials = (d.author?.name || "S")
                    .split(" ")
                    .map((s) => s[0])
                    .slice(0, 2)
                    .join("")
                    .toUpperCase();
                  return (
                    <li
                      key={d.id}
                      className="flex items-start gap-2.5 rounded-lg border border-border/70 bg-muted/20 p-2.5"
                    >
                      <Avatar className="h-7 w-7 shrink-0 ring-1 ring-border">
                        {d.author?.profilePhoto ? (
                          <AvatarImage src={d.author.profilePhoto} alt={d.author?.name || ""} />
                        ) : null}
                        <AvatarFallback className="bg-primary/10 text-[10px] font-semibold text-primary">
                          {initials}
                        </AvatarFallback>
                      </Avatar>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[11px] font-medium text-foreground">
                          {d.title}
                        </p>
                        <p className="text-[10px] text-muted-foreground">
                          {d.author?.name} · {formatDateTime(d.createdAt)}
                        </p>
                      </div>
                      {d.replyCount > 0 && (
                        <span className="flex shrink-0 items-center gap-0.5 rounded-full bg-muted px-1.5 py-0.5 text-[9px] font-semibold text-muted-foreground">
                          <MessageSquare className="h-2.5 w-2.5" />
                          {d.replyCount}
                        </span>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>
  );
}

function LearningRightSidebar({
  course,
  activeTopic,
  activeVideoId,
  onSelectVideo,
}: {
  course: CourseDetail;
  activeTopic: TopicItem | undefined;
  activeVideoId: string | null;
  onSelectVideo: (id: string) => void;
}) {
  return (
    <aside className="learn-right-rail fixed right-0 top-0 z-20 hidden h-screen w-[300px] overflow-y-auto border-l border-border bg-card lg:block">
      <ScrollArea className="h-screen">
        <LearningCurriculumBody
          course={course}
          activeTopic={activeTopic}
          activeVideoId={activeVideoId}
          onSelectVideo={onSelectVideo}
        />
      </ScrollArea>
    </aside>
  );
}

export function StudentLearning({ courseId, onBack }: { courseId: string; onBack: () => void }) {
  const { t } = useI18n();
  const userId = useAppStore((s) => s.user?.id || null);
  const [curriculumOpen, setCurriculumOpen] = useState(false);
  const { data, loading, error, refetch, setData } = useApiFetch<CourseResponse>(
    `/api/student/courses/${courseId}`,
    { freshOnMount: true, revalidateOnFocus: true }
  );

  // Read the hash query for deep-link support. The global Discussions
  // view navigates here with `?tab=discussions&discussion=<id>`; we honour
  // that by defaulting the Materials/Discussions tab to "discussions" and
  // asking the panel to highlight (and scroll to) the matching thread.
  const routeQuery = useAppStore((s) => s.query);
  const highlightDiscussionId = routeQuery.discussion || null;
  const discussionsTabDefault = routeQuery.tab === "discussions";

  // Pick the initial video: most recently watched uncompleted video (via
  // server updatedAt or fresher localStorage timestamp), else next uncompleted
  // video, else most recently watched video, else first video.
  const initialVideoId = (() => {
    if (!data?.course) return null;
    const flatVideos = data.course.topics.flatMap((t) => t.videos);
    if (flatVideos.length === 0) return null;

    const getUpdatedMs = (v: VideoItem) => {
      const serverMs = v.progress?.updatedAt
        ? Date.parse(v.progress.updatedAt) || 0
        : 0;
      const localMs = readLocalVideoProgress(userId, v.id)?.updatedAtMs || 0;
      return Math.max(serverMs, localMs);
    };

    const getLastPos = (v: VideoItem) => {
      const serverMs = v.progress?.updatedAt
        ? Date.parse(v.progress.updatedAt) || 0
        : 0;
      const local = readLocalVideoProgress(userId, v.id);
      if (local && local.updatedAtMs > serverMs) return local.lastPosition;
      return v.progress?.lastPosition || 0;
    };

    // 1) Most recently updated uncompleted video that has progress
    let recentUncompleted: VideoItem | null = null;
    let recentUncompletedMs = -1;
    for (const v of flatVideos) {
      const isComp = isVideoFullyCompleted(v);
      if (isComp) continue;
      const ms = getUpdatedMs(v);
      const pos = getLastPos(v);
      if (ms > 0 || pos > 0) {
        if (ms > recentUncompletedMs) {
          recentUncompletedMs = ms;
          recentUncompleted = v;
        }
      }
    }
    if (recentUncompleted) return recentUncompleted.id;

    // 2) Same-browser last selected video (if valid & uncompleted)
    const localLastId = readLocalLastVideo(userId, courseId);
    if (localLastId) {
      const match = flatVideos.find((v) => v.id === localLastId);
      if (match && !isVideoFullyCompleted(match)) return match.id;
    }

    // 3) First uncompleted video in the course
    const firstUncompleted = flatVideos.find((v) => !isVideoFullyCompleted(v));
    if (firstUncompleted) return firstUncompleted.id;

    // 4) All videos completed — pick most recently watched or first
    if (localLastId && flatVideos.some((v) => v.id === localLastId)) {
      return localLastId;
    }
    let recentAny: VideoItem | null = null;
    let recentAnyMs = -1;
    for (const v of flatVideos) {
      const ms = getUpdatedMs(v);
      if (ms > recentAnyMs) {
        recentAnyMs = ms;
        recentAny = v;
      }
    }
    return recentAny?.id ?? flatVideos[0].id;
  })();

  const [userSelectedVideoId, setUserSelectedVideoId] = useState<string | null>(null);
  // Reset user selection when courseId changes — "adjust state during render"
  // pattern (avoids setState-in-effect warnings).
  const [prevCourseId, setPrevCourseId] = useState(courseId);
  if (courseId !== prevCourseId) {
    setPrevCourseId(courseId);
    setUserSelectedVideoId(null);
  }
  // Latch the auto-picked starting video once data arrives so completing a
  // lesson never unexpectedly yanks the active player to another video.
  if (userSelectedVideoId === null && initialVideoId !== null) {
    setUserSelectedVideoId(initialVideoId);
  }
  const activeVideoId = userSelectedVideoId ?? initialVideoId;

  useEffect(() => {
    if (userId && activeVideoId) {
      writeLocalLastVideo(userId, courseId, activeVideoId);
    }
  }, [userId, courseId, activeVideoId]);

  const dataRef = useRef<CourseResponse | null>(data);
  dataRef.current = data;

  const handleProgressUpdate = useCallback(
    (updated: {
      videoId: string;
      progress: VideoProgressInfo;
      justCompleted: boolean;
    }) => {
      const currentData = dataRef.current;
      if (!currentData) return;

      const existingVideo = currentData.course.topics
        .flatMap((t) => t.videos)
        .find((v) => v.id === updated.videoId);
      const prevProg = existingVideo?.progress;
      const statusChanged =
        Boolean(prevProg?.isCompleted) !== Boolean(updated.progress.isCompleted) ||
        updated.justCompleted ||
        ((!prevProg || prevProg.lastPosition <= 0) && updated.progress.lastPosition > 0);

      // Avoid full course tree re-renders every 3s unless milestone/badge state changed.
      if (statusChanged) {
        const newTopics = currentData.course.topics.map((t) => ({
          ...t,
          videos: t.videos.map((v) =>
            v.id === updated.videoId ? { ...v, progress: updated.progress } : v
          ),
        }));
        const videos = newTopics.flatMap((t) => t.videos);
        const completed = videos.filter((v) => isVideoFullyCompleted(v)).length;
        const total = videos.length;
        const percent = total > 0 ? Math.round((completed / total) * 100) : 100;
        const totalTopics = newTopics.length;
        const completedTopics = newTopics.filter(
          (topic) =>
            topic.videos.length > 0 &&
            topic.videos.every((v) => isVideoFullyCompleted(v))
        ).length;
        const newCourse = {
          ...currentData.course,
          topics: newTopics,
          courseCompletion: {
            totalVideos: total,
            completedVideos: completed,
            completedTopics,
            totalTopics,
            percent,
            allCompleted: total === 0 || completed === total,
          },
        };
        setData({ course: newCourse });
      }

      if (updated.justCompleted) {
        if (!existingVideo?.hasQuestions || existingVideo.assessmentPassed === true) {
          toast({
            title: t("learning.lessonCompletedToast"),
            description: t("learning.greatWorkSaved"),
          });
        }
        // Re-fetch course data so newly unlocked assignment details & fileUrl appear immediately.
        void refetch();
      }
    },
    [setData, refetch, t]
  );

  const handleAssessmentChange = useCallback(
    (payload: { videoId: string; passed: boolean; score: number; attempts: number }) => {
      const currentData = dataRef.current;
      if (!currentData) return;
      const newTopics = currentData.course.topics.map((t) => ({
        ...t,
        videos: t.videos.map((v) =>
          v.id === payload.videoId
            ? {
                ...v,
                assessmentPassed: payload.passed,
                assessmentAttempted: true,
                assessmentScore: payload.score,
                assessmentAttempts: payload.attempts,
              }
            : v
        ),
      }));
      const videos = newTopics.flatMap((t) => t.videos);
      const completed = videos.filter((v) => isVideoFullyCompleted(v)).length;
      const total = videos.length;
      const percent = total > 0 ? Math.round((completed / total) * 100) : 100;
      const completedTopics = newTopics.filter(
        (topic) => topic.videos.length > 0 && topic.videos.every((v) => isVideoFullyCompleted(v))
      ).length;
      setData({
        course: {
          ...currentData.course,
          topics: newTopics,
          courseCompletion: {
            totalVideos: total,
            completedVideos: completed,
            completedTopics,
            totalTopics: newTopics.length,
            percent,
            allCompleted: total === 0 || completed === total,
          },
        },
      });
    },
    [setData]
  );

  if (loading && !data) {
    return (
      <div className="learn-shell min-h-screen bg-muted/30 lg:pl-14 lg:pr-[300px]">
        <LearningLeftSidebar />
        <div className="space-y-5 p-4 sm:p-6 lg:p-8">
          {/* Breadcrumb skeleton */}
          <div className="flex items-center justify-between gap-3">
            <div className="space-y-2">
              <Skeleton className="h-3 w-64 rounded-md" />
              <Skeleton className="h-7 w-96 rounded-md" />
              <Skeleton className="h-3 w-48 rounded-md" />
            </div>
            <Skeleton className="h-8 w-40 rounded-full" />
          </div>
          {/* Video player skeleton */}
          <Skeleton className="h-[420px] rounded-2xl" />
          {/* Tabs skeleton */}
          <Skeleton className="h-10 w-full rounded-md" />
          <Skeleton className="h-32 rounded-xl" />
        </div>
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className="learn-shell min-h-screen bg-muted/30 lg:pl-14">
        <LearningLeftSidebar />
        <div className="space-y-4 p-4 sm:p-6 lg:p-8">
          <Button variant="outline" size="sm" onClick={onBack} className="gap-2">
            <ArrowLeft className="h-4 w-4 rtl-mirror" /> {t("learning.backToCourses")}
          </Button>
          <EmptyState
            icon={<AlertTriangle className="h-5 w-5" />}
            title={t("learning.couldntOpenCourse")}
            description={error}
            action={<Button onClick={onBack}>{t("learning.backToCourses")}</Button>}
          />
        </div>
      </div>
    );
  }

  if (!data?.course) {
    return (
      <div className="learn-shell min-h-screen bg-muted/30 lg:pl-14">
        <LearningLeftSidebar />
        <div className="space-y-4 p-4 sm:p-6 lg:p-8">
          <Button variant="outline" size="sm" onClick={onBack} className="gap-2">
            <ArrowLeft className="h-4 w-4 rtl-mirror" /> {t("learning.backToCourses")}
          </Button>
          <EmptyState
            icon={<PlayCircle className="h-5 w-5" />}
            title={t("learning.courseNotFound")}
            description={t("learning.courseMayRemoved")}
            action={<Button onClick={onBack}>{t("learning.backToCourses")}</Button>}
          />
        </div>
      </div>
    );
  }

  const course = data.course;
  const allVideos = course.topics.flatMap((t) => t.videos);
  const activeVideo =
    allVideos.find((v) => v.id === activeVideoId) || allVideos[0] || null;

  // Find the topic containing the active video
  const activeTopic = course.topics.find((t) =>
    t.videos.some((v) => v.id === activeVideo?.id)
  );

  // Build a flat ordered list for prev/next navigation
  const flatVideoIds = allVideos.map((v) => v.id);
  const activeIndex = activeVideo ? flatVideoIds.indexOf(activeVideo.id) : -1;
  const prevVideo = activeIndex > 0 ? allVideos[activeIndex - 1] : null;
  const nextVideo = activeIndex >= 0 && activeIndex < allVideos.length - 1 ? allVideos[activeIndex + 1] : null;

  async function handleSubmissionSuccess() {
    await refetch();
    toast({
      title: t("learning.assignmentSubmittedToast"),
      description: t("learning.assignmentSubmittedDesc"),
    });
  }

  const courseAssignments: AssignmentEntry[] =
    course.assignments && course.assignments.length > 0
      ? course.assignments
      : course.assignment
        ? [{ ...course.assignment, submission: course.submission }]
        : [];

  return (
    <div className="learn-shell min-h-screen bg-muted/30 animate-fade-in pb-16 lg:pb-8 lg:pl-14 lg:pr-[300px]">
      {/* ─── Narrow left icon-only sidebar ─── */}
      <LearningLeftSidebar />

      {/* ─── Right sidebar — course content + progress + discussions ─── */}
      <LearningRightSidebar
        course={course}
        activeTopic={activeTopic}
        activeVideoId={activeVideo?.id || null}
        onSelectVideo={(id) => setUserSelectedVideoId(id)}
      />

      {/* ─── Mobile/Tablet Curriculum Drawer Sheet ─── */}
      <Sheet open={curriculumOpen} onOpenChange={setCurriculumOpen}>
        <SheetContent side="right" className="w-[310px] sm:max-w-[340px] p-0 overflow-y-auto">
          <SheetHeader className="border-b border-border px-5 py-4 text-start">
            <SheetTitle className="text-sm font-semibold">{t("learning.curriculum")}</SheetTitle>
          </SheetHeader>
          <LearningCurriculumBody
            course={course}
            activeTopic={activeTopic}
            activeVideoId={activeVideo?.id || null}
            onSelectVideo={(id) => {
              setUserSelectedVideoId(id);
              setCurriculumOpen(false);
            }}
          />
        </SheetContent>
      </Sheet>

      {/* ─── Main content area ─── */}
      <main className="space-y-5 p-3 sm:p-6 lg:p-8">
        {/* ─── Header: breadcrumb + large title + chapter nav ─── */}
        <header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
          <div className="min-w-0 flex-1 space-y-1.5">
            {/* Breadcrumb */}
            <nav className="flex items-center gap-1.5 text-[11px] text-muted-foreground min-w-0">
              <button
                onClick={onBack}
                className="flex items-center gap-1 transition-colors hover:text-primary shrink-0 whitespace-nowrap"
              >
                <ArrowLeft className="h-3 w-3 rtl-mirror" />
                {t("learning.myCourses")}
              </button>
              <span className="text-muted-foreground/60">/</span>
              <span className="truncate">{course.title}</span>
              {activeVideo && (
                <>
                  <span className="text-muted-foreground/60">/</span>
                  <span className="truncate font-medium text-foreground">
                    {activeVideo.title}
                  </span>
                </>
              )}
            </nav>

            {/* Large bold lesson title */}
            {activeVideo && (
              <h1 className="font-heading text-xl font-bold tracking-tight text-foreground sm:text-3xl">
                {activeVideo.title}
              </h1>
            )}

            {/* Subtitle — course name + tags */}
            <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
              {activeTopic && (
                <span className="flex items-center gap-1.5">
                  <BookOpen className="h-3.5 w-3.5" />
                  {activeTopic.title}
                </span>
              )}
              {activeTopic && <span className="text-muted-foreground/40">·</span>}
              <button
                onClick={onBack}
                className="truncate transition-colors hover:text-primary"
              >
                {course.title}
              </button>
              {course.category && (
                <>
                  <span className="text-muted-foreground/40">·</span>
                  <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 border-border text-muted-foreground">
                    {course.category}
                  </Badge>
                </>
              )}
              <Badge
                className={
                  course.accessType === "FREE"
                    ? "bg-teal-50 text-teal-700 border-transparent text-[10px] px-1.5 py-0 h-4"
                    : "bg-primary text-primary-foreground border-transparent text-[10px] px-1.5 py-0 h-4"
                }
              >
                {course.accessType === "FREE" ? t("common.free") : t("common.paid")}
              </Badge>
            </div>
          </div>

          {/* Top-right: mobile curriculum sheet trigger, language switcher, chapter prev/next */}
          <div className="flex flex-wrap shrink-0 items-center gap-2 self-start">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurriculumOpen(true)}
              className="lg:hidden h-10 gap-1.5 rounded-full border-border bg-card px-3 text-xs font-medium shadow-sm hover:bg-muted whitespace-nowrap"
            >
              <ListChecks className="h-4 w-4 text-primary" />
              <span>{t("learning.curriculum")}</span>
            </Button>
            <div className="lg:hidden">
              <LanguageSwitcher compact />
            </div>
            {(prevVideo || nextVideo) && (
              <div className="flex items-center gap-2">
                <span className="hidden text-[10px] font-semibold uppercase tracking-[0.15em] text-muted-foreground sm:inline tabular-nums">
                  {t("learning.topic")} {(activeTopic ? course.topics.indexOf(activeTopic) : 0) + 1}/{course.topics.length}
                </span>
                <div className="flex items-center gap-1.5">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => prevVideo && setUserSelectedVideoId(prevVideo.id)}
                    disabled={!prevVideo}
                    className="h-10 sm:h-8 gap-1.5 rounded-full border-border bg-card px-3 text-xs font-medium shadow-sm hover:bg-muted"
                    aria-label={t("learning.prevLesson")}
                  >
                    <ChevronLeft className="h-4 w-4 rtl-mirror" />
                    <span className="hidden sm:inline">Prev</span>
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => nextVideo && setUserSelectedVideoId(nextVideo.id)}
                    disabled={!nextVideo}
                    className="h-10 sm:h-8 gap-1.5 rounded-full bg-primary px-3 text-xs font-medium text-primary-foreground shadow-sm transition-colors hover:bg-primary/90"
                    aria-label={t("learning.nextLesson")}
                  >
                    <span className="hidden sm:inline">Next</span>
                    <ChevronRight className="h-4 w-4 rtl-mirror" />
                  </Button>
                </div>
              </div>
            )}
          </div>
        </header>

        {/* ─── Video player (rounded card with shadow) ─── */}
        {activeVideo ? (
          <VideoPlayer
            key={activeVideo.id}
            video={activeVideo}
            userId={userId}
            topicTitle={activeTopic?.title || null}
            courseId={course.id}
            topicId={activeTopic?.id || null}
            onProgress={handleProgressUpdate}
            onAssessmentChange={handleAssessmentChange}
            refetchCourse={refetch}
          />
        ) : (
          <EmptyState
            icon={<VideoIcon className="h-5 w-5" />}
            title={t("courses.noVideosYet")}
            description={t("courses.noVideosDesc")}
          />
        )}

        {/* ─── 4-Tab Interface below video ─── */}
        <Tabs defaultValue="overview" className="gap-0">
          <div className="border-b border-border overflow-x-auto scrollbar-thin">
            <TabsList className="bg-transparent border-0 p-0 h-auto gap-0 flex-nowrap">
              <TabsTrigger
                value="overview"
                className="tab-underline rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:text-primary gap-1.5 px-4 py-2.5 text-sm font-medium transition-all"
              >
                <Info className="h-3.5 w-3.5" />
                {t("learning.tab.overview")}
              </TabsTrigger>
              <TabsTrigger
                value="notes"
                className="tab-underline rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:text-primary gap-1.5 px-4 py-2.5 text-sm font-medium transition-all"
              >
                <StickyNote className="h-3.5 w-3.5" />
                {t("learning.tab.notes")}
              </TabsTrigger>
              <TabsTrigger
                value="discussions"
                className="tab-underline rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:text-primary gap-1.5 px-4 py-2.5 text-sm font-medium transition-all"
              >
                <MessageSquare className="h-3.5 w-3.5" />
                {t("learning.tab.discussion")}
              </TabsTrigger>
              <TabsTrigger
                value="resources"
                className="tab-underline rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:text-primary gap-1.5 px-4 py-2.5 text-sm font-medium transition-all"
              >
                <FileText className="h-3.5 w-3.5" />
                {t("learning.tab.resources")}
                {(course.materials.length > 0 || (activeTopic && activeTopic.materials.length > 0)) && (
                  <Badge variant="outline" className="ml-0.5 text-[10px] px-1.5 py-0 h-4 border-border text-muted-foreground">
                    {course.materials.length + (activeTopic?.materials.length || 0)}
                  </Badge>
                )}
              </TabsTrigger>
            </TabsList>
          </div>

          {/* Tab 1: Overview */}
          <TabsContent value="overview" className="mt-0 p-4">
            <div className="space-y-3">
              {activeVideo && (
                <>
                  <div>
                    <h3 className="font-heading text-base font-semibold text-foreground">
                      {activeVideo.title}
                    </h3>
                    {activeTopic && (
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {t("learning.topic")} {activeTopic.title}
                      </p>
                    )}
                  </div>
                  {activeVideo.description && (
                    <p className="text-sm text-muted-foreground leading-relaxed">
                      {activeVideo.description}
                    </p>
                  )}
                  <div className="flex items-center gap-3 pt-2 border-t border-border">
                    {isVideoAssessmentFailed(activeVideo) ? (
                      <Badge className="bg-destructive/15 text-destructive border-transparent gap-1">
                        <XCircle className="h-3 w-3" /> Failed
                      </Badge>
                    ) : isVideoFullyCompleted(activeVideo) ? (
                      <Badge className="bg-teal-50 text-teal-700 border-transparent gap-1">
                        <CheckCircle2 className="h-3 w-3" /> {t("common.completed")}
                      </Badge>
                    ) : activeVideo.progress?.isCompleted && activeVideo.hasQuestions ? (
                      <Badge className="bg-warning/15 text-warning border-transparent gap-1">
                        <AlertTriangle className="h-3 w-3" /> Assessment Pending
                      </Badge>
                    ) : activeVideo.progress?.lastPosition ? (
                      <Badge className="bg-warning/15 text-warning border-transparent gap-1">
                        <Clock className="h-3 w-3" /> {t("common.inProgress")}
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-muted-foreground gap-1">
                        <PlayCircle className="h-3 w-3" /> {t("common.notStarted")}
                      </Badge>
                    )}
                    {activeVideo.duration > 0 && (
                      <span className="text-xs text-muted-foreground">
                        {t("common.duration")}: {formatVideoDuration(activeVideo.duration)}
                      </span>
                    )}
                  </div>
                </>
              )}
            </div>
          </TabsContent>

          {/* Tab 2: My Notes */}
          <TabsContent value="notes" className="mt-0 p-4">
            {activeVideo && (
              <VideoNotesPanel
                videoId={activeVideo.id}
                courseId={course.id}
                topicId={activeTopic?.id || null}
                videoTitle={activeVideo.title}
                canCaptureTimestamp={false}
                getCurrentTime={() => 0}
                seekTo={() => {}}
              />
            )}
          </TabsContent>

          {/* Tab 3: Discussion */}
          <TabsContent value="discussions" className="mt-0">
            <CourseDiscussionsPanel
              courseId={course.id}
              highlightDiscussionId={highlightDiscussionId}
            />
          </TabsContent>

          {/* Tab 4: Resources */}
          <TabsContent value="resources" className="mt-0 p-4">
            <div className="space-y-3">
              {activeTopic && activeTopic.materials.length > 0 && (
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                    {t("learning.topicMaterialsLabel")} · {activeTopic.title}
                  </p>
                  <ul className="space-y-2">
                    {activeTopic.materials.map((m) => (
                      <MaterialRow key={m.id} material={m} />
                    ))}
                  </ul>
                </div>
              )}
              {course.materials.length > 0 && (
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                    {t("learning.courseMaterials")}
                  </p>
                  <ul className="space-y-2">
                    {course.materials.map((m) => (
                      <MaterialRow key={m.id} material={m} />
                    ))}
                  </ul>
                </div>
              )}
              {course.materials.length === 0 && (!activeTopic || activeTopic.materials.length === 0) && (
                <div className="flex flex-col items-center justify-center py-8 text-center">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted text-muted-foreground mb-2">
                    <FileText className="h-5 w-5" />
                  </div>
                  <p className="text-sm font-medium text-foreground">{t("learning.noResources")}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {t("learning.noResourcesDesc")}
                  </p>
                </div>
              )}
            </div>
          </TabsContent>
        </Tabs>

        {/* ─── Assignments section — hidden until all videos completed ─── */}
        {courseAssignments.length > 0 && course.courseCompletion.allCompleted ? (
          <AssignmentsSection
            course={course}
            assignments={courseAssignments}
            onSubmitted={handleSubmissionSuccess}
          />
        ) : courseAssignments.length > 0 ? (
          <LockedAssignmentCard
            completedVideos={course.courseCompletion.completedVideos}
            totalVideos={course.courseCompletion.totalVideos}
            percent={course.courseCompletion.percent}
            assignmentCount={courseAssignments.length}
          />
        ) : null}
      </main>
    </div>
  );
}

/* ===================== Video player ===================== */

function VideoPlayer({
  video,
  userId,
  topicTitle,
  courseId,
  topicId,
  onProgress,
  onAssessmentChange,
  refetchCourse,
}: {
  video: VideoItem;
  userId: string | null;
  topicTitle: string | null;
  courseId: string;
  topicId: string | null;
  onProgress: (update: {
    videoId: string;
    progress: VideoProgressInfo;
    justCompleted: boolean;
  }) => void;
  onAssessmentChange?: (payload: {
    videoId: string;
    passed: boolean;
    score: number;
    attempts: number;
  }) => void;
  refetchCourse?: () => void;
}) {
  // Resolve initial resume snapshot: compare server progress vs same-user localStorage
  // (handles immediate refresh/tab close before keepalive network request finishes).
  const initialSnapshot = useMemo(() => {
    const serverUpdatedMs = video.progress?.updatedAt
      ? Date.parse(video.progress.updatedAt) || 0
      : 0;
    const local = readLocalVideoProgress(userId, video.id);
    const useLocal = Boolean(local && local.updatedAtMs > serverUpdatedMs);

    const rawPos = useLocal
      ? local!.lastPosition
      : video.progress?.lastPosition || 0;
    const knownDur = Math.max(
      video.duration || 0,
      video.progress?.duration || 0,
      useLocal ? local!.duration : 0
    );
    const watchTime = Math.max(
      video.progress?.watchTimeSeconds || 0,
      useLocal ? local!.watchTimeSeconds : 0
    );
    // If the video was already completed at its end, start from 0 on rewatch;
    // otherwise resume right where the student stopped.
    const resumePos =
      video.progress?.isCompleted && knownDur > 3 && rawPos >= knownDur - 3
        ? 0
        : rawPos;

    return {
      resumePos,
      watchTime,
      duration: knownDur,
      localWasNewer: useLocal && rawPos > 0,
    };
    // Only compute once on mount per video.id (VideoPlayer is keyed by video.id)
  }, [video.id]);

  const videoRef = useRef<HTMLVideoElement>(null);
  const lastTimeRef = useRef<number>(initialSnapshot.resumePos);
  const livePosRef = useRef<number>(initialSnapshot.resumePos);
  const resumeTargetRef = useRef<number>(initialSnapshot.resumePos);
  const watchTimeRef = useRef<number>(initialSnapshot.watchTime);
  const durationRef = useRef<number>(initialSnapshot.duration);
  const lastPostRef = useRef<number>(0);
  const lastLocalSaveRef = useRef<number>(0);
  const resumeAppliedRef = useRef<boolean>(initialSnapshot.resumePos <= 0);
  const hasPlayedOrSeekedRef = useRef<boolean>(false);
  const html5InitKeyRef = useRef<string | null>(null);
  const isScrubbingRef = useRef<boolean>(false);
  const seekLockUntilRef = useRef<number>(0);
  const lastTickWallMsRef = useRef<number>(0);
  const stageOuterRef = useRef<HTMLDivElement>(null);
  const savedStageHeightRef = useRef<number>(0);
  const [expanded, setExpanded] = useState(false);
  const [nativeFullscreenEl, setNativeFullscreenEl] = useState<Element | null>(null);
  const [playerStatus, setPlayerStatus] = useState<
    "idle" | "playing" | "paused" | "buffering" | "ended"
  >("idle");
  const [showBufferingSpinner, setShowBufferingSpinner] = useState(false);
  const [uiTime, setUiTime] = useState<number>(initialSnapshot.resumePos);
  const [uiDuration, setUiDuration] = useState<number>(initialSnapshot.duration);
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [volume, setVolume] = useState<number>(100);
  const [playbackRate, setPlaybackRate] = useState<number>(1);
  const audioPrefsRef = useRef({ muted: false, volume: 100, rate: 1 });
  audioPrefsRef.current = { muted: isMuted, volume, rate: playbackRate };

  // Only reveal buffering spinner if buffering persists > 550ms so brief
  // quality switches / seeks don't flash a loading overlay over the video.
  useEffect(() => {
    if (playerStatus !== "buffering") {
      setShowBufferingSpinner(false);
      return;
    }
    const timer = setTimeout(() => setShowBufferingSpinner(true), 550);
    return () => clearTimeout(timer);
  }, [playerStatus]);

  // ─── Video Assessment state ───
  // Fetches the questions for THIS video (without correctAnswer — security).
  // The hook is unconditional (rules of hooks); the URL just changes per video.
  const questionsUrl = `/api/student/videos/${video.id}/questions`;
  const {
    data: questionsData,
    loading: questionsLoading,
    refetch: refetchQuestions,
  } = useApiFetch<{
    questions: VideoQuestionData[];
    assessment: VideoAssessmentSummary | null;
  }>(questionsUrl);

  // Currently-displayed question popup (null = no popup shown).
  const [activeQuestion, setActiveQuestion] = useState<VideoQuestionData | null>(null);
  // Map of questionId → selected option index (answers given this session).
  const [answeredMap, setAnsweredMap] = useState<Map<string, number>>(new Map());
  // Currently-selected option in the active popup (null = nothing selected yet).
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
  // Result returned from POST /assessment — when set, the result overlay shows at video end.
  const [assessmentResult, setAssessmentResult] = useState<AssessmentResult | null>(null);
  // True while the assessment POST is in flight.
  const [submittingAssessment, setSubmittingAssessment] = useState(false);
  // Tracks whether the video has reached the end (`ended` event) in this session.
  const videoEndedRef = useRef<boolean>(false);

  // ─── Player abstraction + YouTube IFrame player ───
  const playerApiRef = useRef<PlayerApi | null>(null);
  const ytPlayerRef = useRef<any>(null);
  const ytPollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const ytContainerRef = useRef<HTMLDivElement | null>(null);

  // Local UI state
  const [localCompleted, setLocalCompleted] = useState<boolean>(
    video.progress?.isCompleted || false
  );
  const [posting, setPosting] = useState(false);

  // Question popups are active on EVERY watch (even after passing previously)
  // so in-video questions pop up whenever the student watches, replays, or rewinds.
  const questionsActive = Boolean(questionsData && questionsData.questions.length > 0);

  const getEffectivePosition = useCallback(() => {
    // Before playback or explicit user seek has occurred, never let an unstarted
    // player reporting 0 overwrite the saved resume target.
    if (!hasPlayedOrSeekedRef.current && resumeTargetRef.current > 0) {
      return Math.max(0, resumeTargetRef.current);
    }
    const apiPos = playerApiRef.current?.currentTime();
    if (
      typeof apiPos === "number" &&
      Number.isFinite(apiPos) &&
      (resumeAppliedRef.current || apiPos > 0)
    ) {
      return Math.max(0, apiPos);
    }
    const elPos = videoRef.current?.currentTime;
    if (
      typeof elPos === "number" &&
      Number.isFinite(elPos) &&
      (resumeAppliedRef.current || elPos > 0)
    ) {
      return Math.max(0, elPos);
    }
    return Math.max(0, livePosRef.current);
  }, []);

  const persistLocalSnapshot = useCallback(
    (posOverride?: number) => {
      const pos =
        typeof posOverride === "number" && Number.isFinite(posOverride)
          ? Math.max(0, posOverride)
          : getEffectivePosition();
      if (!resumeAppliedRef.current && pos === 0 && resumeTargetRef.current > 0) {
        return;
      }
      livePosRef.current = pos;
      writeLocalVideoProgress(userId, video.id, {
        lastPosition: pos,
        watchTimeSeconds: watchTimeRef.current,
        duration: Number.isFinite(durationRef.current) ? durationRef.current : 0,
        updatedAtMs: Date.now(),
      });
      if (userId) {
        writeLocalLastVideo(userId, courseId, video.id);
      }
    },
    [userId, courseId, video.id, getEffectivePosition]
  );

  // Keep completion badge in sync without tearing down active playback
  useEffect(() => {
    if (video.progress?.isCompleted) {
      setLocalCompleted(true);
    }
  }, [video.progress?.isCompleted]);

  // Keepalive flush used on tab hide, page refresh, browser/device close, logout, or unmount
  const flushKeepalive = useCallback(
    (forcePosition = false, markStale = false): Promise<void> => {
      const pos = getEffectivePosition();
      if (!resumeAppliedRef.current && pos === 0 && resumeTargetRef.current > 0) {
        return Promise.resolve();
      }
      // Don't overwrite saved progress with empty 0s write if user hasn't played/seeked yet
      if (!hasPlayedOrSeekedRef.current && pos <= 0 && watchTimeRef.current <= 0) {
        return Promise.resolve();
      }
      if (!hasPlayedOrSeekedRef.current && !initialSnapshot.localWasNewer) {
        return Promise.resolve();
      }
      persistLocalSnapshot(pos);
      if (markStale) {
        markApiCacheUrlStale(`/api/student/courses/${courseId}`);
        markApiCacheUrlStale("/api/student/overview");
        markApiCacheUrlStale("/api/student/recent-activity");
      }
      try {
        return fetch("/api/student/progress", {
          method: "POST",
          headers: withAuthHeaders({ "Content-Type": "application/json" }),
          body: JSON.stringify({
            videoId: video.id,
            lastPosition: pos,
            watchTimeSeconds: watchTimeRef.current,
            duration: Number.isFinite(durationRef.current)
              ? durationRef.current
              : 0,
            isCompleted: false,
            forcePosition: forcePosition || hasPlayedOrSeekedRef.current || resumeAppliedRef.current,
          }),
          credentials: "include",
          keepalive: true,
        })
          .then(() => undefined)
          .catch(() => undefined);
      } catch {
        return Promise.resolve();
      }
    },
    [video.id, courseId, initialSnapshot.localWasNewer, getEffectivePosition, persistLocalSnapshot]
  );

  const flushKeepaliveRef = useRef(flushKeepalive);
  flushKeepaliveRef.current = flushKeepalive;

  // Sync fresher localStorage snapshot to server if an abrupt reload outraced keepalive
  useEffect(() => {
    if (initialSnapshot.localWasNewer) {
      void flushKeepaliveRef.current(true, false);
    }
  }, [video.id, initialSnapshot.localWasNewer]);

  // Flush playback position when hiding tab/app, refreshing, logging out, closing device, or unmounting
  useEffect(() => {
    const onVisibilityChange = () => {
      if (document.visibilityState === "hidden") {
        void flushKeepaliveRef.current(true, true);
      }
    };
    const onPageHide = () => {
      void flushKeepaliveRef.current(true, true);
    };
    const onBeforeUnload = () => {
      void flushKeepaliveRef.current(true, true);
    };
    const beforeLogout = () => flushKeepaliveRef.current(true, true);

    registerBeforeLogoutFlush(beforeLogout);
    document.addEventListener("visibilitychange", onVisibilityChange);
    window.addEventListener("pagehide", onPageHide);
    window.addEventListener("beforeunload", onBeforeUnload);

    return () => {
      registerBeforeLogoutFlush(null);
      document.removeEventListener("visibilitychange", onVisibilityChange);
      window.removeEventListener("pagehide", onPageHide);
      window.removeEventListener("beforeunload", onBeforeUnload);
      void flushKeepaliveRef.current(true, true);
    };
  }, [video.id]);

  // Lock background page scroll + handle Escape key while expanded view is open
  useEffect(() => {
    if (!expanded || typeof document === "undefined") return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !activeQuestion && !assessmentResult) {
        setExpanded(false);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [expanded, activeQuestion, assessmentResult]);

  // Sync native browser fullscreen changes so overlays portal inside fullscreenElement
  useEffect(() => {
    if (typeof document === "undefined") return;
    const syncFullscreen = () => {
      const fsEl =
        document.fullscreenElement ||
        (document as any).webkitFullscreenElement ||
        null;
      setNativeFullscreenEl(fsEl);
    };
    document.addEventListener("fullscreenchange", syncFullscreen);
    document.addEventListener("webkitfullscreenchange", syncFullscreen);
    return () => {
      document.removeEventListener("fullscreenchange", syncFullscreen);
      document.removeEventListener("webkitfullscreenchange", syncFullscreen);
    };
  }, []);

  // If browser enters native fullscreen directly on the raw <video> element (which cannot
  // host DOM overlays), exit native <video> fullscreen and switch to our expanded view
  // whenever a question or assessment result needs to be displayed.
  useEffect(() => {
    if (!activeQuestion && !assessmentResult) return;
    const videoEl = videoRef.current as any;
    const fsEl =
      typeof document !== "undefined"
        ? document.fullscreenElement || (document as any).webkitFullscreenElement
        : null;
    if (fsEl && videoEl && fsEl === videoEl) {
      try {
        void document.exitFullscreen?.();
      } catch {}
      setExpanded(true);
    } else if (videoEl?.webkitDisplayingFullscreen) {
      try {
        videoEl.webkitExitFullscreen?.();
      } catch {}
      setExpanded(true);
    }
  }, [activeQuestion, assessmentResult]);

  // ─── Missed-question catch-up ───
  // Fires when questions data arrives, when playback resumes, when toggling
  // compact <-> expanded, or when a question is answered. If the playhead has
  // moved past an unanswered question's timestamp, pause and surface it now.
  useEffect(() => {
    if (!questionsActive || !questionsData) return;
    if (activeQuestion || assessmentResult || submittingAssessment) return;
    if (playerStatus !== "playing") return;

    const checkMissed = () => {
      const api = playerApiRef.current;
      if (!api || api.paused()) return;
      const cur = api.currentTime();
      const missed = questionsData.questions.find(
        (q) => !answeredMap.has(q.id) && cur >= q.timestamp - 0.5
      );
      if (missed) {
        try {
          api.pause();
          lastTimeRef.current = api.currentTime();
        } catch {}
        setActiveQuestion(missed);
        setSelectedAnswer(null);
      }
    };

    const remainingLockMs = seekLockUntilRef.current - Date.now();
    if (remainingLockMs > 0) {
      const timer = setTimeout(checkMissed, remainingLockMs + 50);
      return () => clearTimeout(timer);
    }

    checkMissed();
  }, [
    questionsActive,
    questionsData,
    activeQuestion,
    assessmentResult,
    submittingAssessment,
    answeredMap,
    playerStatus,
    expanded,
    nativeFullscreenEl,
  ]);

  // For HTML5 video: apply resume position once metadata is ready (guarded per mount key
  // so subsequent buffering/canplay events never re-seek or re-apply playback prefs).
  const applyHtml5PlayerReady = () => {
    const el = videoRef.current;
    if (!el) return;

    if (Number.isFinite(el.duration) && el.duration > 0) {
      durationRef.current = el.duration;
      setUiDuration((prev) => (Math.abs(prev - el.duration) > 0.5 ? el.duration : prev));
    }

    const initKey = video.id;
    if (html5InitKeyRef.current === initKey && playerApiRef.current) {
      return;
    }
    html5InitKeyRef.current = initKey;

    // Wire up the shared player abstraction for HTML5 video.
    playerApiRef.current = {
      currentTime: () => el.currentTime,
      duration: () => el.duration,
      pause: () => { el.pause(); },
      play: () => { void el.play().catch(() => {}); },
      seekTo: (t) => { el.currentTime = t; },
      paused: () => el.paused,
      setMuted: (m) => { el.muted = m; },
      setVolume: (v) => { el.volume = Math.max(0, Math.min(1, v / 100)); },
      setPlaybackRate: (r) => { el.playbackRate = r; },
    };
    const prefs = audioPrefsRef.current;
    el.muted = prefs.muted;
    el.volume = Math.max(0, Math.min(1, prefs.volume / 100));
    el.playbackRate = prefs.rate;

    const targetRaw = resumeTargetRef.current;
    if (!resumeAppliedRef.current && targetRaw > 0) {
      const dur =
        Number.isFinite(el.duration) && el.duration > 0
          ? el.duration
          : durationRef.current;
      const target = dur > 3 ? Math.min(targetRaw, dur - 2) : targetRaw;
      try {
        if (Math.abs(el.currentTime - target) > 1.2) {
          el.currentTime = target;
        }
      } catch {}
      lastTimeRef.current = target;
      livePosRef.current = target;
      setUiTime(target);
      resumeAppliedRef.current = true;
    } else if (targetRaw <= 0) {
      resumeAppliedRef.current = true;
    }
  };

  // Core: timeupdate handler — accumulate real watch time.
  const handleTimeUpdate = () => {
    const api = playerApiRef.current;
    if (!api) return;
    const cur = api.currentTime();
    const last = lastTimeRef.current;

    // ─── Question trigger check ───
    // Pause and surface a popup the moment the playhead crosses an unanswered
    // question's timestamp going forward. We require BOTH:
    //   - cur >= q.timestamp    (we're at or past it)
    //   - last < q.timestamp    (we were before it on the previous tick — i.e.
    //                            this is a forward crossing, not a re-tick while
    //                            paused, and not a backward seek landing past it)
    if (
      questionsActive &&
      !activeQuestion &&
      !assessmentResult &&
      !submittingAssessment &&
      questionsData
    ) {
      for (const q of questionsData.questions) {
        if (answeredMap.has(q.id)) continue;
        const crossed =
          cur >= q.timestamp &&
          (last < q.timestamp ||
            (q.timestamp === 0 && last === 0 && cur > 0) ||
            (cur - last <= 2 && Math.abs(cur - q.timestamp) <= 1.5));
        if (crossed) {
          try {
            api.pause();
            lastTimeRef.current = cur;
            livePosRef.current = cur;
          } catch {}
          setActiveQuestion(q);
          setSelectedAnswer(null);
          return; // do NOT accumulate watch time for this tick
        }
      }
    }

    const apiDur = api.duration();
    if (Number.isFinite(apiDur) && apiDur > 0) {
      durationRef.current = apiDur;
      setUiDuration((prev) => (Math.abs(prev - apiDur) > 0.5 ? apiDur : prev));
    }

    if (!isScrubbingRef.current && Date.now() >= seekLockUntilRef.current) {
      setUiTime(cur);
    }

    // Watch time tracking — only counts normal forward playback deltas
    // (scaled smoothly for 1.25x-2x speeds and browser timer jitter).
    const nowMs = Date.now();
    const wallElapsedSec =
      lastTickWallMsRef.current > 0
        ? Math.max(0.25, (nowMs - lastTickWallMsRef.current) / 1000)
        : 1.0;
    lastTickWallMsRef.current = nowMs;
    const maxPlaybackDelta = Math.max(
      2.5,
      wallElapsedSec * (audioPrefsRef.current.rate || 1) + 1.25
    );

    const delta = cur - last;
    if (delta > 0 && delta <= maxPlaybackDelta) {
      watchTimeRef.current += delta;
    }
    // Update lastTime & livePos to current — even on seek, so next delta is small.
    lastTimeRef.current = cur;
    if (resumeAppliedRef.current || cur > 0) {
      livePosRef.current = cur;
      if (cur > 0 || resumeTargetRef.current <= 0) {
        hasPlayedOrSeekedRef.current = true;
      }
    }
    if (durationRef.current > 0 && cur < durationRef.current - 2) {
      videoEndedRef.current = false;
    }

    // Forward-seek past an unanswered question (YouTube doesn't fire seeked).
    if (
      delta > maxPlaybackDelta &&
      questionsActive &&
      !activeQuestion &&
      !assessmentResult &&
      !submittingAssessment &&
      questionsData
    ) {
      const skipped = questionsData.questions.find(
        (q) => !answeredMap.has(q.id) && cur >= q.timestamp - 0.25
      );
      if (skipped) {
        try { api.pause(); } catch {}
        setActiveQuestion(skipped);
        setSelectedAnswer(null);
        return;
      }
    }

    const now = Date.now();
    // Save locally every 1s for instant reload safety
    if (now - lastLocalSaveRef.current > 1000) {
      lastLocalSaveRef.current = now;
      persistLocalSnapshot(cur);
    }

    // Throttled server POST every 3 seconds
    if (now - lastPostRef.current > 3000) {
      lastPostRef.current = now;
      void postProgress(false);
    }
  };

  // Seeked handler (used by HTML5 onSeeked + custom slider/skip controls for YouTube & HTML5)
  const applySeekUpdate = (targetOverride?: number) => {
    const api = playerApiRef.current;
    if (!api && typeof targetOverride !== "number") return;
    const prevTime = lastTimeRef.current;
    const newTime =
      typeof targetOverride === "number" ? Math.max(0, targetOverride) : api!.currentTime();
    lastTimeRef.current = newTime;
    livePosRef.current = newTime;
    resumeAppliedRef.current = true;
    hasPlayedOrSeekedRef.current = true;
    setUiTime(newTime);
    if (durationRef.current > 0 && newTime < durationRef.current - 2) {
      videoEndedRef.current = false;
    }

    // If the user seeks backward before an answered question's timestamp, clear
    // its answered state so that question pops up again when rewatching that section.
    let nextAnsweredMap = answeredMap;
    if (newTime < prevTime - 0.5 && questionsData && answeredMap.size > 0) {
      const pruned = new Map<string, number>();
      let changed = false;
      for (const q of questionsData.questions) {
        if (!answeredMap.has(q.id)) continue;
        if (q.timestamp > newTime + 0.5) {
          changed = true;
        } else {
          pruned.set(q.id, answeredMap.get(q.id)!);
        }
      }
      if (changed) {
        nextAnsweredMap = pruned;
        setAnsweredMap(pruned);
      }
      if (assessmentResult) {
        setAssessmentResult(null);
      }
    }

    persistLocalSnapshot(newTime);
    lastPostRef.current = Date.now();
    void postProgress(false, true);

    if (
      questionsActive &&
      !activeQuestion &&
      !assessmentResult &&
      !submittingAssessment &&
      questionsData
    ) {
      // Find the earliest unanswered question we've now skipped past.
      const skipped = questionsData.questions.find(
        (q) => !nextAnsweredMap.has(q.id) && newTime > q.timestamp + 0.5
      );
      if (skipped) {
        try {
          api?.pause();
        } catch {}
        setActiveQuestion(skipped);
        setSelectedAnswer(null);
      }
    }
  };

  const handleSeeked = () => {
    applySeekUpdate();
  };

  const handlePause = () => {
    const pos = getEffectivePosition();
    if (!resumeAppliedRef.current && pos === 0 && resumeTargetRef.current > 0) {
      return;
    }
    livePosRef.current = pos;
    lastTimeRef.current = pos;
    setUiTime(pos);
    persistLocalSnapshot(pos);
    lastPostRef.current = Date.now();
    void postProgress(false, true);
  };

  // Ended event — record video completion first; ONLY if completion is
  // recorded do we evaluate and announce the Pass/Fail assessment result.
  const handleEnded = async () => {
    videoEndedRef.current = true;
    const api = playerApiRef.current;
    if (api) {
      const dur = api.duration();
      if (Number.isFinite(dur) && dur > 0) {
        durationRef.current = dur;
      }
      const endPos = dur > 0 ? dur : api.currentTime();
      const tailDelta = endPos - lastTimeRef.current;
      if (tailDelta > 0 && tailDelta <= 2) {
        watchTimeRef.current += tailDelta;
        lastTimeRef.current = endPos;
      }
      livePosRef.current = endPos;
    }
    persistLocalSnapshot(livePosRef.current);

    const completionRecorded = await postProgress(true, true);
    if (!completionRecorded) {
      videoEndedRef.current = false;
      return;
    }

    if (
      questionsActive &&
      questionsData &&
      questionsData.questions.length > 0 &&
      !assessmentResult
    ) {
      const unanswered = questionsData.questions.find((q) => !answeredMap.has(q.id));
      if (unanswered) {
        setActiveQuestion(unanswered);
        setSelectedAnswer(null);
        return;
      }
      await submitAssessment(answeredMap);
    }

    refetchCourse?.();
  };

  const onProgressRef = useRef(onProgress);
  onProgressRef.current = onProgress;

  const postProgress = useCallback(
    async (isCompletionHint: boolean, forcePosition = false): Promise<boolean> => {
      const pos =
        isCompletionHint && Number.isFinite(durationRef.current) && durationRef.current > 0
          ? durationRef.current
          : getEffectivePosition();
      if (!resumeAppliedRef.current && pos === 0 && resumeTargetRef.current > 0 && !isCompletionHint) {
        return false;
      }
      if (isCompletionHint) {
        setPosting(true);
      }
      try {
        const res = await apiPost<{
          progress: VideoProgressInfo;
          justCompleted: boolean;
          rejectedCompletion: boolean;
          certificateIssued: boolean;
          certificateId: string | null;
        }>(
          "/api/student/progress",
          {
            videoId: video.id,
            lastPosition: pos,
            watchTimeSeconds: watchTimeRef.current,
            duration: Number.isFinite(durationRef.current) ? durationRef.current : 0,
            isCompleted: isCompletionHint,
            ended: isCompletionHint,
            forcePosition: forcePosition || hasPlayedOrSeekedRef.current || resumeAppliedRef.current,
          },
          // Never invalidate unrelated caches (notes/discussions/questions) on routine heartbeats
          { skipCacheInvalidation: !isCompletionHint }
        );
        if (res.progress.isCompleted) {
          setLocalCompleted(true);
        }
        onProgressRef.current({
          videoId: video.id,
          progress: res.progress,
          justCompleted: res.justCompleted,
        });
        if (res.justCompleted || forcePosition) {
          markApiCacheUrlStale(`/api/student/courses/${courseId}`);
          markApiCacheUrlStale("/api/student/overview");
          markApiCacheUrlStale("/api/student/recent-activity");
        }
        if (isCompletionHint && res.rejectedCompletion) {
          toast({
            title: "Completion not recorded",
            description:
              "You need to watch at least 85% of the video before it's marked complete.",
            variant: "destructive",
          });
        }
        // ─── Certificate auto-issued upon course completion ───
        if (res.certificateIssued && res.certificateId) {
          markApiCacheUrlStale("/api/student/certificates");
          markApiCacheUrlStale("/api/student/overview");
          setTimeout(() => refetchCourse?.(), 300);
          toast({
            title: "🎉 Certificate Issued!",
            description:
              "Congratulations! You've completed the course and your certificate has been automatically generated. View it in My Certificates.",
          });
        }
        return Boolean(res.progress.isCompleted);
      } catch {
        // apiPost already surfaces errors
        return false;
      } finally {
        if (isCompletionHint) {
          setPosting(false);
        }
      }
    },
    [video.id, courseId, getEffectivePosition]
  );

  /* ──────────────────────────────────────────────────────────────
     Video Assessment — submit, retake, dismiss handlers
     ────────────────────────────────────────────────────────────── */

  // Submit the collected answers to the server once completion is recorded.
  // The server evaluates correctness and returns score + Pass/Fail status.
  const submitAssessment = useCallback(
    async (answersMap: Map<string, number>) => {
      if (!questionsData || submittingAssessment) return;
      setSubmittingAssessment(true);
      try {
        const answers = questionsData.questions.map((q) => ({
          questionId: q.id,
          selectedAnswer: answersMap.get(q.id) ?? -1,
        }));
        const res = await apiPost<{
          assessment: AssessmentResult;
          certificateIssued?: boolean;
          certificateId?: string | null;
        }>(
          `/api/student/videos/${video.id}/assessment`,
          { answers }
        );
        setAssessmentResult(res.assessment);
        onAssessmentChange?.({
          videoId: video.id,
          passed: Boolean(res.assessment.passed),
          score: res.assessment.score,
          attempts: res.assessment.attempts,
        });
        if (res.certificateIssued && res.certificateId) {
          markApiCacheUrlStale("/api/student/certificates");
          markApiCacheUrlStale("/api/student/overview");
          toast({
            title: "🎉 Certificate Issued!",
            description:
              "Congratulations! You've completed the course and your certificate has been automatically generated. View it in My Certificates.",
          });
        }
        markApiCacheUrlStale(`/api/student/courses/${courseId}`);
        markApiCacheUrlStale("/api/student/overview");
        markApiCacheUrlStale("/api/student/recent-activity");
        refetchQuestions();
        refetchCourse?.();
      } catch {
        // apiPost surfaces the error toast
      } finally {
        setSubmittingAssessment(false);
      }
    },
    [questionsData, submittingAssessment, video.id, courseId, onAssessmentChange, refetchQuestions, refetchCourse]
  );

  // Submit the selected answer for the active question immediately (no extra
  // confirmation step). During the video, playback resumes right away — the
  // Pass/Fail result is deferred until completion is recorded at the end.
  const handleSubmitAnswer = useCallback(async () => {
    if (!activeQuestion || selectedAnswer === null) return;
    const qid = activeQuestion.id;
    const newMap = new Map(answeredMap);
    newMap.set(qid, selectedAnswer);
    setAnsweredMap(newMap);
    setActiveQuestion(null);
    setSelectedAnswer(null);

    const api = playerApiRef.current;

    if (videoEndedRef.current) {
      if (questionsData) {
        const nextRemaining = questionsData.questions.find((q) => !newMap.has(q.id));
        if (nextRemaining) {
          setActiveQuestion(nextRemaining);
          return;
        }
        const completionRecorded = localCompleted || (await postProgress(true, true));
        if (completionRecorded) {
          await submitAssessment(newMap);
        }
      }
      refetchCourse?.();
      return;
    }

    // Resume playback directly within the user click gesture unless another
    // earlier question was already passed (e.g. after seeking forward).
    const cur = api?.currentTime() || 0;
    if (questionsData) {
      const nextQ = questionsData.questions.find(
        (q) => !newMap.has(q.id) && cur >= q.timestamp - 0.5
      );
      if (nextQ) {
        setActiveQuestion(nextQ);
        return;
      }
    }

    try {
      if (api && api.paused()) {
        api.play();
      }
    } catch {}
  }, [activeQuestion, selectedAnswer, answeredMap, questionsData, localCompleted, submitAssessment, postProgress, refetchCourse]);

  // Reset all in-session assessment state and let the student try again.
  // Seeks back to the beginning (or ~1s before the first question) and plays.
  const handleRetake = useCallback(() => {
    setAssessmentResult(null);
    setActiveQuestion(null);
    setSelectedAnswer(null);
    setAnsweredMap(new Map());
    setSubmittingAssessment(false);
    videoEndedRef.current = false;
    const api = playerApiRef.current;
    if (api && questionsData && questionsData.questions.length > 0) {
      const firstTs = questionsData.questions[0].timestamp;
      const target = Math.max(0, firstTs - 1);
      try {
        api.seekTo(target);
        lastTimeRef.current = target;
        livePosRef.current = target;
        api.play();
      } catch {}
    }
  }, [questionsData]);

  // Dismiss the result overlay after a passing attempt.
  // If the video already finished, don't restart playback from 0:00.
  const handleDismissResult = useCallback(() => {
    setAssessmentResult(null);
    if (videoEndedRef.current) return;
    try {
      const api = playerApiRef.current;
      if (api && api.paused()) {
        api.play();
      }
    } catch {}
  }, []);

  /* YouTube handling — full IFrame Player API integration */
  const ytVideoId = useMemo(() => toYouTubeVideoId(video.videoUrl), [video.videoUrl]);
  const isYouTube = ytVideoId !== null && (video.source === "YOUTUBE" || video.source === "URL");

  // Keep latest handlers in refs so the YouTube polling always calls current closures.
  const handleTimeUpdateRef = useRef<() => void>(() => {});
  const handleEndedRef = useRef<() => void>(() => {});
  const handlePauseRef = useRef<() => void>(() => {});
  handleTimeUpdateRef.current = handleTimeUpdate;
  handleEndedRef.current = handleEnded;
  handlePauseRef.current = handlePause;

  // Create a YouTube IFrame Player inside an imperatively managed child node.
  // YT.Player replaces the target node it is given with an <iframe>; passing a
  // child node created inside `host` ensures React's `host` div itself is never
  // replaced or detached (preventing NotFoundError: removeChild on unmount/toggle).
  useEffect(() => {
    if (!isYouTube || !ytVideoId) return;
    const host = ytContainerRef.current;
    if (!host) return;
    let cancelled = false;
    let player: any = null;
    const resumeSeconds = resumeTargetRef.current;

    loadYouTubeAPI()
      .then((YT) => {
        if (cancelled || !YT || !YT.Player || !host.isConnected) return;
        const mountEl = document.createElement("div");
        mountEl.className = "w-full h-full";
        host.replaceChildren(mountEl);

        const playerVars: Record<string, any> = {
          controls: 0,
          disablekb: 1,
          fs: 0,
          iv_load_policy: 3,
          rel: 0,
          modestbranding: 1,
          playsinline: 1,
          cc_load_policy: 0,
        };
        if (resumeSeconds >= 1) {
          playerVars.start = Math.floor(resumeSeconds);
        }

        player = new YT.Player(mountEl, {
          width: "100%",
          height: "100%",
          videoId: ytVideoId,
          playerVars,
          events: {
            onReady: (e: any) => {
              if (cancelled) return;
              const p = e.target;
              ytPlayerRef.current = p;
              playerApiRef.current = {
                currentTime: () => { try { return p.getCurrentTime() || 0; } catch { return 0; } },
                duration: () => { try { return p.getDuration() || 0; } catch { return 0; } },
                pause: () => { try { p.pauseVideo(); } catch {} },
                play: () => { try { p.playVideo(); } catch {} },
                seekTo: (t) => { try { p.seekTo(t, true); } catch {} },
                paused: () => { try { return p.getPlayerState() !== 1; } catch { return true; } },
                setMuted: (m) => { try { if (m) p.mute(); else p.unMute(); } catch {} },
                setVolume: (v) => { try { p.setVolume(v); } catch {} },
                setPlaybackRate: (r) => { try { p.setPlaybackRate(r); } catch {} },
              };
              const prefs = audioPrefsRef.current;
              try {
                if (prefs.muted) p.mute(); else p.unMute();
                p.setVolume(prefs.volume);
                if (prefs.rate !== 1) p.setPlaybackRate(prefs.rate);
              } catch {}
              try {
                const d = p.getDuration();
                if (Number.isFinite(d) && d > 0) {
                  durationRef.current = d;
                  setUiDuration(d);
                }
              } catch {}
              // Do NOT call seekTo() here when playerVars.start already sets the start
              // timestamp (calling seekTo in onReady forces YouTube to reload the stream),
              // and do NOT mark resumeAppliedRef=true while the player is unstarted.
              if (resumeTargetRef.current <= 0) {
                resumeAppliedRef.current = true;
              }
            },
            onStateChange: (e: any) => {
              if (cancelled) return;
              const state = e.data;
              const p = e.target;
              if (state === 1) { // PLAYING
                lastTickWallMsRef.current = Date.now();
                setPlayerStatus("playing");
                videoEndedRef.current = false;
                try {
                  const d = p.getDuration();
                  if (Number.isFinite(d) && d > 0) {
                    durationRef.current = d;
                    setUiDuration(d);
                  }
                } catch {}
                if (!resumeAppliedRef.current && resumeTargetRef.current > 0) {
                  const dur = durationRef.current;
                  const target =
                    dur > 3
                      ? Math.min(resumeTargetRef.current, dur - 2)
                      : resumeTargetRef.current;
                  const cur = (() => {
                    try { return p.getCurrentTime() || 0; } catch { return 0; }
                  })();
                  if (Math.abs(cur - target) > 3) {
                    seekLockUntilRef.current = Date.now() + 800;
                    try { p.seekTo(target, true); } catch {}
                    lastTimeRef.current = target;
                    livePosRef.current = target;
                    setUiTime(target);
                  } else {
                    lastTimeRef.current = cur;
                    livePosRef.current = cur;
                  }
                  resumeAppliedRef.current = true;
                  hasPlayedOrSeekedRef.current = true;
                } else {
                  hasPlayedOrSeekedRef.current = true;
                }
                if (ytPollRef.current) clearInterval(ytPollRef.current);
                ytPollRef.current = setInterval(() => { handleTimeUpdateRef.current(); }, 250);
              } else if (state === 2) { // PAUSED
                setPlayerStatus("paused");
                if (ytPollRef.current) { clearInterval(ytPollRef.current); ytPollRef.current = null; }
                handlePauseRef.current();
              } else if (state === 3) { // BUFFERING
                setPlayerStatus("buffering");
              } else if (state === 0) { // ENDED
                setPlayerStatus("ended");
                if (ytPollRef.current) { clearInterval(ytPollRef.current); ytPollRef.current = null; }
                handleEndedRef.current();
              } else {
                setPlayerStatus("idle");
                if (ytPollRef.current) { clearInterval(ytPollRef.current); ytPollRef.current = null; }
              }
            },
          },
        });
      })
      .catch(() => {
        // Ignore transient API load errors on unmount/offline
      });

    return () => {
      cancelled = true;
      if (ytPollRef.current) { clearInterval(ytPollRef.current); ytPollRef.current = null; }
      try { player?.destroy?.(); } catch {}
      try { host.replaceChildren(); } catch {}
      ytPlayerRef.current = null;
      if (isYouTube) playerApiRef.current = null;
    };
  }, [isYouTube, ytVideoId, video.id]);

  // Pre-compute the assessment status badge + overlay JSX so both the compact
  // and expanded views can render the same overlays without duplication.
  const hasQuestions = questionsData
    ? questionsData.questions.length > 0
    : video.hasQuestions;

  const currentAssessment: VideoAssessmentSummary | null =
    assessmentResult
      ? {
          score: assessmentResult.score,
          passed: assessmentResult.passed,
          attempts: assessmentResult.attempts,
        }
      : questionsData?.assessment ??
        (video.hasQuestions && video.assessmentAttempted
          ? {
              score: video.assessmentScore ?? 0,
              passed: video.assessmentPassed === true,
              attempts: video.assessmentAttempts ?? 1,
            }
          : null);

  const isAssessmentFailed = Boolean(
    hasQuestions &&
      currentAssessment &&
      currentAssessment.attempts > 0 &&
      !currentAssessment.passed
  );
  const isLessonFullyCompleted = Boolean(
    localCompleted && (!hasQuestions || currentAssessment?.passed === true)
  );
  const isAssessmentPending = Boolean(
    localCompleted &&
      hasQuestions &&
      (!currentAssessment || currentAssessment.attempts === 0)
  );

  const assessmentStatusBadge = hasQuestions ? (
    currentAssessment?.passed === true ? (
      <Badge className="bg-success/15 text-success border-transparent">
        <CheckCircle2 className="h-3 w-3" /> Assessment Passed ✓
      </Badge>
    ) : currentAssessment && currentAssessment.attempts > 0 ? (
      <Badge className="bg-destructive/15 text-destructive border-transparent">
        <XCircle className="h-3 w-3" /> Assessment Failed ({currentAssessment.score}%) — Retake Needed
      </Badge>
    ) : (
      <Badge className="bg-warning/15 text-warning border-transparent">
        <ClipboardList className="h-3 w-3" /> Assessment Required
      </Badge>
    )
  ) : null;

  const videoOverlays = (
    <>
      {activeQuestion && (
        <QuestionOverlay
          question={activeQuestion}
          selectedAnswer={selectedAnswer}
          onSelect={(idx) => setSelectedAnswer(idx)}
          onSubmit={() => { void handleSubmitAnswer(); }}
          answeredCount={answeredMap.size}
          totalCount={questionsData?.questions.length ?? 0}
          portalContainer={nativeFullscreenEl}
        />
      )}
      {assessmentResult && (
        <AssessmentResultOverlay
          result={assessmentResult}
          onRetake={handleRetake}
          onDismiss={handleDismissResult}
          submitting={submittingAssessment}
          portalContainer={nativeFullscreenEl}
        />
      )}
    </>
  );

  const togglePlayPause = () => {
    const api = playerApiRef.current;
    if (!api) return;
    if (playerStatus === "playing") {
      api.pause();
    } else if (playerStatus === "ended") {
      seekLockUntilRef.current = Date.now() + 400;
      api.seekTo(0);
      lastTimeRef.current = 0;
      livePosRef.current = 0;
      hasPlayedOrSeekedRef.current = true;
      resumeAppliedRef.current = true;
      setUiTime(0);
      videoEndedRef.current = false;
      // Reset in-session answers on replay so every question pops up again
      setAnsweredMap(new Map());
      setActiveQuestion(null);
      setSelectedAnswer(null);
      setAssessmentResult(null);
      api.play();
    } else {
      api.play();
    }
  };

  const handleSeekTo = (target: number) => {
    const maxDur = uiDuration > 0 ? uiDuration : Math.max(target, durationRef.current || 0);
    const clamped = Math.max(0, maxDur > 0 ? Math.min(target, maxDur) : target);
    seekLockUntilRef.current = Date.now() + 500;
    hasPlayedOrSeekedRef.current = true;
    resumeAppliedRef.current = true;
    playerApiRef.current?.seekTo(clamped);
    applySeekUpdate(clamped);
  };

  const handleSkipBy = (delta: number) => {
    const base = Math.max(0, getEffectivePosition() || uiTime);
    handleSeekTo(base + delta);
  };

  const handleToggleMute = () => {
    const next = !isMuted;
    setIsMuted(next);
    playerApiRef.current?.setMuted?.(next);
  };

  const handleVolumeChange = (nextVol: number) => {
    const clamped = Math.max(0, Math.min(100, nextVol));
    setVolume(clamped);
    playerApiRef.current?.setVolume?.(clamped);
    if (clamped === 0 && !isMuted) {
      setIsMuted(true);
      playerApiRef.current?.setMuted?.(true);
    } else if (clamped > 0 && isMuted) {
      setIsMuted(false);
      playerApiRef.current?.setMuted?.(false);
    }
  };

  const SPEED_STEPS = [0.75, 1, 1.25, 1.5, 2];
  const handleCycleSpeed = () => {
    const idx = SPEED_STEPS.indexOf(playbackRate);
    const next = SPEED_STEPS[(idx + 1) % SPEED_STEPS.length];
    setPlaybackRate(next);
    playerApiRef.current?.setPlaybackRate?.(next);
  };

  const handleToggleExpanded = (nextExpanded: boolean) => {
    if (nextExpanded && stageOuterRef.current) {
      savedStageHeightRef.current = stageOuterRef.current.offsetHeight;
    }
    const cur = getEffectivePosition();
    livePosRef.current = cur;
    lastTimeRef.current = cur;
    lastTickWallMsRef.current = Date.now();
    setExpanded(nextExpanded);
  };

  const sliderMax = uiDuration > 0 ? uiDuration : Math.max(uiTime, 100);
  const progressPct = sliderMax > 0 ? Math.min(100, Math.max(0, (uiTime / sliderMax) * 100)) : 0;
  const showPausedCover =
    playerStatus !== "playing" &&
    playerStatus !== "buffering" &&
    !activeQuestion &&
    !assessmentResult;

  const customPlayerOverlayAndBar = (
    <>
      {/* Transparent shield over video/iframe — prevents hover/clicks/right-click on YouTube UI */}
      <div
        className="absolute inset-0 z-10 select-none cursor-pointer"
        onClick={togglePlayPause}
        onDoubleClick={() => handleToggleExpanded(!expanded)}
        onContextMenu={(e) => e.preventDefault()}
        aria-label={playerStatus === "playing" ? "Pause video" : "Play video"}
      />

      {/* Opaque LMS Play/Pause/Replay cover — completely hides YouTube's paused/idle/ended cards & buttons */}
      {showPausedCover && (
        <div
          className="absolute inset-0 z-[12] flex flex-col items-center justify-center gap-3 bg-black/88 backdrop-blur-[2px] px-6 text-center text-white select-none cursor-pointer"
          onClick={togglePlayPause}
          onContextMenu={(e) => e.preventDefault()}
        >
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              togglePlayPause();
            }}
            className="flex h-16 w-16 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-2xl ring-4 ring-white/15 transition-transform hover:scale-105 active:scale-95"
            aria-label={
              playerStatus === "ended"
                ? "Replay lesson"
                : playerStatus === "paused"
                  ? "Resume playback"
                  : "Play lesson"
            }
          >
            {playerStatus === "ended" ? (
              <RefreshCw className="h-7 w-7" />
            ) : (
              <Play className="h-7 w-7 translate-x-0.5 fill-current" />
            )}
          </button>
          <div className="max-w-md space-y-1">
            <p className="text-sm font-semibold text-white line-clamp-1">
              {video.title}
            </p>
            <p className="text-xs text-white/75 tabular-nums">
              {playerStatus === "ended"
                ? isAssessmentFailed
                  ? "Assessment failed · Click to replay & retake"
                  : isAssessmentPending
                    ? "Assessment pending · Click to replay"
                    : "Lesson completed · Click to replay"
                : uiTime >= 2
                  ? `${playerStatus === "paused" ? "Paused" : "Resume"} at ${formatVideoDuration(uiTime)}${uiDuration > 0 ? ` / ${formatVideoDuration(uiDuration)}` : ""}`
                  : "Click to play lesson"}
            </p>
          </div>
        </div>
      )}

      {/* Buffering indicator (debounced so micro-buffering doesn't flicker) */}
      {showBufferingSpinner && !activeQuestion && !assessmentResult && (
        <div className="pointer-events-none absolute inset-0 z-[12] flex items-center justify-center bg-black/25">
          <div className="h-10 w-10 animate-spin rounded-full border-2 border-white/25 border-t-white" />
        </div>
      )}

      {/* Custom LMS Bottom Controls Bar — unified for both YouTube and HTML5 */}
      {!activeQuestion && !assessmentResult && (
        <div
          className={cn(
            "absolute inset-x-0 bottom-0 z-20 flex flex-col gap-1.5 bg-gradient-to-t from-black/95 via-black/75 to-transparent px-3 pt-8 pb-2.5 text-white transition-opacity duration-200",
            playerStatus === "playing"
              ? "opacity-0 group-hover/player:opacity-100 focus-within:opacity-100"
              : "opacity-100"
          )}
          onClick={(e) => e.stopPropagation()}
          onDoubleClick={(e) => e.stopPropagation()}
          onContextMenu={(e) => e.preventDefault()}
        >
          {/* Progress / Seek Slider */}
          <div className="relative flex h-4 w-full items-center group/seek">
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/25 transition-all group-hover/seek:h-2">
              <div
                className="h-full rounded-full bg-primary transition-[width] duration-75"
                style={{ width: `${progressPct}%` }}
              />
            </div>
            <input
              type="range"
              min={0}
              max={sliderMax}
              step={0.1}
              value={Math.min(uiTime, sliderMax)}
              onMouseDown={() => { isScrubbingRef.current = true; }}
              onTouchStart={() => { isScrubbingRef.current = true; }}
              onChange={(e) => {
                const v = Number(e.target.value);
                setUiTime(v);
              }}
              onMouseUp={(e) => {
                isScrubbingRef.current = false;
                handleSeekTo(Number((e.target as HTMLInputElement).value));
              }}
              onTouchEnd={(e) => {
                isScrubbingRef.current = false;
                handleSeekTo(Number((e.target as HTMLInputElement).value));
              }}
              onKeyUp={(e) => {
                handleSeekTo(Number((e.target as HTMLInputElement).value));
              }}
              aria-label="Seek video timeline"
              className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
            />
          </div>

          {/* Action Buttons Row */}
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1 sm:gap-1.5">
              <button
                type="button"
                onClick={togglePlayPause}
                className="flex h-8 w-8 items-center justify-center rounded-lg hover:bg-white/15 transition-colors"
                aria-label={playerStatus === "playing" ? "Pause" : "Play"}
              >
                {playerStatus === "playing" ? (
                  <Pause className="h-4 w-4 fill-current" />
                ) : (
                  <Play className="h-4 w-4 fill-current" />
                )}
              </button>
              <button
                type="button"
                onClick={() => handleSkipBy(-10)}
                className="flex h-8 w-8 items-center justify-center rounded-lg hover:bg-white/15 transition-colors"
                aria-label="Rewind 10 seconds"
                title="Rewind 10s"
              >
                <RotateCcw className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                onClick={() => handleSkipBy(10)}
                className="flex h-8 w-8 items-center justify-center rounded-lg hover:bg-white/15 transition-colors"
                aria-label="Forward 10 seconds"
                title="Forward 10s"
              >
                <RotateCw className="h-3.5 w-3.5" />
              </button>
              <span className="ml-1 text-[11px] font-medium text-white/90 tabular-nums select-none">
                {formatVideoDuration(uiTime)}
                {uiDuration > 0 ? ` / ${formatVideoDuration(uiDuration)}` : ""}
              </span>
            </div>

            <div className="flex items-center gap-1.5">
              {/* Mute + Volume slider */}
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={handleToggleMute}
                  className="flex h-8 w-8 items-center justify-center rounded-lg hover:bg-white/15 transition-colors"
                  aria-label={isMuted ? "Unmute" : "Mute"}
                >
                  {isMuted || volume === 0 ? (
                    <VolumeX className="h-4 w-4" />
                  ) : (
                    <Volume2 className="h-4 w-4" />
                  )}
                </button>
                <input
                  type="range"
                  min={0}
                  max={100}
                  step={5}
                  value={isMuted ? 0 : volume}
                  onChange={(e) => handleVolumeChange(Number(e.target.value))}
                  aria-label="Volume"
                  className="hidden sm:block h-1 w-14 cursor-pointer accent-primary"
                />
              </div>

              {/* Playback Speed */}
              <button
                type="button"
                onClick={handleCycleSpeed}
                className="rounded-md bg-white/10 px-2 py-1 text-[11px] font-semibold text-white hover:bg-white/20 transition-colors tabular-nums"
                aria-label="Playback speed"
                title="Playback speed"
              >
                {playbackRate}x
              </button>

              {/* Fullscreen Toggle */}
              <button
                type="button"
                onClick={() => handleToggleExpanded(!expanded)}
                className="flex h-8 w-8 items-center justify-center rounded-lg hover:bg-white/15 transition-colors"
                aria-label={expanded ? "Exit fullscreen" : "Expand video"}
                title={expanded ? "Exit fullscreen" : "Fullscreen"}
              >
                {expanded ? (
                  <Minimize2 className="h-4 w-4" />
                ) : (
                  <Maximize2 className="h-4 w-4" />
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );

  // Single-mount unified video stage — switching between compact and expanded
  // transforms CSS classes in place so <video> and YT.Player never unmount,
  // preserving continuous playback, tracking, watch-time, and questions.
  return (
    <>
      {/* Question & assessment overlays — portaled to nativeFullscreenEl (if in browser fullscreen) or document.body */}
      {videoOverlays}

      {/* Preserve layout height in document flow when stage switches from sticky to fixed fullscreen */}
      {expanded && (
        <div
          aria-hidden="true"
          style={{ height: savedStageHeightRef.current > 0 ? savedStageHeightRef.current : 360 }}
        />
      )}

      {/* ─── Unified video stage (sticky inline OR expanded full-viewport theater) ─── */}
      <div
        ref={stageOuterRef}
        className={
          expanded
            ? "fixed inset-0 z-[120] bg-black flex flex-col"
            : "sticky top-2 sm:top-3 z-20 overflow-hidden rounded-2xl border border-border bg-card p-2 sm:p-3 shadow-lg ring-1 ring-black/[0.04]"
        }
      >
        {expanded && (
          <div className="shrink-0 flex items-center justify-between px-4 py-3 bg-gradient-to-b from-black/80 to-transparent backdrop-blur">
            <div className="min-w-0 flex-1">
              {topicTitle && (
                <p className="text-[11px] font-medium uppercase tracking-wider text-white/60 mb-0.5 truncate">
                  {topicTitle}
                </p>
              )}
              <p className="text-sm font-semibold text-white truncate">{video.title}</p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {isAssessmentFailed ? (
                <Badge className="bg-destructive/20 text-destructive border-transparent">
                  <XCircle className="h-3 w-3" /> Failed
                </Badge>
              ) : isLessonFullyCompleted ? (
                <Badge className="bg-success/20 text-success border-transparent">
                  <CheckCircle2 className="h-3 w-3" /> Completed
                </Badge>
              ) : isAssessmentPending ? (
                <Badge className="bg-warning/20 text-warning border-transparent">
                  <ClipboardList className="h-3 w-3" /> Assessment Pending
                </Badge>
              ) : null}
              <button
                type="button"
                onClick={() => handleToggleExpanded(false)}
                className="flex items-center gap-1.5 rounded-lg bg-white/10 px-3 py-1.5 text-sm font-medium text-white hover:bg-white/20 transition-colors"
                aria-label="Exit fullscreen"
              >
                <Minimize2 className="h-4 w-4" />
                <span className="hidden sm:inline">Exit fullscreen</span>
              </button>
            </div>
          </div>
        )}

        <div
          className={
            expanded
              ? "flex-1 min-h-0 flex items-center justify-center p-2 sm:p-4 overflow-hidden"
              : ""
          }
        >
          <div
            className={
              expanded
                ? "group/player relative aspect-video max-h-full overflow-hidden rounded-xl bg-black flex items-center justify-center"
                : "group/player relative mx-auto aspect-video w-full max-w-[760px] overflow-hidden rounded-xl bg-black shadow-md ring-1 ring-black/10"
            }
            style={
              expanded
                ? { width: "min(100%, calc((100dvh - 5.5rem) * 16 / 9), 72rem)" }
                : undefined
            }
          >
            {isYouTube ? (
              <div
                key={`yt-player-${video.id}`}
                ref={ytContainerRef}
                className="pointer-events-none absolute inset-0 h-full w-full"
              />
            ) : (
              <video
                key={`html5-player-${video.id}`}
                ref={videoRef}
                src={video.videoUrl}
                poster={video.thumbnail || undefined}
                playsInline
                preload="metadata"
                className="absolute inset-0 h-full w-full object-contain"
                onLoadedMetadata={applyHtml5PlayerReady}
                onLoadedData={applyHtml5PlayerReady}
                onCanPlay={applyHtml5PlayerReady}
                onDurationChange={applyHtml5PlayerReady}
                onPlay={() => {
                  hasPlayedOrSeekedRef.current = true;
                  lastTickWallMsRef.current = Date.now();
                  setPlayerStatus("playing");
                }}
                onPlaying={() => {
                  hasPlayedOrSeekedRef.current = true;
                  lastTickWallMsRef.current = Date.now();
                  setPlayerStatus("playing");
                }}
                onWaiting={() => setPlayerStatus("buffering")}
                onTimeUpdate={handleTimeUpdate}
                onSeeked={handleSeeked}
                onPause={() => { setPlayerStatus("paused"); handlePause(); }}
                onEnded={() => { setPlayerStatus("ended"); void handleEnded(); }}
              />
            )}
            {customPlayerOverlayAndBar}
          </div>
        </div>
      </div>

      {/* ─── Video status badges & assessment info below the pinned video ─── */}
      <Card className="overflow-hidden rounded-2xl border-border p-0 shadow-sm">

        <CardContent className="space-y-3 p-4 sm:p-5">
          {/* Status row — badges + posting indicator */}
          <div className="flex flex-wrap items-center gap-2">
            {posting && (
              <span className="text-xs text-muted-foreground flex items-center gap-1.5">
                <Clock className="h-3 w-3 animate-spin" /> Saving...
              </span>
            )}
            {initialSnapshot.resumePos >= 2 && (
              <Badge variant="outline" className="border-accent/30 bg-accent/5 text-accent gap-1">
                <Clock className="h-3 w-3" /> Resumed at {formatVideoDuration(initialSnapshot.resumePos)}
              </Badge>
            )}
            {hasQuestions && (
              <Badge variant="outline" className="border-primary/30 text-primary gap-1">
                <ListChecks className="h-3 w-3" />
                {questionsData ? questionsData.questions.length : video.questionCount} Question{(questionsData ? questionsData.questions.length : video.questionCount) > 1 ? "s" : ""}
              </Badge>
            )}
            {assessmentStatusBadge}
            {isAssessmentFailed ? (
              <Badge className="bg-destructive/15 text-destructive border-transparent">
                <XCircle className="h-3 w-3" /> Failed
              </Badge>
            ) : isLessonFullyCompleted ? (
              <Badge className="bg-teal-50 text-teal-700 border-transparent">
                <CheckCircle2 className="h-3 w-3" /> Completed
              </Badge>
            ) : isAssessmentPending ? (
              <Badge className="bg-warning/15 text-warning border-transparent">
                <Clock className="h-3 w-3" /> Assessment Pending
              </Badge>
            ) : (
              <Badge variant="outline" className="text-muted-foreground border-border">
                <PlayCircle className="h-3 w-3" /> In progress
              </Badge>
            )}
          </div>

          {/* Assessment hint */}
          {hasQuestions && (
            <p className="text-xs text-muted-foreground flex items-start gap-1.5">
              <ListChecks className="h-3.5 w-3.5 mt-0.5 text-primary shrink-0" />
              <span>
                This lesson includes {questionsData ? questionsData.questions.length : video.questionCount} in-video question{(questionsData ? questionsData.questions.length : video.questionCount) > 1 ? "s" : ""}.
                {" "}
                {currentAssessment?.passed === true
                  ? "You've passed the assessment — questions will still appear each time you watch."
                  : currentAssessment && currentAssessment.attempts > 0
                    ? `Previous score: ${currentAssessment.score}%. Watch again to retake the assessment.`
                    : "Answer each question as it appears. Your Pass/Fail result will appear at the end of the video."}
              </span>
            </p>
          )}

          {/* YouTube videos are fully embedded + auto-tracked via the IFrame
              Player API. No manual "Mark as complete" button needed. */}
        </CardContent>
      </Card>
    </>
  );
}

/* ===================== Helpers ===================== */

/* ──────────────────────────────────────────────────────────────
   QuestionOverlay — inline popup rendered on top of the video
   ──────────────────────────────────────────────────────────────
   Shows only the question and answer choices. Submitting records the
   answer and immediately resumes playback with no extra interruptions. */
function QuestionOverlay({
  question,
  selectedAnswer,
  onSelect,
  onSubmit,
  answeredCount,
  totalCount,
  portalContainer,
}: {
  question: VideoQuestionData;
  selectedAnswer: number | null;
  onSelect: (idx: number) => void;
  onSubmit: () => void;
  answeredCount: number;
  totalCount: number;
  portalContainer?: Element | null;
}) {
  const overlay = (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 sm:p-6 animate-in fade-in duration-150"
      role="dialog"
      aria-modal="true"
      aria-label={`Question ${answeredCount + 1} of ${totalCount}`}
    >
      <div className="w-full max-w-lg max-h-[90vh] flex flex-col rounded-xl border border-accent/20 bg-card shadow-2xl ring-1 ring-accent/10 overflow-hidden">
        {/* Header strip */}
        <div className="flex items-center justify-between gap-2 border-b border-accent/15 bg-gradient-to-r from-soft-sage to-transparent px-4 py-2.5 shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            <span className="flex h-6 w-6 items-center justify-center rounded-md bg-accent/15 text-primary shrink-0">
              <HelpCircle className="h-3.5 w-3.5" />
            </span>
            <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-primary truncate">
              Question {answeredCount + 1} of {totalCount}
            </span>
          </div>
          <span className="text-[11px] font-medium text-muted-foreground tabular-nums shrink-0">
            {answeredCount + 1} / {totalCount}
          </span>
        </div>

        {/* Body — scrollable if content is tall */}
        <div className="flex-1 overflow-y-auto scrollbar-thin p-4 sm:p-5 space-y-4">
          <p className="text-base font-semibold text-foreground leading-relaxed">
            {question.question}
          </p>

          <div className="space-y-2">
            {question.options.map((opt, idx) => {
              const isSelected = selectedAnswer === idx;
              return (
                <button
                  key={idx}
                  type="button"
                  onClick={() => onSelect(idx)}
                  className={cn(
                    "group flex w-full items-center gap-3 rounded-lg border px-3 py-2.5 text-left transition-all duration-150",
                    isSelected
                      ? "border-accent bg-soft-sage ring-1 ring-accent/30"
                      : "border-border bg-card hover:border-accent/40 hover:bg-soft-sage/40"
                  )}
                  aria-pressed={isSelected}
                >
                  <span
                    className={cn(
                      "flex h-5 w-5 shrink-0 items-center justify-center rounded-full border text-[10px] font-bold transition-colors",
                      isSelected
                        ? "border-accent bg-accent text-accent-foreground"
                        : "border-border text-muted-foreground group-hover:border-accent/50"
                    )}
                  >
                    {String.fromCharCode(65 + idx)}
                  </span>
                  <span className={cn(
                    "text-sm",
                    isSelected ? "font-medium text-foreground" : "text-foreground"
                  )}>
                    {opt}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Footer — single Submit Answer button */}
        <div className="shrink-0 flex items-center justify-between gap-3 border-t border-border px-4 py-3 bg-card">
          <p className="text-[11px] text-muted-foreground">
            Select an option to continue watching.
          </p>
          <Button
            onClick={onSubmit}
            disabled={selectedAnswer === null}
            size="sm"
            className="gap-2 shadow-sm"
          >
            Submit Answer
          </Button>
        </div>
      </div>
    </div>
  );

  const target =
    portalContainer || (typeof document !== "undefined" ? document.body : null);
  return target ? createPortal(overlay, target) : overlay;
}

/* ──────────────────────────────────────────────────────────────
   AssessmentResultOverlay — shown at the end of the video
   ──────────────────────────────────────────────────────────────
   Reveals the final score, pass/fail status, and per-question
   correctness after the video finishes. */
function AssessmentResultOverlay({
  result,
  onRetake,
  onDismiss,
  submitting,
  portalContainer,
}: {
  result: AssessmentResult;
  onRetake: () => void;
  onDismiss: () => void;
  submitting: boolean;
  portalContainer?: Element | null;
}) {
  const passed = result.passed;
  const overlay = (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-black/85 backdrop-blur-sm p-4 sm:p-6 animate-in fade-in duration-150"
      role="dialog"
      aria-modal="true"
      aria-label="Assessment result"
    >
      <div className="w-full max-w-md max-h-[90vh] overflow-y-auto scrollbar-thin rounded-xl border border-border bg-card shadow-2xl ring-1 ring-black/5">
        {/* Header — pass/fail banner */}
        <div
          className={cn(
            "flex flex-col items-center text-center px-5 py-5 border-b",
            passed ? "border-success/20 bg-success/5" : "border-destructive/20 bg-destructive/5"
          )}
        >
          <div
            className={cn(
              "flex h-14 w-14 items-center justify-center rounded-full mb-2.5",
              passed ? "bg-success/15" : "bg-destructive/10"
            )}
          >
            {passed ? (
              <CheckCircle2 className="h-7 w-7 text-success" />
            ) : (
              <AlertTriangle className="h-7 w-7 text-destructive" />
            )}
          </div>
          <h3 className={cn(
            "text-lg font-semibold",
            passed ? "text-success" : "text-destructive"
          )}>
            {passed ? "Assessment Passed!" : "Assessment Failed"}
          </h3>
          <p className="text-sm text-muted-foreground mt-1">
            {passed
              ? `You scored ${result.score}% — ${result.correctCount}/${result.totalQuestions} correct.`
              : `Score: ${result.score}%. You need 70% to pass. You can retake the assessment.`}
          </p>
          {/* Score ring */}
          <div className="mt-3 w-full max-w-[220px]">
            <Progress
              value={result.score}
              className={cn(
                "h-2 bg-muted",
                passed
                  ? "[&_[data-slot=progress-indicator]]:bg-success"
                  : "[&_[data-slot=progress-indicator]]:bg-destructive"
              )}
            />
            <div className="flex justify-between text-[10px] text-muted-foreground mt-1 tabular-nums">
              <span>0%</span>
              <span className="font-semibold text-foreground">{result.score}%</span>
              <span>100%</span>
            </div>
          </div>
        </div>

        {/* Per-question review */}
        <div className="p-4 sm:p-5 space-y-2.5">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            Review
          </p>
          {result.answers.map((a, idx) => (
            <div
              key={a.questionId}
              className={cn(
                "rounded-lg border p-3",
                a.correct
                  ? "border-success/20 bg-success/5"
                  : "border-destructive/20 bg-destructive/5"
              )}
            >
              <div className="flex items-start gap-2">
                {a.correct ? (
                  <CheckCircle2 className="h-4 w-4 text-success shrink-0 mt-0.5" />
                ) : (
                  <XCircle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
                )}
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-medium text-foreground leading-relaxed">
                    <span className="text-muted-foreground mr-1">Q{idx + 1}.</span>
                    {a.question}
                  </p>
                  {!a.correct && a.selectedAnswer >= 0 && (
                    <p className="text-[11px] text-muted-foreground mt-1">
                      Your answer:{" "}
                      <span className="text-destructive font-medium line-clamp-1">
                        {a.options[a.selectedAnswer]}
                      </span>
                    </p>
                  )}
                  {!a.correct && (
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      Correct:{" "}
                      <span className="text-success font-medium line-clamp-1">
                        {a.options[a.correctAnswer]}
                      </span>
                    </p>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Footer actions */}
        <div className="flex items-center justify-end gap-2 border-t border-border bg-muted/30 px-4 py-3">
          {passed ? (
            <Button
              onClick={onDismiss}
              variant="default"
              size="sm"
              className="gap-2 shadow-sm"
            >
              <CheckCircle2 className="h-4 w-4" /> Done
            </Button>
          ) : (
            <>
              <Button
                onClick={onDismiss}
                variant="outline"
                size="sm"
              >
                Close
              </Button>
              <Button
                onClick={onRetake}
                disabled={submitting}
                variant="destructive"
                size="sm"
                className="gap-2 shadow-sm"
              >
                <RefreshCw className={cn("h-4 w-4", submitting && "animate-spin")} />
                {submitting ? "Retaking…" : "Retake Assessment"}
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  );

  const target =
    portalContainer || (typeof document !== "undefined" ? document.body : null);
  return target ? createPortal(overlay, target) : overlay;
}

function MaterialRow({ material }: { material: MaterialItem }) {
  const { t } = useI18n();
  const isLink = material.type === "LINK";
  const Icon = isLink ? LinkIcon : FileText;
  return (
    <li>
      <a
        href={material.fileUrl}
        target="_blank"
        rel="noreferrer"
        className="group flex items-start gap-3 rounded-lg border border-border bg-card p-3 hover:border-accent/40 hover:bg-soft-sage/40 transition-all duration-200"
      >
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-accent/10 text-accent shrink-0 ring-1 ring-accent/20">
          <Icon className="h-4 w-4" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-foreground line-clamp-1 group-hover:text-accent transition-colors">{material.title}</p>
          {material.description && (
            <p className="text-xs text-muted-foreground line-clamp-1 mt-0.5">{material.description}</p>
          )}
          {material.topic && (
            <p className="text-xs text-muted-foreground mt-0.5">Topic: {material.topic.title}</p>
          )}
        </div>
        <span className="text-xs font-medium text-accent flex items-center gap-1 shrink-0">
          {isLink ? "Open" : "Download"} <Download className="h-3 w-3" />
        </span>
      </a>
    </li>
  );
}

/* ===================== Locked Assignment Placeholder ===================== */

function LockedAssignmentCard({
  completedVideos,
  totalVideos,
  percent,
  assignmentCount = 1,
}: {
  completedVideos: number;
  totalVideos: number;
  percent: number;
  assignmentCount?: number;
}) {
  const { t } = useI18n();
  const plural = assignmentCount > 1;
  return (
    <Card className="border-dashed border-border bg-muted/20 shadow-sm">
      <CardContent className="p-6">
        <div className="flex items-start gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-muted text-muted-foreground shrink-0 ring-1 ring-border">
            <Lock className="h-6 w-6" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="font-heading text-base font-semibold text-foreground">
                {plural ? `${assignmentCount} Assignments Locked` : "Assignment Locked"}
              </h3>
              <Badge className="bg-muted text-muted-foreground border-transparent">Locked</Badge>
            </div>
            <p className="text-sm text-muted-foreground mt-1.5">
              {plural
                ? `Complete all video lessons in this course to unlock all ${assignmentCount} assignments. All assignments will appear here once you finish every lesson.`
                : "Complete all video lessons in this course to unlock your assignment. The assignment details will appear here once you finish every lesson."}
            </p>
            <div className="mt-4">
              <div className="flex justify-between text-xs text-muted-foreground mb-1.5">
                <span>{completedVideos}/{totalVideos} lessons completed</span>
                <span className="font-semibold text-foreground">{percent}%</span>
              </div>
              <Progress
                value={percent}
                className={`h-2 bg-muted ${percent === 100 ? "[&_[data-slot=progress-indicator]]:bg-success" : "[&_[data-slot=progress-indicator]]:bg-accent"}`}
              />
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function AssignmentsSection({
  course,
  assignments,
  onSubmitted,
}: {
  course: CourseDetail;
  assignments: AssignmentEntry[];
  onSubmitted: () => void;
}) {
  const passedCount = assignments.filter(
    (a) => a.submission?.status === "PASSED" || a.submission?.status === "REVIEWED"
  ).length;
  const submittedCount = assignments.filter((a) => Boolean(a.submission)).length;

  return (
    <div className="space-y-4">
      {assignments.length > 1 && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-accent/20 bg-soft-sage/40 px-4 py-3">
          <div className="flex items-center gap-2.5">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent/15 text-accent shrink-0">
              <ClipboardList className="h-4 w-4" />
            </span>
            <div>
              <p className="text-sm font-semibold text-foreground">
                Course Assignments ({assignments.length})
              </p>
              <p className="text-xs text-muted-foreground">
                All {assignments.length} assignments are unlocked. Submit each one so your instructor can review and issue your certificate.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Badge variant="outline" className="border-border bg-card text-foreground tabular-nums">
              {submittedCount}/{assignments.length} Submitted
            </Badge>
            <Badge
              className={
                passedCount === assignments.length
                  ? "bg-success/15 text-success border-transparent tabular-nums"
                  : "bg-primary/10 text-primary border-transparent tabular-nums"
              }
            >
              {passedCount}/{assignments.length} Passed
            </Badge>
          </div>
        </div>
      )}

      <div className="space-y-4">
        {assignments.map((item, idx) => (
          <AssignmentPanel
            key={item.id}
            course={course}
            assignment={item}
            submission={item.submission}
            index={idx}
            totalCount={assignments.length}
            onSubmitted={onSubmitted}
          />
        ))}
      </div>
    </div>
  );
}

function AssignmentPanel({
  course,
  assignment,
  submission,
  index,
  totalCount,
  onSubmitted,
}: {
  course: CourseDetail;
  assignment: AssignmentInfo;
  submission: SubmissionInfo | null;
  index: number;
  totalCount: number;
  onSubmitted: () => void;
}) {
  const { t } = useI18n();
  const navigate = useAppStore((s) => s.navigate);
  const [uploading, setUploading] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [viewOpen, setViewOpen] = useState(false);

  const completed = course.courseCompletion.allCompleted;
  const isPassed = submission?.status === "PASSED" || submission?.status === "REVIEWED";
  const isFailed = submission?.status === "FAILED";
  const canUpload = completed && (!submission || (!isPassed && (isFailed || assignment.allowResubmission)));

  async function handleDownloadBrief() {
    setDownloading(true);
    try {
      const res = await authFetch(`/api/student/assignments/${assignment.id}/download`, {
        credentials: "include",
        cache: "no-store",
      });
      if (!res.ok) {
        let msg = "Failed to download assignment";
        try {
          const j = await res.json();
          if (j?.error) msg = j.error;
        } catch {}
        throw new Error(msg);
      }

      const disp = res.headers.get("Content-Disposition") || "";
      const utf8Match = disp.match(/filename\*\s*=\s*(?:UTF-8''|utf-8'')([^;\s]+)/i);
      const asciiMatch = disp.match(/filename\s*=\s*"?([^";]+)"?/i);
      let decodedHeaderName: string | null = null;
      if (utf8Match?.[1]) {
        try {
          decodedHeaderName = decodeURIComponent(utf8Match[1].replace(/^"|"$/g, ""));
        } catch {
          decodedHeaderName = utf8Match[1];
        }
      } else if (asciiMatch?.[1]) {
        decodedHeaderName = asciiMatch[1];
      }
      const fallbackExt = assignment.fileUrl
        ? (assignment.fileUrl.split("?")[0].match(/\.[a-z0-9]+$/i)?.[0] || "")
        : ".txt";
      const filename =
        decodedHeaderName ||
        `${(assignment.title || `assignment_${index + 1}`).replace(/[^a-z0-9-_]+/gi, "_")}${fallbackExt}`;

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err: any) {
      toast({
        title: "Download failed",
        description: err?.message || "Unable to download assignment file",
        variant: "destructive",
      });
    } finally {
      setDownloading(false);
    }
  }

  async function handleSubmit() {
    if (!selectedFile) {
      toast({ title: "Select a file", description: "Please choose a file to upload.", variant: "destructive" });
      return;
    }
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", selectedFile);
      await apiUpload<{
        certificateIssued: boolean;
        certificateId?: string;
      }>(`/api/student/assignments/${assignment.id}/submit`, fd);
      setSelectedFile(null);
      await onSubmitted();
      toast({
        title: "Assignment uploaded",
        description:
          totalCount > 1
            ? `Your work has been submitted. Your certificate will be issued once your instructor marks all ${totalCount} assignments as Pass.`
            : "Your work has been submitted. Your certificate will be issued once your teacher or instructor marks it as Pass.",
      });
    } catch {
    } finally {
      setUploading(false);
    }
  }

  return (
    <>
      <Card className="card-elevated border-accent/20">
        <CardHeader>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <CardTitle className="text-base flex items-center gap-2">
                <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-accent/10 text-accent">
                  <ClipboardList className="h-4 w-4" />
                </span>
                {assignment.title || `Assignment ${index + 1}`}
              </CardTitle>
              <CardDescription>
                {totalCount > 1
                  ? `Assignment ${index + 1} of ${totalCount} · ${completed ? "Unlocked" : "Locked"}`
                  : `Course assignment · ${completed ? "Unlocked" : "Locked"}`}
              </CardDescription>
            </div>
            {completed && (
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setViewOpen(true)}
                  className="gap-1.5 shadow-sm"
                >
                  <Eye className="h-3.5 w-3.5" /> View Assignment
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleDownloadBrief}
                  disabled={downloading}
                  className="gap-1.5 shadow-sm"
                >
                  <Download className="h-3.5 w-3.5" /> {downloading ? "Downloading..." : "Download Assignment"}
                </Button>
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {!completed ? (
            <div className="rounded-lg border border-border bg-muted/40 p-4">
              <div className="flex items-start gap-3">
                <Lock className="h-5 w-5 text-muted-foreground shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="font-medium text-foreground">Assignment locked</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    Complete all video lessons in this course to unlock your assignment.
                  </p>
                  <div className="mt-3">
                    <div className="flex justify-between text-xs text-muted-foreground mb-1">
                      <span>{course.courseCompletion.completedVideos}/{course.courseCompletion.totalVideos} lessons</span>
                      <span>{course.courseCompletion.percent}%</span>
                    </div>
                    <Progress value={course.courseCompletion.percent} className="h-1.5 bg-muted [&_[data-slot=progress-indicator]]:bg-accent" />
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <>
              {/* Assignment prompt summary */}
              <div className="space-y-3">
                {assignment.description && (
                  <p className="text-sm text-foreground">{assignment.description}</p>
                )}
                {assignment.instructions && (
                  <div className="rounded-lg border border-border bg-muted/40 p-3.5">
                    <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">Instructions</p>
                    <p className="text-sm text-foreground whitespace-pre-wrap">{assignment.instructions}</p>
                  </div>
                )}
                {assignment.dueDate && (
                  <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                    <Clock className="h-3.5 w-3.5 text-accent" /> Due {formatDateTime(assignment.dueDate)}
                  </p>
                )}
              </div>

              {/* Submission status */}
              {submission && (
                <div
                  className={cn(
                    "rounded-lg border p-4 space-y-3",
                    isPassed
                      ? "border-success/30 bg-success/5"
                      : isFailed
                        ? "border-destructive/30 bg-destructive/5"
                        : "border-warning/30 bg-warning/5"
                  )}
                >
                  <div className="flex flex-wrap items-center gap-2">
                    {isPassed ? (
                      <Badge className="bg-success/15 text-success border-transparent gap-1">
                        <CheckCircle2 className="h-3 w-3" /> Passed
                      </Badge>
                    ) : isFailed ? (
                      <Badge className="bg-destructive/15 text-destructive border-transparent gap-1">
                        <XCircle className="h-3 w-3" /> Needs Revision
                      </Badge>
                    ) : (
                      <Badge className="bg-warning/15 text-warning border-transparent gap-1">
                        <Clock className="h-3 w-3" /> Pending Instructor Review
                      </Badge>
                    )}
                    <span className="text-xs text-muted-foreground">
                      Uploaded on {formatDateTime(submission.submittedAt)}
                    </span>
                  </div>

                  {!isPassed && !isFailed && (
                    <p className="text-xs text-muted-foreground">
                      {totalCount > 1
                        ? `Your assignment has been uploaded. Your certificate will be issued once your instructor marks all ${totalCount} assignments as Pass.`
                        : "Your assignment has been uploaded. Your certificate will be issued once your teacher or instructor marks it as Pass."}
                    </p>
                  )}

                  <a
                    href={submission.fileUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-2 text-sm text-accent hover:underline"
                  >
                    <Download className="h-3.5 w-3.5" /> View your uploaded file
                  </a>

                  {submission.reviewNotes && (
                    <div className="rounded-lg border border-border bg-card p-3">
                      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">
                        Instructor feedback
                      </p>
                      <p className="text-sm text-foreground whitespace-pre-wrap">{submission.reviewNotes}</p>
                    </div>
                  )}

                  {(course.certificate || (isPassed && totalCount === 1)) && (
                    <div className="pt-1">
                      <Button
                        size="sm"
                        onClick={() => navigate(["student", "certificates"])}
                        className="gap-2 shadow-sm"
                      >
                        <Award className="h-4 w-4" /> View Your Certificate
                      </Button>
                    </div>
                  )}

                  {!isPassed && (isFailed || assignment.allowResubmission) && (
                    <p className="text-xs text-muted-foreground flex items-start gap-1.5">
                      <Sparkles className="h-3.5 w-3.5 text-accent shrink-0 mt-0.5" />
                      {isFailed
                        ? "Please upload a revised assignment file below so your instructor can re-evaluate it."
                        : "Resubmission is allowed — pick a new file below to replace your submission."}
                    </p>
                  )}
                </div>
              )}

              {/* Upload / Resubmit section */}
              {canUpload && (
                <div className="border-t border-border pt-4 space-y-3">
                  <label className="text-sm font-medium text-foreground flex items-center gap-2">
                    <FileText className="h-4 w-4 text-accent" />
                    {submission ? "Upload revised assignment" : "Upload your assignment"}
                  </label>
                  <input
                    type="file"
                    accept=".pdf,.doc,.docx,.ppt,.pptx,.txt"
                    onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                    className="block w-full text-sm text-foreground file:mr-3 file:py-1.5 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-primary file:text-primary-foreground hover:file:bg-primary/90 cursor-pointer"
                  />
                  {selectedFile && (
                    <p className="text-xs text-muted-foreground">
                      Selected: {selectedFile.name} ({Math.round(selectedFile.size / 1024)} KB)
                    </p>
                  )}
                  <Button onClick={handleSubmit} disabled={!selectedFile || uploading} className="gap-2 shadow-sm">
                    <Upload className="h-4 w-4" />
                    {uploading ? "Uploading..." : submission ? "Resubmit Assignment" : "Upload Assignment"}
                  </Button>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* View Assignment Modal */}
      <Dialog open={viewOpen} onOpenChange={setViewOpen}>
        <DialogContent className="w-[95vw] max-w-3xl max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ClipboardList className="h-4 w-4 text-accent" />
              {assignment.title || "Course Assignment"}
            </DialogTitle>
            <DialogDescription>
              {course.title}
              {assignment.dueDate ? ` · Due ${formatDateTime(assignment.dueDate)}` : ""}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 overflow-y-auto pr-1">
            {assignment.description && (
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">
                  Description
                </p>
                <p className="text-sm text-foreground whitespace-pre-wrap">{assignment.description}</p>
              </div>
            )}
            {assignment.instructions && (
              <div className="rounded-lg border border-border bg-muted/40 p-3.5">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">
                  Instructions
                </p>
                <p className="text-sm text-foreground whitespace-pre-wrap">{assignment.instructions}</p>
              </div>
            )}
            {assignment.fileUrl && (
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Assignment Brief Document
                  </p>
                  <div className="flex items-center gap-2">
                    <a
                      href={assignment.fileUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 text-xs font-medium text-accent hover:underline"
                    >
                      <ExternalLink className="h-3 w-3" /> Open in new tab
                    </a>
                    <Button size="sm" variant="outline" onClick={handleDownloadBrief} disabled={downloading} className="gap-1.5 h-8">
                      <Download className="h-3.5 w-3.5" /> {downloading ? "Downloading..." : "Download"}
                    </Button>
                  </div>
                </div>
                <iframe
                  src={assignment.fileUrl}
                  title={assignment.title || "Assignment Brief"}
                  className="w-full h-[360px] rounded-lg border border-border bg-background"
                />
              </div>
            )}
            {!assignment.fileUrl && (
              <div className="flex justify-end pt-2">
                <Button size="sm" variant="outline" onClick={handleDownloadBrief} disabled={downloading} className="gap-1.5">
                  <Download className="h-3.5 w-3.5" /> {downloading ? "Downloading..." : "Download Assignment Brief"}
                </Button>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

// Local helper for YouTube URL parsing
function toYouTubeVideoId(url: string): string | null {
  try {
    const u = new URL(url);
    if (u.hostname === "youtu.be") return u.pathname.slice(1) || null;
    if (u.hostname.includes("youtube.com")) {
      const v = u.searchParams.get("v");
      if (v) return v;
      const m = u.pathname.match(/\/(embed|shorts|live)\/([\w-]+)/);
      if (m) return m[2];
    }
    return null;
  } catch {
    return null;
  }
}

function formatVideoDuration(seconds: number): string {
  if (seconds <= 0) return "";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  if (m === 0) return `${s}s`;
  return `${m}:${s.toString().padStart(2, "0")}`;
}
