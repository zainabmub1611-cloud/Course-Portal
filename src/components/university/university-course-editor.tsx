"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { EmptyState } from "@/components/shared/empty-state";
import { TopicsTable } from "@/components/shared/topics-table";
import { useApiFetch, apiPost, apiUpload, authFetch, markApiCacheStale } from "@/hooks/use-api";
import { useAppStore } from "@/stores/app-store";
import { useI18n } from "@/lib/i18n/store";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { formatDate, formatDateTime, type SubscriptionPlanPublic } from "@/types";
import {
  ArrowLeft, Plus, Pencil, Trash2, Video as VideoIcon,
  FileText, ClipboardList, Award, Settings, BookOpen, Upload, Eye, EyeOff,
  ExternalLink, Save, Info,
  ListChecks, Check, Clock, PlusCircle, X, HelpCircle,
} from "lucide-react";

interface CourseDetail {
  id: string;
  title: string;
  description: string | null;
  thumbnail: string | null;
  category: string | null;
  accessType: "FREE" | "PAID";
  isPublished: boolean;
  createdAt: string;
  updatedAt: string;
  topics: TopicRow[];
  materials: MaterialRow[];
  assignments: AssignmentRow[];
  certificateTemplate: CertTemplate | null;
  planAccess: { id: string; planId: string; planName: string }[];
}

interface TopicRow {
  id: string;
  title: string;
  description: string | null;
  displayOrder: number;
  videos: VideoRow[];
  materials: MaterialRow[];
}

interface VideoRow {
  id: string;
  title: string;
  description: string | null;
  source: "UPLOAD" | "YOUTUBE" | "URL";
  videoUrl: string;
  thumbnail: string | null;
  displayOrder: number;
  isPublished: boolean;
  duration: number;
  topicId: string | null;
}

interface VideoQuestion {
  id: string;
  videoId: string;
  question: string;
  options: string[];
  correctAnswer: number;
  timestamp: number;
}

interface QuestionsResponse {
  questions: VideoQuestion[];
}

interface MaterialRow {
  id: string;
  title: string;
  description: string | null;
  type: "PDF" | "DOC" | "PRESENTATION" | "LINK";
  fileUrl: string;
  isPublished: boolean;
  topic: { id: string; title: string } | null;
}

interface AssignmentRow {
  id: string;
  title: string;
  description: string | null;
  instructions: string | null;
  fileUrl: string | null;
  dueDate: string | null;
  isPublished: boolean;
  allowResubmission: boolean;
  submissionsCount: number;
  createdAt: string;
}

interface CertTemplate {
  id: string;
  isEnabled: boolean;
  title: string;
  bodyText: string;
  organizationName: string;
  layout: "CLASSIC" | "MODERN" | "MINIMAL";
}

interface PlansResponse {
  plans: SubscriptionPlanPublic[];
}

export function UniversityCourseEditor({
  courseId,
  onBack,
}: {
  courseId: string;
  onBack: () => void;
}) {
  const navigate = useAppStore((s) => s.navigate);
  const query = useAppStore((s) => s.query);
  const isInstructor = useAppStore((s) => s.user?.role === "INSTRUCTOR");
  const { t } = useI18n();
  const [activeTab, setActiveTab] = useState<string>("topics");

  // Deep link via ?tab=certificate — React 19 "store previous value" pattern
  const [lastTab, setLastTab] = useState<string | undefined>(undefined);
  if (query.tab !== lastTab) {
    setLastTab(query.tab);
    if (query.tab) setActiveTab(query.tab);
  }
  const allowedTabs = isInstructor
    ? ["topics", "materials", "assignments", "certificate"]
    : ["topics", "materials", "assignments", "certificate", "settings"];
  const safeTab = allowedTabs.includes(activeTab)
    ? activeTab
    : isInstructor
      ? "topics"
      : "settings";

  const { data, loading, error, refetch } = useApiFetch<{ course: CourseDetail }>(
    `/api/university/courses/${courseId}`
  );
  const { data: plansData } = useApiFetch<PlansResponse>(
    isInstructor ? null : "/api/public/plans"
  );

  const course = data?.course;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="icon"
            className="h-9 w-9 shrink-0"
            onClick={onBack}
            aria-label={t("common.back")}
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="min-w-0">
            {loading ? (
              <>
                <Skeleton className="h-6 w-48 mb-1" />
                <Skeleton className="h-3 w-32" />
              </>
            ) : (
              <>
                <h2 className="font-heading text-xl font-bold text-foreground truncate">
                  {course?.title || "Course"}
                </h2>
                <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground mt-1">
                  {course?.category && (
                    <Badge variant="outline" className="text-[10px] uppercase tracking-wider">
                      {course.category}
                    </Badge>
                  )}
                  {course?.accessType === "FREE" ? (
                    <Badge className="bg-success/15 text-success">{t("common.free")}</Badge>
                  ) : (
                    <Badge className="bg-primary text-primary-foreground">{t("common.paid")}</Badge>
                  )}
                  {course?.isPublished ? (
                    <Badge className="bg-success/15 text-success gap-1">
                      Published
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="text-muted-foreground">
                      Draft
                    </Badge>
                  )}
                  <span className="text-muted-foreground">
                    Updated {course ? formatDate(course.updatedAt) : ""}
                  </span>
                </div>
              </>
            )}
          </div>
        </div>
        {!isInstructor && (
          <Button
            variant="outline"
            size="sm"
            disabled
            className="h-9 text-muted-foreground"
            title="Student preview is not available in university view"
          >
            <Eye className="h-4 w-4" /> Open in student view
          </Button>
        )}
      </div>

      {error ? (
        <EmptyState
          icon={<BookOpen className="h-5 w-5" />}
          title="Couldn't load course"
          description={error}
          action={<Button variant="outline" onClick={onBack}>Back to courses</Button>}
        />
      ) : loading || !course ? (
        <Skeleton className="h-96 w-full" />
      ) : (
        <Tabs value={safeTab} onValueChange={setActiveTab}>
          <div className="rounded-lg border border-border bg-card p-1 shadow-sm overflow-x-auto scrollbar-thin">
            <TabsList className="w-full justify-start h-auto flex-wrap bg-transparent gap-1">
              <TabsTrigger
                value="topics"
                className="gap-1.5 rounded-lg data-[state=active]:bg-soft-sage data-[state=active]:text-primary data-[state=active]:font-semibold data-[state=active]:shadow-sm"
              >
                <VideoIcon className="h-3.5 w-3.5" /> Topics &amp; Videos
              </TabsTrigger>
              <TabsTrigger
                value="materials"
                className="gap-1.5 rounded-lg data-[state=active]:bg-soft-sage data-[state=active]:text-primary data-[state=active]:font-semibold data-[state=active]:shadow-sm"
              >
                <FileText className="h-3.5 w-3.5" /> Materials
              </TabsTrigger>
              <TabsTrigger
                value="assignments"
                className="gap-1.5 rounded-lg data-[state=active]:bg-soft-sage data-[state=active]:text-primary data-[state=active]:font-semibold data-[state=active]:shadow-sm"
              >
                <ClipboardList className="h-3.5 w-3.5" /> Assignments
              </TabsTrigger>
              <TabsTrigger
                value="certificate"
                className="gap-1.5 rounded-lg data-[state=active]:bg-soft-sage data-[state=active]:text-primary data-[state=active]:font-semibold data-[state=active]:shadow-sm"
              >
                <Award className="h-3.5 w-3.5" /> Certificate
              </TabsTrigger>
              {!isInstructor && (
                <>
                  <TabsTrigger
                    value="settings"
                    className="gap-1.5 rounded-lg data-[state=active]:bg-soft-sage data-[state=active]:text-primary data-[state=active]:font-semibold data-[state=active]:shadow-sm"
                  >
                    <Settings className="h-3.5 w-3.5" /> Settings
                  </TabsTrigger>
                </>
              )}
            </TabsList>
          </div>

          <TabsContent value="topics" className="mt-4">
            <TopicsTab course={course} onRefresh={refetch} readOnly={!isInstructor} />
          </TabsContent>
          <TabsContent value="materials" className="mt-4">
            <MaterialsTab course={course} onRefresh={refetch} readOnly={!isInstructor} />
          </TabsContent>
          <TabsContent value="assignments" className="mt-4">
            <AssignmentsTab course={course} onRefresh={refetch} readOnly={!isInstructor} />
          </TabsContent>
          <TabsContent value="certificate" className="mt-4">
            <CertificateTab course={course} onRefresh={refetch} />
          </TabsContent>
          {!isInstructor && (
            <TabsContent value="settings" className="mt-4">
              <SettingsTab
                course={course}
                plans={plansData?.plans || []}
                onRefresh={refetch}
                onDeleted={() => navigate(["university", "courses"])}
              />
            </TabsContent>
          )}
        </Tabs>
      )}
    </div>
  );
}

// ============= TOPICS & VIDEOS TAB =============
function TopicsTab({
  course,
  onRefresh,
  readOnly = false,
}: {
  course: CourseDetail;
  onRefresh: () => void;
  readOnly?: boolean;
}) {
  const { t } = useI18n();
  const [addVideoFor, setAddVideoFor] = useState<TopicRow | null>(null);
  const [editVideo, setEditVideo] = useState<VideoRow | null>(null);
  const [deleteVideo, setDeleteVideo] = useState<VideoRow | null>(null);
  const [previewVideo, setPreviewVideo] = useState<VideoRow | null>(null);
  const [questionsOpenFor, setQuestionsOpenFor] = useState<string | null>(null);
  const [questionCounts, setQuestionCounts] = useState<Record<string, number>>({});
  const reportCount = useCallback((videoId: string, n: number) => {
    setQuestionCounts((prev) => (prev[videoId] === n ? prev : { ...prev, [videoId]: n }));
  }, []);

  const sortedTopics = useMemo(
    () => [...course.topics].sort((a, b) => a.displayOrder - b.displayOrder),
    [course.topics]
  );

  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <div>
          <h3 className="font-heading text-base font-semibold text-foreground">Course Topics</h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            {course.topics.length} topic{course.topics.length === 1 ? "" : "s"} ·{" "}
            {course.topics.reduce((a, t) => a + t.videos.length, 0)} videos
          </p>
        </div>

        <TopicsTable
          courseId={course.id}
          topics={sortedTopics}
          apiBase="/api/university"
          readOnly={readOnly}
          onRefresh={onRefresh}
        />
      </div>

      {/* Videos by Topic */}
      {sortedTopics.length > 0 && (
        <div className="space-y-3">
          <div>
            <h4 className="font-heading text-sm font-semibold text-foreground">Videos by Topic</h4>
            <p className="text-xs text-muted-foreground mt-0.5">
              Manage video lessons and interactive checkpoints inside each saved topic.
            </p>
          </div>
          <div className="space-y-3">
            {sortedTopics.map((topic, idx) => (
              <Card
                key={topic.id}
                className="overflow-hidden rounded-lg border-border bg-card p-0 shadow-sm"
              >
                <div className="flex items-center justify-between gap-2 px-4 py-2.5 bg-muted/20 border-b border-border">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-primary text-xs font-semibold shrink-0">
                      {idx + 1}
                    </span>
                    <span className="font-medium text-sm text-foreground truncate">{topic.title}</span>
                    <span className="text-xs text-muted-foreground shrink-0">
                      ({topic.videos.length} video{topic.videos.length === 1 ? "" : "s"})
                    </span>
                  </div>
                  {!readOnly && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-8 gap-1 text-xs shrink-0"
                      onClick={() => setAddVideoFor(topic)}
                    >
                      <Plus className="h-3.5 w-3.5" /> Add Video
                    </Button>
                  )}
                </div>
                <div className="p-3">
                  {topic.videos.length === 0 ? (
                    <div className="text-center py-4">
                      <p className="text-xs text-muted-foreground">No videos in this topic yet</p>
                    </div>
                  ) : (
                    <ul className="divide-y divide-border">
                      {topic.videos.map((v, vi) => {
                        const qOpen = questionsOpenFor === v.id;
                        const qCount = questionCounts[v.id] ?? 0;
                        return (
                          <li key={v.id} className="-mx-2 px-2 rounded">
                            <div className="flex items-center gap-3 py-2.5 transition-colors hover:bg-muted/40">
                              <span className="flex h-7 w-7 items-center justify-center rounded-md bg-accent/10 text-accent text-[11px] font-semibold shrink-0">
                                {vi + 1}
                              </span>
                              <div className="min-w-0 flex-1">
                                <p className="text-sm font-medium text-foreground truncate">{v.title}</p>
                                <p className="text-xs text-muted-foreground truncate">
                                  {v.source === "UPLOAD"
                                    ? "Uploaded video"
                                    : v.source === "YOUTUBE"
                                    ? "YouTube"
                                    : "External URL"}
                                </p>
                              </div>
                              {qCount > 0 && (
                                <Badge
                                  variant="outline"
                                  className="gap-1 border-accent/30 bg-accent/5 text-accent text-[10px]"
                                  title={`${qCount} question${qCount === 1 ? "" : "s"}`}
                                >
                                  <ListChecks className="h-3 w-3" />
                                  {qCount}
                                </Badge>
                              )}
                              {v.isPublished ? (
                                <Badge className="bg-success/15 text-success text-[10px]">{t("common.published")}</Badge>
                              ) : (
                                <Badge variant="outline" className="text-muted-foreground text-[10px]">
                                  Draft
                                </Badge>
                              )}
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-7 gap-1 text-xs"
                                onClick={() => setPreviewVideo(v)}
                              >
                                <Eye className="h-3 w-3" /> View
                              </Button>
                              {!readOnly && (
                                <>
                                  <Button
                                    variant={qOpen ? "secondary" : "ghost"}
                                    size="icon"
                                    aria-label="Manage questions"
                                    aria-pressed={qOpen}
                                    className={cn(
                                      "h-7 w-7 shrink-0",
                                      qOpen ? "text-accent" : "text-muted-foreground hover:text-accent"
                                    )}
                                    onClick={() => setQuestionsOpenFor(qOpen ? null : v.id)}
                                  >
                                    <ListChecks className="h-3.5 w-3.5" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    aria-label="Edit video"
                                    className="h-7 w-7 text-muted-foreground hover:text-foreground"
                                    onClick={() => setEditVideo(v)}
                                  >
                                    <Pencil className="h-3.5 w-3.5" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    aria-label="Delete video"
                                    className="h-7 w-7 text-muted-foreground hover:text-destructive"
                                    onClick={() => setDeleteVideo(v)}
                                  >
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </Button>
                                </>
                              )}
                              <VideoQuestionsBadge
                                videoId={v.id}
                                active={!qOpen}
                                reportCount={reportCount}
                              />
                            </div>
                            {!readOnly && qOpen && (
                              <div className="pb-3 pt-0.5">
                                <VideoQuestionsPanel
                                  videoId={v.id}
                                  videoTitle={v.title}
                                  onClose={() => setQuestionsOpenFor(null)}
                                  reportCount={reportCount}
                                />
                              </div>
                            )}
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}

      <Dialog open={!!previewVideo} onOpenChange={(v) => !v && setPreviewVideo(null)}>
        <DialogContent className="w-[95vw] max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <VideoIcon className="h-4 w-4 text-accent" />
              {previewVideo?.title}
            </DialogTitle>
            {previewVideo?.description && (
              <DialogDescription>{previewVideo.description}</DialogDescription>
            )}
          </DialogHeader>
          {previewVideo && (
            <div className="aspect-video w-full overflow-hidden rounded-lg bg-black">
              {previewVideo.source === "YOUTUBE" ? (
                <iframe
                  src={previewVideo.videoUrl}
                  title={previewVideo.title}
                  className="h-full w-full"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                />
              ) : (
                <video
                  src={previewVideo.videoUrl}
                  controls
                  className="h-full w-full"
                />
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {!readOnly && (
        <>
          <VideoFormDialog
            open={!!addVideoFor}
            onOpenChange={(v) => !v && setAddVideoFor(null)}
            courseId={course.id}
            topicId={addVideoFor?.id || null}
            topics={course.topics}
            onSaved={() => {
              onRefresh();
              setAddVideoFor(null);
            }}
          />
          <VideoFormDialog
            open={!!editVideo}
            onOpenChange={(v) => !v && setEditVideo(null)}
            courseId={course.id}
            topicId={editVideo?.topicId || null}
            topics={course.topics}
            target={editVideo}
            onSaved={() => {
              onRefresh();
              setEditVideo(null);
            }}
          />
          <AlertDialog
            open={!!deleteVideo}
            onOpenChange={(v) => !v && setDeleteVideo(null)}
          >
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete video?</AlertDialogTitle>
                <AlertDialogDescription>
                  <strong>{deleteVideo?.title}</strong> will be permanently removed.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
                <AlertDialogAction
                  className="bg-destructive text-white hover:bg-destructive/90"
                  onClick={async () => {
                    if (!deleteVideo) return;
                    try {
                      await apiPost(
                        `/api/university/videos/${deleteVideo.id}`,
                        null,
                        { method: "DELETE" }
                      );
                      toast({ title: "Video deleted" });
                      setDeleteVideo(null);
                      onRefresh();
                    } catch {
                      /* toast */
                    }
                  }}
                >
                  Delete
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </>
      )}
    </div>
  );
}

function VideoFormDialog({
  open,
  onOpenChange,
  courseId,
  topicId,
  topics,
  target,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  courseId: string;
  topicId: string | null;
  topics: TopicRow[];
  target?: VideoRow | null;
  onSaved: () => void;
}) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [selectedTopicId, setSelectedTopicId] = useState<string>(topicId || "");
  const [source, setSource] = useState<"UPLOAD" | "YOUTUBE" | "URL">("UPLOAD");
  const [videoUrl, setVideoUrl] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [thumbFile, setThumbFile] = useState<File | null>(null);
  const [displayOrder, setDisplayOrder] = useState("");
  const [isPublished, setIsPublished] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingFile, setUploadingFile] = useState(false);
  const videoFileInputRef = useRef<HTMLInputElement>(null);
  const thumbInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (target) {
      setTitle(target.title);
      setDescription(target.description || "");
      setSelectedTopicId(topicId || "");
      setSource(target.source);
      setVideoUrl(target.source !== "UPLOAD" ? target.videoUrl : "");
      setDisplayOrder(String(target.displayOrder));
      setIsPublished(target.isPublished);
    } else if (open) {
      setTitle("");
      setDescription("");
      setSelectedTopicId(topicId || "");
      setSource("UPLOAD");
      setVideoUrl("");
      setDisplayOrder("");
      setIsPublished(true);
    }
    setFile(null);
    setThumbFile(null);
    if (videoFileInputRef.current) videoFileInputRef.current.value = "";
    if (thumbInputRef.current) thumbInputRef.current.value = "";
  }, [target, open, topicId]);

  async function submit() {
    if (!title.trim()) {
      toast({ title: "Title required", variant: "destructive" });
      return;
    }
    if (!selectedTopicId) {
      toast({ title: "Select a topic", variant: "destructive" });
      return;
    }
    if (source === "UPLOAD" && !file && !target) {
      toast({ title: "Video file required", variant: "destructive" });
      return;
    }
    if (source !== "UPLOAD" && !videoUrl.trim() && !target) {
      toast({ title: "Video URL required", variant: "destructive" });
      return;
    }

    const fd = new FormData();
    fd.append("title", title.trim());
    fd.append("description", description.trim());
    fd.append("topicId", selectedTopicId);
    fd.append("source", source);
    if (source !== "UPLOAD") fd.append("videoUrl", videoUrl.trim());
    if (file) fd.append("file", file);
    if (thumbFile) fd.append("thumbnail", thumbFile);
    if (displayOrder) fd.append("displayOrder", displayOrder);
    fd.append("isPublished", String(isPublished));

    setSaving(true);
    setUploadingFile(!!file);
    try {
      const hasFiles = !!file || !!thumbFile;
      if (!hasFiles && source !== "UPLOAD") {
        const jsonBody = {
          title: title.trim(),
          description: description.trim(),
          topicId: selectedTopicId,
          source,
          videoUrl: videoUrl.trim(),
          ...(displayOrder ? { displayOrder } : {}),
          isPublished,
        };
        if (target) {
          await apiPost(`/api/university/videos/${target.id}`, jsonBody, { method: "PUT" });
          toast({ title: "Video updated" });
        } else {
          await apiPost(`/api/university/courses/${courseId}/videos`, jsonBody);
          toast({ title: "Video added" });
        }
      } else if (target) {
        const res = await authFetch(`/api/university/videos/${target.id}`, {
          method: "PUT",
          body: fd,
          credentials: "include",
        });
        const text = await res.text();
        let json: { error?: string } = {};
        try {
          json = text ? JSON.parse(text) : {};
        } catch {
          json = {};
        }
        if (!res.ok) throw new Error(json.error || "Failed");
        markApiCacheStale();
        toast({ title: "Video updated" });
      } else {
        await apiUpload(`/api/university/courses/${courseId}/videos`, fd);
        toast({ title: "Video added" });
      }
      onSaved();
    } catch (e) {
      if (target && (file || thumbFile || source === "UPLOAD") && e instanceof Error) {
        toast({ title: "Error", description: e.message, variant: "destructive" });
      }
    } finally {
      setSaving(false);
      setUploadingFile(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="animate-scale-in w-[95vw] max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-heading text-lg font-semibold">
            {target ? "Edit Video" : "Add Video Lesson"}
          </DialogTitle>
          <DialogDescription>
            Upload a video file, paste a YouTube link, or use an external URL.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-1 scrollbar-thin">
          <div className="space-y-1.5">
            <Label htmlFor="v-title" className="text-xs font-medium text-muted-foreground">
              Title
            </Label>
            <Input
              id="v-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Lesson 1 — Marketing Mix"
              className="h-9 rounded-lg"
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-muted-foreground">Topic</Label>
              <Select value={selectedTopicId} onValueChange={setSelectedTopicId}>
                <SelectTrigger className="w-full h-9 rounded-lg">
                  <SelectValue placeholder="Select topic" />
                </SelectTrigger>
                <SelectContent>
                  {topics.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-muted-foreground">Source</Label>
              <Select
                value={source}
                onValueChange={(v) => setSource(v as "UPLOAD" | "YOUTUBE" | "URL")}
              >
                <SelectTrigger className="w-full h-9 rounded-lg">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="UPLOAD">Upload file</SelectItem>
                  <SelectItem value="YOUTUBE">YouTube</SelectItem>
                  <SelectItem value="URL">External URL</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="v-desc" className="text-xs font-medium text-muted-foreground">
              Description (optional)
            </Label>
            <Textarea
              id="v-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              className="rounded-lg"
            />
          </div>
          {source === "UPLOAD" && (
            <div className="space-y-1.5">
              <Label htmlFor="v-file" className="text-xs font-medium text-muted-foreground">
                Video file (.mp4, .webm, .mov, .mkv)
              </Label>
              <Input
                ref={videoFileInputRef}
                id="v-file"
                type="file"
                onChange={(e) => setFile(e.target.files?.[0] || null)}
                accept=".mp4,.webm,.mov,.mkv"
              />
              {file && (
                <p className="text-xs text-muted-foreground">
                  Selected: {file.name} ({(file.size / (1024 * 1024)).toFixed(1)} MB)
                </p>
              )}
              {target && !file && (
                <p className="text-xs text-muted-foreground">Leave empty to keep existing video.</p>
              )}
            </div>
          )}
          {source !== "UPLOAD" && (
            <div className="space-y-1.5">
              <Label htmlFor="v-url" className="text-xs font-medium text-muted-foreground">
                {source === "YOUTUBE" ? "YouTube URL" : "Video URL"}
              </Label>
              <Input
                id="v-url"
                value={videoUrl}
                onChange={(e) => setVideoUrl(e.target.value)}
                placeholder={
                  source === "YOUTUBE"
                    ? "https://www.youtube.com/watch?v=…"
                    : "https://example.com/video.mp4"
                }
                className="h-9 rounded-lg"
              />
              {source === "YOUTUBE" && (
                <p className="text-xs text-muted-foreground">
                  Accepts watch URLs, youtu.be links and embed URLs.
                </p>
              )}
            </div>
          )}
          <div className="space-y-1.5">
            <Label htmlFor="v-thumb" className="text-xs font-medium text-muted-foreground">
              Thumbnail (optional)
            </Label>
            <Input
              ref={thumbInputRef}
              id="v-thumb"
              type="file"
              accept="image/*"
              onChange={(e) => setThumbFile(e.target.files?.[0] || null)}
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="v-order" className="text-xs font-medium text-muted-foreground">
                Display Order (optional)
              </Label>
              <Input
                id="v-order"
                type="number"
                value={displayOrder}
                onChange={(e) => setDisplayOrder(e.target.value)}
                placeholder="auto"
                className="h-9 rounded-lg"
              />
            </div>
            <div className="flex items-center justify-between rounded-lg border border-border px-3">
              <Label htmlFor="v-pub" className="text-sm font-medium">
                Published
              </Label>
              <Switch id="v-pub" checked={isPublished} onCheckedChange={setIsPublished} />
            </div>
          </div>
        </div>
        <DialogFooter className="flex-col gap-3">
          {uploadingFile && (
            <div className="w-full flex items-center gap-2 rounded-lg bg-soft-sage/40 px-3 py-2.5">
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-primary/30 border-t-primary" />
              <span className="text-xs text-muted-foreground">
                Uploading video file{file ? ` (${(file.size / (1024 * 1024)).toFixed(1)} MB)` : ""}… large files may take a minute.
              </span>
            </div>
          )}
          <div className="flex gap-2">
            <Button variant="outline" className="h-9" onClick={() => onOpenChange(false)} disabled={saving}>
              Cancel
            </Button>
            <Button disabled={saving} className="h-9" onClick={submit}>
              {saving
                ? uploadingFile
                  ? "Uploading…"
                  : "Saving…"
                : target ? "Save Changes" : "Add Video"}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ============= MATERIALS TAB =============
function MaterialsTab({
  course,
  onRefresh,
  readOnly = false,
}: {
  course: CourseDetail;
  onRefresh: () => void;
  readOnly?: boolean;
}) {
  const { t } = useI18n();
  const [addOpen, setAddOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<MaterialRow | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<MaterialRow | null>(null);

  const grouped = useMemo(() => {
    const map = new Map<string, { topicId: string; topicTitle: string | null; items: MaterialRow[] }>();
    for (const m of course.materials) {
      const key = m.topic?.id || "none";
      if (!map.has(key)) {
        map.set(key, { topicId: key, topicTitle: m.topic?.title || null, items: [] });
      }
      map.get(key)!.items.push(m);
    }
    return Array.from(map.values());
  }, [course.materials]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-heading text-base font-semibold text-foreground">
            Learning Materials
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            {course.materials.length} materials across this course
          </p>
        </div>
        {!readOnly && (
          <Button className="h-9 gap-2" onClick={() => setAddOpen(true)}>
            <Plus className="h-4 w-4" /> Add Material
          </Button>
        )}
      </div>

      {course.materials.length === 0 ? (
        <EmptyState
          icon={<FileText className="h-5 w-5" />}
          title={t("common.learningMaterials")}
          description={
            readOnly
              ? "No learning materials have been added to this course yet."
              : "Add downloadable PDFs, docs, slide decks or external links to support the video lessons."
          }
          action={
            !readOnly ? (
              <Button onClick={() => setAddOpen(true)} className="gap-2">
                <Plus className="h-4 w-4" /> Add Material
              </Button>
            ) : undefined
          }
        />
      ) : (
        <div className="space-y-3">
          {grouped.map((g) => (
            <Card key={g.topicId} className="overflow-hidden rounded-lg border-border bg-card p-0 shadow-sm">
              <div className="border-b border-border bg-muted/30 px-4 py-2.5">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  {g.topicTitle || "Unassigned materials"}
                </p>
              </div>
              <ul className="divide-y divide-border">
                {g.items.map((m) => (
                  <li
                    key={m.id}
                    className="flex items-center gap-3 p-3 transition-colors hover:bg-muted/40"
                  >
                    <Badge
                      variant="outline"
                      className="text-[10px] uppercase tracking-wider shrink-0 bg-muted/40"
                    >
                      {m.type}
                    </Badge>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-foreground truncate">{m.title}</p>
                      {m.description && (
                        <p className="text-xs text-muted-foreground truncate">{m.description}</p>
                      )}
                    </div>
                    <a
                      href={m.fileUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-muted-foreground transition-colors hover:text-accent"
                      aria-label="Open material"
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                    </a>
                    {!readOnly && (
                      <>
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label="Edit material"
                          className="h-8 w-8 text-muted-foreground hover:text-foreground"
                          onClick={() => setEditTarget(m)}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label="Delete material"
                          className="h-8 w-8 text-muted-foreground hover:text-destructive"
                          onClick={() => setDeleteTarget(m)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </>
                    )}
                  </li>
                ))}
              </ul>
            </Card>
          ))}
        </div>
      )}

      {!readOnly && (
        <>
          <MaterialFormDialog
            open={addOpen}
            onOpenChange={setAddOpen}
            course={course}
            onSaved={() => {
              onRefresh();
              setAddOpen(false);
            }}
          />
          <MaterialFormDialog
            open={!!editTarget}
            onOpenChange={(v) => !v && setEditTarget(null)}
            course={course}
            target={editTarget}
            onSaved={() => {
              onRefresh();
              setEditTarget(null);
            }}
          />
          <AlertDialog
            open={!!deleteTarget}
            onOpenChange={(v) => !v && setDeleteTarget(null)}
          >
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete material?</AlertDialogTitle>
                <AlertDialogDescription>
                  <strong>{deleteTarget?.title}</strong> will be permanently removed.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
                <AlertDialogAction
                  className="bg-destructive text-white hover:bg-destructive/90"
                  onClick={async () => {
                    if (!deleteTarget) return;
                    try {
                      await apiPost(
                        `/api/university/materials/${deleteTarget.id}`,
                        null,
                        { method: "DELETE" }
                      );
                      toast({ title: "Material deleted" });
                      setDeleteTarget(null);
                      onRefresh();
                    } catch {
                      /* toast */
                    }
                  }}
                >
                  Delete
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </>
      )}
    </div>
  );
}

function MaterialFormDialog({
  open,
  onOpenChange,
  course,
  target,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  course: CourseDetail;
  target?: MaterialRow | null;
  onSaved: () => void;
}) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [topicId, setTopicId] = useState<string>("none");
  const [type, setType] = useState<"PDF" | "DOC" | "PRESENTATION" | "LINK">("PDF");
  const [fileUrl, setFileUrl] = useState("");
  const [isPublished, setIsPublished] = useState(true);
  const [file, setFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (target) {
      setTitle(target.title);
      setDescription(target.description || "");
      setTopicId(target.topic?.id || "none");
      setType(target.type);
      setFileUrl(target.type === "LINK" ? target.fileUrl : "");
      setIsPublished(target.isPublished);
    } else if (open) {
      setTitle("");
      setDescription("");
      setTopicId("none");
      setType("PDF");
      setFileUrl("");
      setIsPublished(true);
    }
    setFile(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }, [target, open]);

  async function submit() {
    if (!title.trim()) {
      toast({ title: "Title required", variant: "destructive" });
      return;
    }
    if (type === "LINK" && !fileUrl.trim() && !target) {
      toast({ title: "Link URL required", variant: "destructive" });
      return;
    }
    if (type !== "LINK" && !file && !target) {
      toast({ title: "File required", variant: "destructive" });
      return;
    }

    const fd = new FormData();
    fd.append("title", title.trim());
    fd.append("description", description.trim());
    fd.append("topicId", topicId === "none" ? "" : topicId);
    fd.append("type", type);
    if (type === "LINK") fd.append("fileUrl", fileUrl.trim());
    if (file) fd.append("file", file);
    fd.append("isPublished", String(isPublished));

    setSaving(true);
    try {
      if (target) {
        const res = await authFetch(`/api/university/materials/${target.id}`, {
          method: "PUT",
          body: fd,
          credentials: "include",
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || "Failed");
        markApiCacheStale();
        toast({ title: "Material updated" });
      } else {
        await apiUpload(`/api/university/courses/${course.id}/materials`, fd);
        toast({ title: "Material added" });
      }
      onSaved();
    } catch (e) {
      if (e instanceof Error) {
        toast({ title: "Error", description: e.message, variant: "destructive" });
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="animate-scale-in w-[95vw] max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-heading text-lg font-semibold">
            {target ? "Edit Material" : "Add Learning Material"}
          </DialogTitle>
          <DialogDescription>
            Upload a downloadable file or attach an external link.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-1 scrollbar-thin">
          <div className="space-y-1.5">
            <Label htmlFor="m-title" className="text-xs font-medium text-muted-foreground">
              Title
            </Label>
            <Input
              id="m-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Lesson 1 — Reference Slides"
              className="h-9 rounded-lg"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="m-desc" className="text-xs font-medium text-muted-foreground">
              Description (optional)
            </Label>
            <Textarea
              id="m-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              className="rounded-lg"
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-muted-foreground">Topic (optional)</Label>
              <Select value={topicId} onValueChange={setTopicId}>
                <SelectTrigger className="w-full h-9 rounded-lg">
                  <SelectValue placeholder="No topic" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No topic</SelectItem>
                  {course.topics.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-muted-foreground">Type</Label>
              <Select
                value={type}
                onValueChange={(v) => setType(v as "PDF" | "DOC" | "PRESENTATION" | "LINK")}
              >
                <SelectTrigger className="w-full h-9 rounded-lg">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="PDF">PDF</SelectItem>
                  <SelectItem value="DOC">Document</SelectItem>
                  <SelectItem value="PRESENTATION">Presentation</SelectItem>
                  <SelectItem value="LINK">External Link</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {type === "LINK" ? (
            <div className="space-y-1.5">
              <Label htmlFor="m-url" className="text-xs font-medium text-muted-foreground">
                Link URL
              </Label>
              <Input
                id="m-url"
                value={fileUrl}
                onChange={(e) => setFileUrl(e.target.value)}
                placeholder="https://…"
                className="h-9 rounded-lg"
              />
            </div>
          ) : (
            <div className="space-y-1.5">
              <Label htmlFor="m-file" className="text-xs font-medium text-muted-foreground">
                File (.pdf, .doc, .docx, .ppt, .pptx, .txt)
              </Label>
              <Input
                ref={fileInputRef}
                id="m-file"
                type="file"
                onChange={(e) => setFile(e.target.files?.[0] || null)}
                accept=".pdf,.doc,.docx,.ppt,.pptx,.txt"
              />
              {target && !file && (
                <p className="text-xs text-muted-foreground">Leave empty to keep existing file.</p>
              )}
            </div>
          )}

          <div className="flex items-center justify-between rounded-lg border border-border p-3">
            <Label htmlFor="m-pub" className="text-sm font-medium">
              Published
            </Label>
            <Switch id="m-pub" checked={isPublished} onCheckedChange={setIsPublished} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" className="h-9" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button disabled={saving} className="h-9" onClick={submit}>
            {saving ? "Saving…" : target ? "Save Changes" : "Add Material"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ============= ASSIGNMENTS TAB =============
function AssignmentsTab({
  course,
  onRefresh,
  readOnly = false,
}: {
  course: CourseDetail;
  onRefresh: () => void;
  readOnly?: boolean;
}) {
  const { t } = useI18n();
  const navigate = useAppStore((s) => s.navigate);
  const [addOpen, setAddOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<AssignmentRow | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<AssignmentRow | null>(null);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-heading text-base font-semibold text-foreground">
            Course Assignments
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            {course.assignments.length} assignment{course.assignments.length === 1 ? "" : "s"} ·{" "}
            {course.assignments.reduce((a, x) => a + x.submissionsCount, 0)} total submissions
          </p>
        </div>
        {!readOnly && (
          <Button className="h-9 gap-2" onClick={() => setAddOpen(true)}>
            <Plus className="h-4 w-4" /> Add Assignment
          </Button>
        )}
      </div>

      {course.assignments.length === 0 ? (
        <EmptyState
          icon={<ClipboardList className="h-5 w-5" />}
          title={t("common.assignments")}
          description={
            readOnly
              ? "No assignments have been added to this course yet."
              : "Add assignments to test student understanding and award completion certificates."
          }
          action={
            !readOnly ? (
              <Button onClick={() => setAddOpen(true)} className="gap-2">
                <Plus className="h-4 w-4" /> Add Assignment
              </Button>
            ) : undefined
          }
        />
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {course.assignments.map((a) => (
            <Card
              key={a.id}
              className="rounded-lg p-4 space-y-3 border-border bg-card shadow-sm transition-shadow hover:shadow-md"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-heading font-semibold text-foreground truncate">{a.title}</p>
                  {a.dueDate && (
                    <p className="text-xs text-muted-foreground mt-0.5">Due {formatDate(a.dueDate)}</p>
                  )}
                </div>
                {a.isPublished ? (
                  <Badge className="bg-success/15 text-success shrink-0">{t("common.published")}</Badge>
                ) : (
                  <Badge variant="outline" className="text-muted-foreground shrink-0">
                    Draft
                  </Badge>
                )}
              </div>
              {a.description && (
                <p className="text-sm text-muted-foreground line-clamp-2">{a.description}</p>
              )}
              <div className="flex flex-wrap gap-2 text-xs">
                <Badge variant="outline" className="bg-accent/10 text-accent">
                  {a.submissionsCount} submission{a.submissionsCount === 1 ? "" : "s"}
                </Badge>
                {a.allowResubmission && (
                  <Badge variant="outline" className="text-muted-foreground">
                    Resubmission allowed
                  </Badge>
                )}
                {a.fileUrl && (
                  <a
                    href={a.fileUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-accent hover:underline"
                  >
                    <ExternalLink className="h-3 w-3" /> Brief
                  </a>
                )}
              </div>
              <Separator />
              <div className="flex items-center justify-between">
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 gap-1"
                  onClick={() => navigate(["university", "submissions"], { assignmentId: a.id })}
                >
                  <ClipboardList className="h-3.5 w-3.5" /> View Submissions
                </Button>
                {!readOnly && (
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label="Edit assignment"
                      className="h-8 w-8 text-muted-foreground hover:text-foreground"
                      onClick={() => setEditTarget(a)}
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label="Delete assignment"
                      className="h-8 w-8 text-muted-foreground hover:text-destructive"
                      onClick={() => setDeleteTarget(a)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}

      {!readOnly && (
        <>
          <AssignmentFormDialog
            open={addOpen}
            onOpenChange={setAddOpen}
            courseId={course.id}
            onSaved={() => {
              onRefresh();
              setAddOpen(false);
            }}
          />
          <AssignmentFormDialog
            open={!!editTarget}
            onOpenChange={(v) => !v && setEditTarget(null)}
            courseId={course.id}
            target={editTarget}
            onSaved={() => {
              onRefresh();
              setEditTarget(null);
            }}
          />
          <AlertDialog
            open={!!deleteTarget}
            onOpenChange={(v) => !v && setDeleteTarget(null)}
          >
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete assignment?</AlertDialogTitle>
                <AlertDialogDescription>
                  This will permanently delete <strong>{deleteTarget?.title}</strong> and all its
                  submissions.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
                <AlertDialogAction
                  className="bg-destructive text-white hover:bg-destructive/90"
                  onClick={async () => {
                    if (!deleteTarget) return;
                    try {
                      await apiPost(
                        `/api/university/assignments/${deleteTarget.id}`,
                        null,
                        { method: "DELETE" }
                      );
                      toast({ title: "Assignment deleted" });
                      setDeleteTarget(null);
                      onRefresh();
                    } catch {
                      /* toast */
                    }
                  }}
                >
                  Delete
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </>
      )}
    </div>
  );
}

function AssignmentFormDialog({
  open,
  onOpenChange,
  courseId,
  target,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  courseId: string;
  target?: AssignmentRow | null;
  onSaved: () => void;
}) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [instructions, setInstructions] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [isPublished, setIsPublished] = useState(true);
  const [allowResubmission, setAllowResubmission] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [clearFile, setClearFile] = useState(false);
  const [saving, setSaving] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (target) {
      setTitle(target.title);
      setDescription(target.description || "");
      setInstructions(target.instructions || "");
      setDueDate(target.dueDate ? target.dueDate.slice(0, 10) : "");
      setIsPublished(target.isPublished);
      setAllowResubmission(target.allowResubmission);
    } else if (open) {
      setTitle("");
      setDescription("");
      setInstructions("");
      setDueDate("");
      setIsPublished(true);
      setAllowResubmission(false);
    }
    setFile(null);
    setClearFile(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }, [target, open]);

  async function submit() {
    if (!title.trim()) {
      toast({ title: "Title required", variant: "destructive" });
      return;
    }
    const fd = new FormData();
    fd.append("title", title.trim());
    fd.append("description", description.trim());
    fd.append("instructions", instructions.trim());
    if (dueDate) fd.append("dueDate", dueDate);
    fd.append("isPublished", String(isPublished));
    fd.append("allowResubmission", String(allowResubmission));
    if (file) fd.append("file", file);
    if (clearFile) fd.append("clearFile", "true");

    setSaving(true);
    try {
      if (target) {
        const res = await authFetch(`/api/university/assignments/${target.id}`, {
          method: "PUT",
          body: fd,
          credentials: "include",
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || "Failed");
        markApiCacheStale();
        toast({ title: "Assignment updated" });
      } else {
        await apiUpload(`/api/university/courses/${courseId}/assignments`, fd);
        toast({ title: "Assignment added" });
      }
      onSaved();
    } catch (e) {
      if (e instanceof Error) {
        toast({ title: "Error", description: e.message, variant: "destructive" });
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="animate-scale-in w-[95vw] max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-heading text-lg font-semibold">
            {target ? "Edit Assignment" : "Add Assignment"}
          </DialogTitle>
          <DialogDescription>Create a task for students to complete and submit.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-1 scrollbar-thin">
          <div className="space-y-1.5">
            <Label htmlFor="a-title" className="text-xs font-medium text-muted-foreground">
              Title
            </Label>
            <Input
              id="a-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Final Project — Brand Identity"
              className="h-9 rounded-lg"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="a-desc" className="text-xs font-medium text-muted-foreground">
              Short Description
            </Label>
            <Textarea
              id="a-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              className="rounded-lg"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="a-ins" className="text-xs font-medium text-muted-foreground">
              Detailed Instructions
            </Label>
            <Textarea
              id="a-ins"
              value={instructions}
              onChange={(e) => setInstructions(e.target.value)}
              rows={4}
              placeholder="Step-by-step instructions students will see…"
              className="rounded-lg"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="a-due" className="text-xs font-medium text-muted-foreground">
              Due Date (optional)
            </Label>
            <Input
              id="a-due"
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              className="h-9 rounded-lg"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="a-file" className="text-xs font-medium text-muted-foreground">
              Attachment File (optional)
            </Label>
            <Input
              ref={fileInputRef}
              id="a-file"
              type="file"
              onChange={(e) => {
                const picked = e.target.files?.[0] || null;
                setFile(picked);
                if (picked) setClearFile(false);
              }}
              accept=".pdf,.doc,.docx,.ppt,.pptx,.txt"
            />
            {target?.fileUrl && (
              <div className="flex items-center gap-2 text-xs">
                <a
                  href={target.fileUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-accent hover:underline inline-flex items-center gap-1"
                >
                  <ExternalLink className="h-3 w-3" /> Current file
                </a>
                <label className="flex items-center gap-1 text-muted-foreground">
                  <Checkbox checked={clearFile} onCheckedChange={(v) => setClearFile(!!v)} />
                  Remove existing file
                </label>
              </div>
            )}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="flex items-center justify-between rounded-lg border border-border p-3">
              <Label htmlFor="a-pub" className="text-sm font-medium">
                Published
              </Label>
              <Switch id="a-pub" checked={isPublished} onCheckedChange={setIsPublished} />
            </div>
            <div className="flex items-center justify-between rounded-lg border border-border p-3">
              <Label htmlFor="a-resub" className="text-sm font-medium">
                Allow resubmission
              </Label>
              <Switch
                id="a-resub"
                checked={allowResubmission}
                onCheckedChange={setAllowResubmission}
              />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" className="h-9" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button disabled={saving} className="h-9" onClick={submit}>
            {saving ? "Saving…" : target ? "Save Changes" : "Add Assignment"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ============= CERTIFICATE TAB =============
function CertificateTab({ course, onRefresh }: { course: CourseDetail; onRefresh: () => void }) {
  const { t } = useI18n();
  const branding = useAppStore((s) => s.branding);
  const template = course.certificateTemplate;
  const defaultOrg = branding.appName || "CourseLearn";
  const [isEnabled, setIsEnabled] = useState(template?.isEnabled ?? true);
  const [title, setTitle] = useState(template?.title || "Certificate of Completion");
  const [bodyText, setBodyText] = useState(
    template?.bodyText ||
      "This certificate is proudly presented to {{studentName}} for successfully completing the course {{courseName}}."
  );
  const [organizationName, setOrganizationName] = useState(
    template?.organizationName && template.organizationName !== "CourseLearn"
      ? template.organizationName
      : defaultOrg
  );
  const [layout, setLayout] = useState<"CLASSIC" | "MODERN" | "MINIMAL">(
    template?.layout || "CLASSIC"
  );
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (template) {
      setIsEnabled(template.isEnabled);
      setTitle(template.title);
      setBodyText(template.bodyText);
      setOrganizationName(
        template.organizationName && template.organizationName !== "CourseLearn"
          ? template.organizationName
          : defaultOrg
      );
      setLayout(template.layout);
    } else {
      setOrganizationName(defaultOrg);
    }
  }, [template, defaultOrg]);

  async function save() {
    setSaving(true);
    try {
      await apiPost(
        `/api/university/courses/${course.id}/certificate`,
        {
          isEnabled,
          title,
          bodyText,
          organizationName,
          layout,
        },
        { method: "PUT" }
      );
      toast({ title: "Certificate template saved" });
      onRefresh();
    } catch {
      /* toast */
    } finally {
      setSaving(false);
    }
  }

  const previewText = bodyText
    .replace(/\{\{studentName\}\}/g, "Aisha Khalid")
    .replace(/\{\{courseName\}\}/g, course.title)
    .replace(/\{\{issueDate\}\}/g, formatDate(new Date()))
    .replace(/\{\{certificateNumber\}\}/g, "UNI-SAMPLE-001")
    .replace(/\{\{organizationName\}\}/g, organizationName);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-heading text-base font-semibold text-foreground">
            Completion Certificate
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Configure the template issued to students who complete this course.
          </p>
        </div>
        <Button className="h-9 gap-2" disabled={saving} onClick={save}>
          <Save className="h-4 w-4" /> {saving ? "Saving…" : "Save Template"}
        </Button>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="rounded-lg p-5 space-y-3 border-border bg-card shadow-sm">
          <CardHeader className="p-0">
            <CardTitle className="text-sm font-heading font-semibold">
              Template Settings
            </CardTitle>
            <CardDescription className="mt-1">
              Use placeholders for dynamic content.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0 space-y-3">
            <div className="rounded-lg border border-accent/20 bg-soft-sage/50 p-3">
              <div className="flex items-start gap-2">
                <div className="flex h-6 w-6 items-center justify-center rounded-md bg-accent/15 text-accent shrink-0 mt-0.5">
                  <Info className="h-3.5 w-3.5" />
                </div>
                <div className="text-xs space-y-1.5">
                  <p className="font-semibold text-foreground">How certificates work</p>
                  <p className="text-muted-foreground">
                    Certificates are <strong>automatically issued</strong> to students when they
                    complete all video lessons in this course. You have three options:
                  </p>
                  <ul className="space-y-1 text-muted-foreground pl-3 list-disc">
                    <li>
                      <strong>Save a template (enabled)</strong> → Your custom design is used.
                    </li>
                    <li>
                      <strong>Save a template (disabled)</strong> → No certificate is issued.
                    </li>
                    <li>
                      <strong>Don&apos;t save a template</strong> → A default certificate with the
                      student&apos;s name is auto-generated.
                    </li>
                  </ul>
                </div>
              </div>
            </div>
            <div className="flex items-center justify-between rounded-lg border border-border p-3">
              <Label htmlFor="c-enabled" className="text-sm font-medium">
                Enable certificates for this course
              </Label>
              <Switch
                id="c-enabled"
                checked={isEnabled}
                onCheckedChange={setIsEnabled}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="c-title" className="text-xs font-medium text-muted-foreground">
                Certificate Title
              </Label>
              <Input
                id="c-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="h-9 rounded-lg"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="c-body" className="text-xs font-medium text-muted-foreground">
                Body Text
              </Label>
              <Textarea
                id="c-body"
                value={bodyText}
                onChange={(e) => setBodyText(e.target.value)}
                rows={4}
                className="rounded-lg"
              />
              <p className="text-xs text-muted-foreground">
                Placeholders:{" "}
                <code className="bg-muted px-1 py-0.5 rounded">{"{{studentName}}"}</code>{" "}
                <code className="bg-muted px-1 py-0.5 rounded">{"{{courseName}}"}</code>{" "}
                <code className="bg-muted px-1 py-0.5 rounded">{"{{issueDate}}"}</code>{" "}
                <code className="bg-muted px-1 py-0.5 rounded">{"{{certificateNumber}}"}</code>{" "}
                <code className="bg-muted px-1 py-0.5 rounded">{"{{organizationName}}"}</code>
              </p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="c-org" className="text-xs font-medium text-muted-foreground">
                  Organization Name
                </Label>
                <Input
                  id="c-org"
                  value={organizationName}
                  onChange={(e) => setOrganizationName(e.target.value)}
                  className="h-9 rounded-lg"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-muted-foreground">Layout</Label>
                <Select
                  value={layout}
                  onValueChange={(v) => setLayout(v as "CLASSIC" | "MODERN" | "MINIMAL")}
                >
                  <SelectTrigger className="w-full h-9 rounded-lg">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="CLASSIC">Classic</SelectItem>
                    <SelectItem value="MODERN">Modern</SelectItem>
                    <SelectItem value="MINIMAL">Minimal</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-lg p-5 space-y-3 border-border bg-card shadow-sm">
          <CardHeader className="p-0">
            <CardTitle className="text-sm font-heading font-semibold">Live Preview</CardTitle>
            <CardDescription className="mt-1">How the certificate will look.</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <CertificatePreview
              title={title}
              bodyText={previewText}
              organizationName={organizationName}
              layout={layout}
              studentName="Aisha Khalid"
              courseTitle={course.title}
              certNumber="UNI-SAMPLE-001"
              issueDate={formatDate(new Date())}
            />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function CertificatePreview({
  title,
  bodyText,
  organizationName,
  layout,
  studentName,
  certNumber,
  issueDate,
}: {
  title: string;
  bodyText: string;
  organizationName: string;
  layout: "CLASSIC" | "MODERN" | "MINIMAL";
  studentName: string;
  courseTitle: string;
  certNumber: string;
  issueDate: string;
}) {
  if (layout === "MINIMAL") {
    return (
      <div className="rounded-lg border border-border bg-card p-6 text-center">
        <p className="text-[10px] uppercase tracking-widest text-muted-foreground">
          {organizationName}
        </p>
        <p className="font-heading text-xl font-bold text-foreground mt-2">{title}</p>
        <p className="font-heading text-2xl font-bold text-accent mt-3">{studentName}</p>
        <p className="text-xs text-muted-foreground mt-2">{bodyText}</p>
        <Separator className="my-3" />
        <div className="flex items-center justify-between text-[10px] text-muted-foreground">
          <span>{issueDate}</span>
          <span>{certNumber}</span>
        </div>
      </div>
    );
  }
  if (layout === "MODERN") {
    return (
      <div className="rounded-lg border-2 border-accent/40 bg-gradient-to-br from-accent/[0.04] to-primary/[0.04] p-6">
        <div className="flex items-center justify-between">
          <Award className="h-8 w-8 text-accent" />
          <p className="text-[10px] uppercase tracking-widest text-muted-foreground">
            {organizationName}
          </p>
        </div>
        <div className="text-center mt-4">
          <p className="font-heading text-lg font-bold text-foreground">{title}</p>
          <p className="font-heading text-2xl font-bold text-accent mt-2">{studentName}</p>
          <p className="text-xs text-muted-foreground mt-2 max-w-xs mx-auto">{bodyText}</p>
        </div>
        <div className="flex items-center justify-between text-[10px] text-muted-foreground mt-4 pt-3 border-t border-border">
          <span>{issueDate}</span>
          <span className="font-mono">{certNumber}</span>
        </div>
      </div>
    );
  }
  // CLASSIC
  return (
    <div className="rounded-lg border-4 border-primary/30 bg-card p-6 text-center">
      <div className="border-b-2 border-accent/30 pb-3">
        <p className="text-[10px] uppercase tracking-[0.3em] text-muted-foreground">
          {organizationName}
        </p>
        <p className="font-heading text-xl font-bold text-foreground mt-1">{title}</p>
      </div>
      <p className="font-heading text-2xl font-bold text-primary mt-4">{studentName}</p>
      <p className="text-xs text-muted-foreground mt-3 max-w-xs mx-auto">{bodyText}</p>
      <div className="flex items-center justify-between text-[10px] text-muted-foreground mt-4 pt-3 border-t-2 border-accent/30">
        <span>{issueDate}</span>
        <span className="font-mono">{certNumber}</span>
      </div>
    </div>
  );
}

// ============= SETTINGS TAB =============
function SettingsTab({
  course,
  plans,
  onRefresh,
  onDeleted,
}: {
  course: CourseDetail;
  plans: SubscriptionPlanPublic[];
  onRefresh: () => void;
  onDeleted: () => void;
}) {
  const navigate = useAppStore((s) => s.navigate);
  const { t } = useI18n();
  const [title, setTitle] = useState(course.title);
  const [description, setDescription] = useState(course.description || "");
  const [category, setCategory] = useState(course.category || "");
  const [accessType, setAccessType] = useState<"FREE" | "PAID">(course.accessType);
  const [isPublished, setIsPublished] = useState(course.isPublished);
  const [planIds, setPlanIds] = useState<string[]>(course.planAccess.map((p) => p.planId));
  const [thumbnail, setThumbnail] = useState(course.thumbnail || "");
  const [uploadingThumb, setUploadingThumb] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  useEffect(() => {
    setTitle(course.title);
    setDescription(course.description || "");
    setCategory(course.category || "");
    setAccessType(course.accessType);
    setIsPublished(course.isPublished);
    setPlanIds(course.planAccess.map((p) => p.planId));
    setThumbnail(course.thumbnail || "");
  }, [course]);

  function togglePlan(id: string) {
    setPlanIds((cur) => (cur.includes(id) ? cur.filter((p) => p !== id) : [...cur, id]));
  }

  async function uploadThumbnail(file: File) {
    setUploadingThumb(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await apiUpload<{ thumbnail: string }>(
        `/api/university/courses/${course.id}/thumbnail`,
        fd
      );
      setThumbnail(res.thumbnail);
      toast({ title: "Thumbnail updated" });
      onRefresh();
    } catch {
      /* toast */
    } finally {
      setUploadingThumb(false);
    }
  }

  async function save() {
    if (!title.trim()) {
      toast({ title: "Title required", variant: "destructive" });
      return;
    }
    if (accessType === "PAID" && planIds.length === 0) {
      toast({ title: "Select at least one plan", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      await apiPost(
        `/api/university/courses/${course.id}`,
        {
          title: title.trim(),
          description: description.trim() || null,
          category: category.trim() || null,
          accessType,
          isPublished,
          thumbnail: thumbnail.trim() || null,
          planIds,
        },
        { method: "PUT" }
      );
      toast({ title: "Course updated" });
      onRefresh();
    } catch {
      /* toast */
    } finally {
      setSaving(false);
    }
  }

  async function doDelete() {
    try {
      await apiPost(`/api/university/courses/${course.id}`, null, { method: "DELETE" });
      toast({ title: "Course deleted", description: course.title });
      onDeleted();
    } catch {
      /* toast */
    }
  }

  return (
    <div className="space-y-4">
      <Card className="rounded-lg p-5 space-y-3 border-border bg-card shadow-sm">
        <CardHeader className="p-0">
          <CardTitle className="font-heading text-base font-semibold">Course Details</CardTitle>
          <CardDescription className="mt-1">
            Update the basic information about this course.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0 space-y-3">
          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-muted-foreground">Course Thumbnail</Label>
            <div className="flex flex-col sm:flex-row sm:items-center gap-3">
              <div className="h-20 w-32 overflow-hidden rounded-lg bg-muted flex items-center justify-center shrink-0 ring-1 ring-border">
                {thumbnail ? (
                  <img src={thumbnail} alt={course.title} className="h-full w-full object-cover" />
                ) : (
                  <VideoIcon className="h-6 w-6 text-muted-foreground" />
                )}
              </div>
              <div className="flex-1 space-y-1.5">
                <Input
                  value={thumbnail}
                  onChange={(e) => setThumbnail(e.target.value)}
                  placeholder="Paste thumbnail URL or upload an image"
                  className="h-9 rounded-lg"
                />
                <label className="inline-flex items-center gap-1.5 cursor-pointer text-xs text-accent hover:underline">
                  <Upload className="h-3.5 w-3.5" />
                  {uploadingThumb ? "Uploading…" : "Upload thumbnail image"}
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    disabled={uploadingThumb}
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) uploadThumbnail(f);
                    }}
                  />
                </label>
              </div>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="s-title" className="text-xs font-medium text-muted-foreground">
              Title
            </Label>
            <Input
              id="s-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="h-9 rounded-lg"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="s-desc" className="text-xs font-medium text-muted-foreground">
              Description
            </Label>
            <Textarea
              id="s-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              className="rounded-lg"
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="s-cat" className="text-xs font-medium text-muted-foreground">
                Category
              </Label>
              <Input
                id="s-cat"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="h-9 rounded-lg"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-muted-foreground">Access Type</Label>
              <Select
                value={accessType}
                onValueChange={(v) => setAccessType(v as "FREE" | "PAID")}
              >
                <SelectTrigger className="w-full h-9 rounded-lg">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="FREE">Free</SelectItem>
                  <SelectItem value="PAID">Paid</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {accessType === "PAID" && (
            <div className="space-y-2 rounded-lg border border-border p-3 bg-muted/30">
              <Label className="text-[11px] uppercase tracking-wider text-muted-foreground">
                Required Plans
              </Label>
              {plans.length === 0 ? (
                <p className="text-xs text-destructive">
                  No subscription plans exist. Contact the platform admin to create one.
                </p>
              ) : (
                <div className="space-y-2 max-h-32 overflow-y-auto scrollbar-thin">
                  {plans.map((p) => (
                    <label
                      key={p.id}
                      className="flex items-center gap-2 cursor-pointer rounded-md p-1.5 transition-colors hover:bg-background"
                    >
                      <Checkbox
                        checked={planIds.includes(p.id)}
                        onCheckedChange={() => togglePlan(p.id)}
                      />
                      <span className="text-sm text-foreground">{p.name}</span>
                    </label>
                  ))}
                </div>
              )}
            </div>
          )}

          <div className="flex items-center justify-between rounded-lg border border-border p-3">
            <div>
              <Label htmlFor="s-pub" className="text-sm font-medium">
                Published
              </Label>
              <p className="text-xs text-muted-foreground mt-0.5">
                Make this course visible to students.
              </p>
            </div>
            <Switch id="s-pub" checked={isPublished} onCheckedChange={setIsPublished} />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button disabled={saving} onClick={save} className="h-9 gap-2">
              <Save className="h-4 w-4" /> {saving ? "Saving…" : "Save Changes"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Danger zone */}
      <Card className="rounded-lg border-destructive/30 p-5 shadow-sm">
        <CardHeader className="p-0">
          <CardTitle className="font-heading text-base font-semibold text-destructive">
            Danger Zone
          </CardTitle>
          <CardDescription className="mt-1">Permanent actions that cannot be undone.</CardDescription>
        </CardHeader>
        <CardContent className="p-0 mt-4">
          <div className="flex items-center justify-between rounded-lg border border-destructive/30 bg-destructive/5 p-4">
            <div>
              <p className="text-sm font-medium text-foreground">Delete this course</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Permanently removes the course and all related content.
              </p>
            </div>
            <Button
              variant="destructive"
              size="sm"
              className="h-9 gap-2"
              onClick={() => setDeleteOpen(true)}
            >
              <Trash2 className="h-4 w-4" /> Delete Course
            </Button>
          </div>
        </CardContent>
      </Card>

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete course permanently?</AlertDialogTitle>
            <AlertDialogDescription>
              This will delete <strong>{course.title}</strong> and all topics, videos, materials,
              assignments and submissions. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-white hover:bg-destructive/90"
              onClick={doDelete}
            >
              Delete Permanently
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <div className="flex items-center justify-between text-xs text-muted-foreground pt-2">
        <span>Created {formatDateTime(course.createdAt)}</span>
        <button
          className="text-accent hover:underline"
          onClick={() => navigate(["university", "courses"])}
        >
          Back to courses list
        </button>
      </div>
    </div>
  );
}

// ============= VIDEO QUESTIONS MANAGEMENT =============
function formatTimestamp(seconds: number): string {
  const total = Number.isFinite(seconds) ? Math.max(0, Math.floor(seconds)) : 0;
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

/**
 * Silent loader that pre-fetches the question count for a video so a badge
 * can be shown on the video row before the manager is opened. Renders nothing.
 */
function VideoQuestionsBadge({
  videoId,
  active,
  reportCount,
}: {
  videoId: string;
  active: boolean;
  reportCount: (videoId: string, n: number) => void;
}) {
  const { data } = useApiFetch<QuestionsResponse>(
    active ? `/api/university/videos/${videoId}/questions` : null
  );
  useEffect(() => {
    if (data) reportCount(videoId, data.questions.length);
  }, [data, videoId, reportCount]);
  return null;
}

/**
 * Inline panel shown beneath a video row when "Manage questions" is toggled.
 * Handles listing, creating, editing and deleting in-video questions.
 */
function VideoQuestionsPanel({
  videoId,
  videoTitle,
  onClose,
  reportCount,
}: {
  videoId: string;
  videoTitle: string;
  onClose: () => void;
  reportCount: (videoId: string, n: number) => void;
}) {
  const { t } = useI18n();
  const { data, loading, error, refetch } = useApiFetch<QuestionsResponse>(
    `/api/university/videos/${videoId}/questions`
  );
  const [addOpen, setAddOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<VideoQuestion | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<VideoQuestion | null>(null);

  const questions = data?.questions ?? [];
  const sorted = [...questions].sort((a, b) => a.timestamp - b.timestamp);

  useEffect(() => {
    if (data) reportCount(videoId, data.questions.length);
  }, [data, videoId, reportCount]);

  async function handleDelete() {
    if (!deleteTarget) return;
    try {
      await apiPost(`/api/university/questions/${deleteTarget.id}`, null, {
        method: "DELETE",
      });
      toast({ title: "Question deleted" });
      setDeleteTarget(null);
      refetch();
    } catch {
      /* toast handled by apiPost */
    }
  }

  return (
    <div className="rounded-lg border border-accent/20 bg-soft-sage/40 p-3">
      <div className="flex items-center justify-between gap-2 mb-2">
        <div className="flex items-center gap-2 min-w-0">
          <span className="flex h-6 w-6 items-center justify-center rounded-md bg-accent/15 text-accent shrink-0">
            <HelpCircle className="h-3.5 w-3.5" />
          </span>
          <div className="min-w-0">
            <p className="text-xs font-semibold text-foreground truncate">
              In-video questions
            </p>
            <p className="text-[11px] text-muted-foreground truncate">
              {questions.length === 0
                ? "No questions yet"
                : `${questions.length} question${questions.length === 1 ? "" : "s"}`}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <Button size="sm" className="h-7 gap-1.5" onClick={() => setAddOpen(true)}>
            <Plus className="h-3.5 w-3.5" /> Add Question
          </Button>
          <Button
            variant="ghost"
            size="icon"
            aria-label="Close questions panel"
            className="h-7 w-7 text-muted-foreground hover:text-foreground"
            onClick={onClose}
          >
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="space-y-2">
          <Skeleton className="h-16 w-full rounded-lg" />
          <Skeleton className="h-16 w-full rounded-lg" />
        </div>
      ) : error ? (
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-center">
          <p className="text-xs text-destructive">{error}</p>
          <Button variant="outline" size="sm" className="mt-2 h-7" onClick={refetch}>
            Retry
          </Button>
        </div>
      ) : sorted.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border bg-card/50 py-6 text-center">
          <ListChecks className="h-5 w-5 text-muted-foreground/40 mx-auto mb-1.5" />
          <p className="text-xs text-muted-foreground">
            No questions yet. Add one to quiz viewers during playback.
          </p>
        </div>
      ) : (
        <div className="space-y-2 max-h-80 overflow-y-auto pr-1 scrollbar-thin">
          {sorted.map((q, qi) => (
            <div
              key={q.id}
              className="rounded-lg border border-border bg-card p-3 transition-shadow hover:shadow-sm"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5 mb-1">
                    <Badge
                      variant="outline"
                      className="gap-1 text-[10px] text-muted-foreground"
                    >
                      <Clock className="h-3 w-3" /> {formatTimestamp(q.timestamp)}
                    </Badge>
                    <span className="text-[10px] text-muted-foreground/70">#{qi + 1}</span>
                  </div>
                  <p className="text-sm font-medium text-foreground break-words">{q.question}</p>
                </div>
                <div className="flex items-center gap-0.5 shrink-0">
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label="Edit question"
                    className="h-7 w-7 text-muted-foreground hover:text-foreground"
                    onClick={() => setEditTarget(q)}
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label="Delete question"
                    className="h-7 w-7 text-muted-foreground hover:text-destructive"
                    onClick={() => setDeleteTarget(q)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
              <ul className="mt-2 space-y-1">
                {q.options.map((opt, oi) => {
                  const isCorrect = oi === q.correctAnswer;
                  return (
                    <li
                      key={oi}
                      className={cn(
                        "flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-sm",
                        isCorrect
                          ? "bg-success/10 text-foreground ring-1 ring-success/30"
                          : "bg-muted/40 text-muted-foreground"
                      )}
                    >
                      <span
                        className={cn(
                          "flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-semibold shrink-0",
                          isCorrect
                            ? "bg-success text-success-foreground"
                            : "bg-muted-foreground/15 text-muted-foreground"
                        )}
                      >
                        {isCorrect ? <Check className="h-3 w-3" /> : String.fromCharCode(65 + oi)}
                      </span>
                      <span className="flex-1 break-words">{opt}</span>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </div>
      )}

      <QuestionFormDialog
        open={addOpen}
        onOpenChange={setAddOpen}
        videoId={videoId}
        videoTitle={videoTitle}
        onSaved={() => {
          setAddOpen(false);
          refetch();
        }}
      />
      <QuestionFormDialog
        open={!!editTarget}
        onOpenChange={(v) => !v && setEditTarget(null)}
        videoId={videoId}
        videoTitle={videoTitle}
        target={editTarget}
        onSaved={() => {
          setEditTarget(null);
          refetch();
        }}
      />
      <AlertDialog
        open={!!deleteTarget}
        onOpenChange={(v) => !v && setDeleteTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete question?</AlertDialogTitle>
            <AlertDialogDescription>
              This question (at{" "}
              {deleteTarget ? formatTimestamp(deleteTarget.timestamp) : ""}) will be permanently
              removed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-white hover:bg-destructive/90"
              onClick={handleDelete}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

/**
 * Add/Edit dialog for a single in-video question. Dynamic options list with a
 * radio to mark the correct answer, plus minutes/seconds for the pop-up time.
 */
function QuestionFormDialog({
  open,
  onOpenChange,
  videoId,
  videoTitle,
  target,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  videoId: string;
  videoTitle: string;
  target?: VideoQuestion | null;
  onSaved: () => void;
}) {
  const [question, setQuestion] = useState("");
  const [options, setOptions] = useState<string[]>(["", ""]);
  const [correctAnswer, setCorrectAnswer] = useState(0);
  const [minutes, setMinutes] = useState("0");
  const [seconds, setSeconds] = useState("0");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (target) {
      setQuestion(target.question);
      setOptions(
        target.options.length >= 2 ? [...target.options] : [...target.options, ""]
      );
      setCorrectAnswer(
        Math.max(0, Math.min(target.correctAnswer, (target.options.length || 1) - 1))
      );
      const total = Math.max(0, Math.floor(target.timestamp || 0));
      setMinutes(String(Math.floor(total / 60)));
      setSeconds(String(total % 60));
    } else {
      setQuestion("");
      setOptions(["", ""]);
      setCorrectAnswer(0);
      setMinutes("0");
      setSeconds("0");
    }
  }, [open, target]);

  function updateOption(i: number, value: string) {
    setOptions((prev) => prev.map((o, idx) => (idx === i ? value : o)));
  }
  function addOption() {
    setOptions((prev) => [...prev, ""]);
  }
  function removeOption(i: number) {
    setOptions((prev) => (prev.length <= 2 ? prev : prev.filter((_, idx) => idx !== i)));
    setCorrectAnswer((prev) => {
      if (i < prev) return prev - 1;
      if (i === prev) return 0;
      return prev;
    });
  }

  const totalSeconds =
    Math.max(0, parseInt(minutes || "0", 10) || 0) * 60 +
    Math.max(0, Math.min(59, parseInt(seconds || "0", 10) || 0));

  async function submit() {
    const q = question.trim();
    if (!q) {
      toast({ title: "Question text required", variant: "destructive" });
      return;
    }
    const opts = options.map((o) => o.trim());
    if (opts.length < 2) {
      toast({ title: "At least 2 options required", variant: "destructive" });
      return;
    }
    if (opts.some((o) => !o)) {
      toast({ title: "Fill in all options", variant: "destructive" });
      return;
    }
    if (correctAnswer < 0 || correctAnswer >= opts.length) {
      toast({ title: "Select a correct answer", variant: "destructive" });
      return;
    }
    const payload = {
      question: q,
      options: opts,
      correctAnswer,
      timestamp: totalSeconds,
    };
    setSaving(true);
    try {
      if (target) {
        await apiPost(`/api/university/questions/${target.id}`, payload, {
          method: "PUT",
        });
        toast({ title: "Question updated" });
      } else {
        await apiPost(`/api/university/videos/${videoId}/questions`, payload);
        toast({ title: "Question added" });
      }
      onSaved();
    } catch {
      /* toast handled by apiPost */
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="animate-scale-in w-[95vw] max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-heading text-lg font-semibold">
            {target ? "Edit Question" : "Add In-video Question"}
          </DialogTitle>
          <DialogDescription>
            For <span className="font-medium text-foreground">{videoTitle}</span>. The question
            pops up at the chosen timestamp during playback.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-1 scrollbar-thin">
          <div className="space-y-1.5">
            <Label htmlFor="q-text" className="text-xs font-medium text-muted-foreground">
              Question
            </Label>
            <Textarea
              id="q-text"
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              rows={2}
              placeholder="e.g. What is the main idea discussed in this section?"
              className="rounded-lg"
            />
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-medium text-muted-foreground">Answer options</Label>
              <span className="text-[11px] text-muted-foreground">
                Select the radio for the correct answer
              </span>
            </div>
            <div className="space-y-2">
              {options.map((opt, i) => (
                <div key={i} className="flex items-start gap-2">
                  <button
                    type="button"
                    role="radio"
                    aria-checked={correctAnswer === i}
                    aria-label={`Mark option ${String.fromCharCode(65 + i)} as correct`}
                    onClick={() => setCorrectAnswer(i)}
                    className={cn(
                      "mt-1 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border transition-colors",
                      correctAnswer === i
                        ? "border-accent bg-accent"
                        : "border-input bg-background hover:border-accent/60"
                    )}
                  >
                    {correctAnswer === i && (
                      <span className="h-1.5 w-1.5 rounded-full bg-accent-foreground" />
                    )}
                  </button>
                  <Input
                    value={opt}
                    onChange={(e) => updateOption(i, e.target.value)}
                    placeholder={`Option ${String.fromCharCode(65 + i)}`}
                    className="h-9 flex-1 rounded-lg"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label={`Remove option ${String.fromCharCode(65 + i)}`}
                    disabled={options.length <= 2}
                    className="h-9 w-9 shrink-0 text-muted-foreground hover:text-destructive"
                    onClick={() => removeOption(i)}
                  >
                    <X className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ))}
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-8 gap-1.5"
              onClick={addOption}
            >
              <PlusCircle className="h-3.5 w-3.5" /> Add Option
            </Button>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-muted-foreground">
              Pop-up timestamp
            </Label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="q-min" className="text-[11px] text-muted-foreground">
                  Minutes
                </Label>
                <Input
                  id="q-min"
                  type="number"
                  min={0}
                  value={minutes}
                  onChange={(e) => setMinutes(e.target.value)}
                  className="h-9 rounded-lg"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="q-sec" className="text-[11px] text-muted-foreground">
                  Seconds
                </Label>
                <Input
                  id="q-sec"
                  type="number"
                  min={0}
                  max={59}
                  value={seconds}
                  onChange={(e) => setSeconds(e.target.value)}
                  className="h-9 rounded-lg"
                />
              </div>
            </div>
            <p className="text-[11px] text-muted-foreground">
              Question appears at{" "}
              <span className="font-medium text-foreground">
                {formatTimestamp(totalSeconds)}
              </span>{" "}
              into the video.
            </p>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" className="h-9" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button disabled={saving} className="h-9 gap-1.5" onClick={submit}>
            {saving ? (
              "Saving…"
            ) : (
              <>
                <Save className="h-4 w-4" />
                {target ? "Save Changes" : "Add Question"}
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
