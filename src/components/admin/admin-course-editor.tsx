"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import {
  Tabs, TabsList, TabsTrigger, TabsContent,
} from "@/components/ui/tabs";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { EmptyState } from "@/components/shared/empty-state";
import { TopicsTable } from "@/components/shared/topics-table";
import { useApiFetch, apiPost, apiUpload, authFetch, markApiCacheStale } from "@/hooks/use-api";
import { useAppStore } from "@/stores/app-store";
import { useI18n } from "@/lib/i18n/store";
import { toast } from "@/hooks/use-toast";
import { formatDate, formatDateTime, type SubscriptionPlanPublic } from "@/types";
import {
  ArrowLeft, Plus, Pencil, Trash2, Video as VideoIcon,
  FileText, ClipboardList, Award, Settings, BookOpen, Upload, Eye, EyeOff,
  ExternalLink, Save, Info,
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

interface PlansResponse { plans: SubscriptionPlanPublic[] }

export function AdminCourseEditor({ courseId, onBack }: { courseId: string; onBack: () => void }) {
  const { t } = useI18n();
  const query = useAppStore((s) => s.query);
  const navigate = useAppStore((s) => s.navigate);
  const [activeTab, setActiveTab] = useState<string>("topics");

  // Deep link via ?tab=certificate — React 19 "store previous value" pattern
  const [lastTab, setLastTab] = useState<string | undefined>(undefined);
  if (query.tab !== lastTab) {
    setLastTab(query.tab);
    if (query.tab) setActiveTab(query.tab);
  }

  const { data, loading, error, refetch } = useApiFetch<{ course: CourseDetail }>(
    `/api/admin/courses/${courseId}`
  );
  const { data: plansData } = useApiFetch<PlansResponse>("/api/public/plans");

  const course = data?.course;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <Button variant="outline" size="icon" className="h-9 w-9 shrink-0" onClick={onBack} aria-label={t("common.back")}>
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
                  {course?.title || t("common.course")}
                </h2>
                <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground mt-1">
                  {course?.category && <Badge variant="outline" className="text-[10px] uppercase tracking-wider">{course.category}</Badge>}
                  {course?.accessType === "FREE" ? (
                    <Badge className="bg-success/15 text-success">{t("common.free")}</Badge>
                  ) : (
                    <Badge className="bg-primary text-primary-foreground">{t("common.paid")}</Badge>
                  )}
                  {course?.isPublished ? (
                    <Badge className="bg-success/15 text-success gap-1">{t("common.published")}</Badge>
                  ) : (
                    <Badge variant="outline" className="text-muted-foreground">{t("common.draft")}</Badge>
                  )}
                  <span className="text-muted-foreground">{course ? formatDate(course.updatedAt) : ""}</span>
                </div>
              </>
            )}
          </div>
        </div>
        <Button
          variant="outline"
          size="sm"
          disabled
          className="h-9 text-muted-foreground"
          title={t("common.view")}
        >
          <Eye className="h-4 w-4" /> {t("common.view")}
        </Button>
      </div>

      {error ? (
        <EmptyState
          icon={<BookOpen className="h-5 w-5" />}
          title={t("common.error")}
          description={error}
          action={<Button variant="outline" onClick={onBack}>{t("common.back")}</Button>}
        />
      ) : loading || !course ? (
        <Skeleton className="h-96 w-full" />
      ) : (
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <div className="rounded-xl border border-border bg-card p-1 shadow-sm overflow-x-auto scrollbar-thin">
            <TabsList className="w-full justify-start h-auto flex-wrap bg-transparent gap-1">
              <TabsTrigger value="topics" className="gap-1.5 rounded-lg data-[state=active]:bg-soft-sage data-[state=active]:text-primary data-[state=active]:shadow-sm"><VideoIcon className="h-3.5 w-3.5" /> {t("courses.topicsVideos")}</TabsTrigger>
              <TabsTrigger value="materials" className="gap-1.5 rounded-lg data-[state=active]:bg-soft-sage data-[state=active]:text-primary data-[state=active]:shadow-sm"><FileText className="h-3.5 w-3.5" /> {t("common.materials")}</TabsTrigger>
              <TabsTrigger value="assignments" className="gap-1.5 rounded-lg data-[state=active]:bg-soft-sage data-[state=active]:text-primary data-[state=active]:shadow-sm"><ClipboardList className="h-3.5 w-3.5" /> {t("common.assignments")}</TabsTrigger>
              <TabsTrigger value="certificate" className="gap-1.5 rounded-lg data-[state=active]:bg-soft-sage data-[state=active]:text-primary data-[state=active]:shadow-sm"><Award className="h-3.5 w-3.5" /> {t("common.certificate")}</TabsTrigger>
              <TabsTrigger value="settings" className="gap-1.5 rounded-lg data-[state=active]:bg-soft-sage data-[state=active]:text-primary data-[state=active]:shadow-sm"><Settings className="h-3.5 w-3.5" /> {t("nav.settings")}</TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="topics" className="mt-4">
            <TopicsTab course={course} onRefresh={refetch} />
          </TabsContent>
          <TabsContent value="materials" className="mt-4">
            <MaterialsTab course={course} onRefresh={refetch} />
          </TabsContent>
          <TabsContent value="assignments" className="mt-4">
            <AssignmentsTab course={course} onRefresh={refetch} />
          </TabsContent>
          <TabsContent value="certificate" className="mt-4">
            <CertificateTab course={course} onRefresh={refetch} />
          </TabsContent>
          <TabsContent value="settings" className="mt-4">
            <SettingsTab
              course={course}
              plans={plansData?.plans || []}
              onRefresh={refetch}
              onDeleted={() => navigate(["admin", "courses"])}
            />
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}

// ============= TOPICS & VIDEOS TAB =============
function TopicsTab({ course, onRefresh }: { course: CourseDetail; onRefresh: () => void }) {
  const { t } = useI18n();
  const [addVideoFor, setAddVideoFor] = useState<TopicRow | null>(null);
  const [editVideo, setEditVideo] = useState<VideoRow | null>(null);
  const [deleteVideo, setDeleteVideo] = useState<VideoRow | null>(null);

  const sortedTopics = useMemo(
    () => [...course.topics].sort((a, b) => a.displayOrder - b.displayOrder),
    [course.topics]
  );

  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <div>
          <h3 className="font-heading text-base font-semibold text-foreground">{t("courses.courseContent")}</h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            {course.topics.length} {t("common.topics")} · {course.topics.reduce((a, t) => a + t.videos.length, 0)} {t("common.videos")}
          </p>
        </div>

        <TopicsTable
          courseId={course.id}
          topics={sortedTopics}
          apiBase="/api/admin"
          onRefresh={onRefresh}
        />
      </div>

      {/* Videos by Topic */}
      {sortedTopics.length > 0 && (
        <div className="space-y-3">
          <div>
            <h4 className="font-heading text-sm font-semibold text-foreground">{t("common.videos")}</h4>
            <p className="text-xs text-muted-foreground mt-0.5">
              Manage video lessons inside each saved topic.
            </p>
          </div>
          <div className="space-y-3">
            {sortedTopics.map((topic, idx) => (
              <Card key={topic.id} className="overflow-hidden border-border bg-card p-0 shadow-sm">
                <div className="flex items-center justify-between gap-2 px-4 py-2.5 bg-muted/20 border-b border-border">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-primary text-xs font-semibold shrink-0">
                      {idx + 1}
                    </span>
                    <span className="font-medium text-sm text-foreground truncate">{topic.title}</span>
                    <span className="text-xs text-muted-foreground shrink-0">
                      ({topic.videos.length} {t("common.videos")})
                    </span>
                  </div>
                  <Button variant="outline" size="sm" className="h-8 gap-1 text-xs shrink-0" onClick={() => setAddVideoFor(topic)}>
                    <Plus className="h-3.5 w-3.5" /> {t("courses.addVideo")}
                  </Button>
                </div>
                <div className="p-3">
                  {topic.videos.length === 0 ? (
                    <p className="text-xs text-muted-foreground py-2 text-center">{t("courses.noVideosYet")}</p>
                  ) : (
                    <ul className="space-y-1.5">
                      {topic.videos.map((v, vi) => (
                        <li key={v.id} className="flex items-center gap-3 rounded-lg border border-border p-2 hover:bg-muted/40 transition-colors">
                          <div className="flex h-9 w-14 items-center justify-center rounded bg-muted overflow-hidden shrink-0 ring-1 ring-border">
                            {v.thumbnail ? (
                              <img src={v.thumbnail} alt="" className="h-full w-full object-cover" />
                            ) : (
                              <VideoIcon className="h-3.5 w-3.5 text-muted-foreground" />
                            )}
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-medium text-foreground truncate">
                              <span className="text-muted-foreground mr-1.5">{vi + 1}.</span>
                              {v.title}
                            </p>
                            <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                              <Badge variant="outline" className="text-[10px] py-0 h-4">{v.source}</Badge>
                              {v.isPublished ? (
                                <span className="text-success">{t("common.published")}</span>
                              ) : (
                                <span>{t("common.draft")}</span>
                              )}
                            </div>
                          </div>
                          <Button variant="ghost" size="icon" aria-label={t("common.edit")} className="h-8 w-8 text-muted-foreground hover:text-foreground" onClick={() => setEditVideo(v)}>
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button variant="ghost" size="icon" aria-label={t("common.delete")} className="h-8 w-8 text-muted-foreground hover:text-destructive" onClick={() => setDeleteVideo(v)}>
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Video dialogs */}
      {addVideoFor && (
        <VideoFormDialog
          open={!!addVideoFor}
          onOpenChange={(v) => !v && setAddVideoFor(null)}
          course={course}
          fixedTopicId={addVideoFor.id}
          onSaved={() => { onRefresh(); setAddVideoFor(null); }}
        />
      )}
      <VideoFormDialog
        open={!!editVideo}
        onOpenChange={(v) => !v && setEditVideo(null)}
        course={course}
        target={editVideo}
        onSaved={() => { onRefresh(); setEditVideo(null); }}
      />
      <AlertDialog open={!!deleteVideo} onOpenChange={(v) => !v && setDeleteVideo(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("common.delete")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("courses.deleteCourseConfirm")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-white hover:bg-destructive/90"
              onClick={async () => {
                if (!deleteVideo) return;
                try {
                  await apiPost(`/api/admin/videos/${deleteVideo.id}`, null, { method: "DELETE" });
                  toast({ title: t("common.success") });
                  setDeleteVideo(null);
                  onRefresh();
                } catch { /* toast */ }
              }}
            >
              {t("common.delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function VideoFormDialog({
  open, onOpenChange, course, fixedTopicId, target, onSaved,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  course: CourseDetail;
  fixedTopicId?: string;
  target?: VideoRow | null;
  onSaved: () => void;
}) {
  const { t } = useI18n();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [topicId, setTopicId] = useState<string>(fixedTopicId || "");
  const [source, setSource] = useState<"UPLOAD" | "YOUTUBE" | "URL">("UPLOAD");
  const [videoUrl, setVideoUrl] = useState("");
  const [displayOrder, setDisplayOrder] = useState("");
  const [isPublished, setIsPublished] = useState(true);
  const [saving, setSaving] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [thumbFile, setThumbFile] = useState<File | null>(null);
  const videoFileInputRef = useRef<HTMLInputElement>(null);
  const thumbInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (target) {
      setTitle(target.title);
      setDescription(target.description || "");
      setTopicId(fixedTopicId || "");
      setSource(target.source);
      setVideoUrl(target.source !== "UPLOAD" ? target.videoUrl : "");
      setDisplayOrder(String(target.displayOrder));
      setIsPublished(target.isPublished);
    } else if (open) {
      setTitle("");
      setDescription("");
      setTopicId(fixedTopicId || course.topics[0]?.id || "");
      setSource("UPLOAD");
      setVideoUrl("");
      setDisplayOrder("");
      setIsPublished(true);
    }
    setFile(null);
    setThumbFile(null);
    if (videoFileInputRef.current) videoFileInputRef.current.value = "";
    if (thumbInputRef.current) thumbInputRef.current.value = "";
  }, [target, open, fixedTopicId, course.topics]);

  async function submit() {
    if (!title.trim()) {
      toast({ title: t("common.title") + " " + t("common.required"), variant: "destructive" });
      return;
    }
    if (!topicId) {
      toast({ title: t("common.topic") + " " + t("common.required"), variant: "destructive" });
      return;
    }
    if (source !== "UPLOAD" && !videoUrl.trim() && !target) {
      toast({ title: t("courses.videoSource") + " " + t("common.required"), variant: "destructive" });
      return;
    }
    if (source === "UPLOAD" && !file && !target) {
      toast({ title: t("courses.videoFile") + " " + t("common.required"), variant: "destructive" });
      return;
    }

    const fd = new FormData();
    fd.append("title", title.trim());
    fd.append("description", description.trim());
    fd.append("topicId", topicId);
    fd.append("source", source);
    if (source !== "UPLOAD") fd.append("videoUrl", videoUrl.trim());
    if (file) fd.append("file", file);
    if (thumbFile) fd.append("thumbnail", thumbFile);
    if (displayOrder) fd.append("displayOrder", displayOrder);
    fd.append("isPublished", String(isPublished));

    setSaving(true);
    try {
      const hasFiles = !!file || !!thumbFile;
      if (!hasFiles && source !== "UPLOAD") {
        const jsonBody = {
          title: title.trim(),
          description: description.trim(),
          topicId,
          source,
          videoUrl: videoUrl.trim(),
          ...(displayOrder ? { displayOrder } : {}),
          isPublished,
        };
        if (target) {
          await apiPost(`/api/admin/videos/${target.id}`, jsonBody, { method: "PUT" });
        } else {
          await apiPost(`/api/admin/courses/${course.id}/videos`, jsonBody);
        }
        toast({ title: t("common.success") });
      } else if (target) {
        const res = await authFetch(`/api/admin/videos/${target.id}`, {
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
        if (!res.ok) throw new Error(json.error || "Failed to update video");
        markApiCacheStale();
        toast({ title: t("common.success") });
      } else {
        await apiUpload(`/api/admin/courses/${course.id}/videos`, fd);
        toast({ title: t("common.success") });
      }
      onSaved();
    } catch (e) {
      if (target && (file || thumbFile || source === "UPLOAD") && e instanceof Error) {
        toast({ title: t("common.error"), description: e.message, variant: "destructive" });
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="animate-scale-in w-[95vw] max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-heading text-lg font-semibold">{target ? t("common.edit") : t("courses.addVideo")}</DialogTitle>
          <DialogDescription>{t("courses.videoSource")}</DialogDescription>
        </DialogHeader>
        <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-1 scrollbar-thin">
          <div className="space-y-1.5">
            <Label htmlFor="v-title" className="text-xs font-medium text-muted-foreground">{t("courses.videoTitle")}</Label>
            <Input id="v-title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder={t("courses.videoTitle")} className="h-9 rounded-lg" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="v-desc" className="text-xs font-medium text-muted-foreground">{t("courses.videoDescription")}</Label>
            <Textarea id="v-desc" value={description} onChange={(e) => setDescription(e.target.value)} rows={2} className="rounded-lg" />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-muted-foreground">{t("common.topic")}</Label>
              <Select value={topicId} onValueChange={setTopicId} disabled={!!fixedTopicId}>
                <SelectTrigger className="w-full h-9 rounded-lg">
                  <SelectValue placeholder={t("common.topic")} />
                </SelectTrigger>
                <SelectContent>
                  {course.topics.map((t) => (
                    <SelectItem key={t.id} value={t.id}>{t.title}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-muted-foreground">{t("courses.videoSource")}</Label>
              <Select value={source} onValueChange={(v) => setSource(v as "UPLOAD" | "YOUTUBE" | "URL")}>
                <SelectTrigger className="w-full h-9 rounded-lg">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="UPLOAD">{t("courses.uploadFile")}</SelectItem>
                  <SelectItem value="YOUTUBE">{t("courses.youtube")}</SelectItem>
                  <SelectItem value="URL">{t("courses.directUrl")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {source === "UPLOAD" ? (
            <div className="space-y-1.5">
              <Label htmlFor="v-file" className="text-xs font-medium text-muted-foreground">{t("courses.videoFile")}</Label>
              <Input
                ref={videoFileInputRef}
                id="v-file"
                type="file"
                accept="video/*"
                onChange={(e) => setFile(e.target.files?.[0] || null)}
              />
              {target && !file && (
                <p className="text-xs text-muted-foreground">{t("courses.videoFile")}</p>
              )}
            </div>
          ) : (
            <div className="space-y-1.5">
              <Label htmlFor="v-url" className="text-xs font-medium text-muted-foreground">
                {source === "YOUTUBE" ? t("courses.youtubeUrl") : t("courses.videoSource")}
              </Label>
              <Input
                id="v-url"
                value={videoUrl}
                onChange={(e) => setVideoUrl(e.target.value)}
                placeholder={source === "YOUTUBE" ? "https://www.youtube.com/watch?v=…" : "https://example.com/video.mp4"}
                className="h-9 rounded-lg"
              />
              {source === "YOUTUBE" && (
                <p className="text-xs text-muted-foreground">{t("courses.youtubeUrl")}</p>
              )}
            </div>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="v-thumb" className="text-xs font-medium text-muted-foreground">{t("courses.courseThumbnail")} ({t("common.optional")})</Label>
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
              <Label htmlFor="v-order" className="text-xs font-medium text-muted-foreground">{t("courses.displayOrder")}</Label>
              <Input id="v-order" type="number" value={displayOrder} onChange={(e) => setDisplayOrder(e.target.value)} placeholder={t("courses.displayOrder")} className="h-9 rounded-lg" />
            </div>
            <div className="flex items-center justify-between rounded-lg border border-border px-3">
              <Label htmlFor="v-pub" className="text-sm font-medium">{t("common.published")}</Label>
              <Switch id="v-pub" checked={isPublished} onCheckedChange={setIsPublished} />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" className="h-9" onClick={() => onOpenChange(false)}>{t("common.cancel")}</Button>
          <Button disabled={saving} className="h-9" onClick={submit}>{saving ? t("common.saving") : target ? t("profile.saveChanges") : t("courses.addVideo")}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ============= MATERIALS TAB =============
function MaterialsTab({ course, onRefresh }: { course: CourseDetail; onRefresh: () => void }) {
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
          <h3 className="font-heading text-base font-semibold text-foreground">{t("common.learningMaterials")}</h3>
          <p className="text-xs text-muted-foreground mt-0.5">{course.materials.length} {t("common.materials")}</p>
        </div>
        <Button className="h-9 gap-2" onClick={() => setAddOpen(true)}>
          <Plus className="h-4 w-4" /> {t("courses.addMaterial")}
        </Button>
      </div>

      {course.materials.length === 0 ? (
        <EmptyState
          icon={<FileText className="h-5 w-5" />}
          title={t("common.noData")}
          description={t("common.learningMaterials")}
          action={<Button onClick={() => setAddOpen(true)} className="gap-2"><Plus className="h-4 w-4" /> {t("courses.addMaterial")}</Button>}
        />
      ) : (
        <div className="space-y-3">
          {grouped.map((g) => (
            <Card key={g.topicId} className="overflow-hidden border-border bg-card p-0 shadow-sm">
              <div className="border-b border-border bg-muted/30 px-4 py-2.5">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  {g.topicTitle || t("common.materials")}
                </p>
              </div>
              <ul className="divide-y divide-border">
                {g.items.map((m) => (
                  <li key={m.id} className="flex items-center gap-3 p-3 transition-colors hover:bg-muted/40">
                    <Badge variant="outline" className="text-[10px] uppercase tracking-wider shrink-0 bg-muted/40">{m.type}</Badge>
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
                      aria-label={t("common.view")}
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                    </a>
                    <Button variant="ghost" size="icon" aria-label={t("common.edit")} className="h-8 w-8 text-muted-foreground hover:text-foreground" onClick={() => setEditTarget(m)}>
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button variant="ghost" size="icon" aria-label={t("common.delete")} className="h-8 w-8 text-muted-foreground hover:text-destructive" onClick={() => setDeleteTarget(m)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </li>
                ))}
              </ul>
            </Card>
          ))}
        </div>
      )}

      <MaterialFormDialog
        open={addOpen}
        onOpenChange={setAddOpen}
        course={course}
        onSaved={() => { onRefresh(); setAddOpen(false); }}
      />
      <MaterialFormDialog
        open={!!editTarget}
        onOpenChange={(v) => !v && setEditTarget(null)}
        course={course}
        target={editTarget}
        onSaved={() => { onRefresh(); setEditTarget(null); }}
      />
      <AlertDialog open={!!deleteTarget} onOpenChange={(v) => !v && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("common.delete")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("courses.deleteCourseConfirm")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-white hover:bg-destructive/90"
              onClick={async () => {
                if (!deleteTarget) return;
                try {
                  await apiPost(`/api/admin/materials/${deleteTarget.id}`, null, { method: "DELETE" });
                  toast({ title: t("common.success") });
                  setDeleteTarget(null);
                  onRefresh();
                } catch { /* toast */ }
              }}
            >
              {t("common.delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function MaterialFormDialog({
  open, onOpenChange, course, target, onSaved,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  course: CourseDetail;
  target?: MaterialRow | null;
  onSaved: () => void;
}) {
  const { t } = useI18n();
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
      toast({ title: t("common.title") + " " + t("common.required"), variant: "destructive" });
      return;
    }
    if (type === "LINK" && !fileUrl.trim() && !target) {
      toast({ title: t("courses.videoSource") + " " + t("common.required"), variant: "destructive" });
      return;
    }
    if (type !== "LINK" && !file && !target) {
      toast({ title: t("courses.videoFile") + " " + t("common.required"), variant: "destructive" });
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
        // PUT
        const res = await authFetch(`/api/admin/materials/${target.id}`, {
          method: "PUT",
          body: fd,
          credentials: "include",
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || "Failed");
        markApiCacheStale();
        toast({ title: t("common.success") });
      } else {
        await apiUpload(`/api/admin/courses/${course.id}/materials`, fd);
        toast({ title: t("common.success") });
      }
      onSaved();
    } catch (e) {
      if (e instanceof Error) {
        toast({ title: t("common.error"), description: e.message, variant: "destructive" });
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="animate-scale-in w-[95vw] max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-heading text-lg font-semibold">{target ? t("common.edit") : t("courses.addMaterial")}</DialogTitle>
          <DialogDescription>{t("courses.materialTitle")}</DialogDescription>
        </DialogHeader>
        <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-1 scrollbar-thin">
          <div className="space-y-1.5">
            <Label htmlFor="m-title" className="text-xs font-medium text-muted-foreground">{t("courses.materialTitle")}</Label>
            <Input id="m-title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder={t("courses.materialTitle")} className="h-9 rounded-lg" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="m-desc" className="text-xs font-medium text-muted-foreground">{t("courses.videoDescription")}</Label>
            <Textarea id="m-desc" value={description} onChange={(e) => setDescription(e.target.value)} rows={2} className="rounded-lg" />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-muted-foreground">{t("common.topic")} ({t("common.optional")})</Label>
              <Select value={topicId} onValueChange={setTopicId}>
                <SelectTrigger className="w-full h-9 rounded-lg">
                  <SelectValue placeholder={t("common.topic")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">{t("common.topic")}</SelectItem>
                  {course.topics.map((tp) => (
                    <SelectItem key={tp.id} value={tp.id}>{tp.title}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-muted-foreground">{t("courses.materialType")}</Label>
              <Select value={type} onValueChange={(v) => setType(v as "PDF" | "DOC" | "PRESENTATION" | "LINK")}>
                <SelectTrigger className="w-full h-9 rounded-lg">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="PDF">PDF</SelectItem>
                  <SelectItem value="DOC">{t("common.description")}</SelectItem>
                  <SelectItem value="PRESENTATION">{t("courses.materialTitle")}</SelectItem>
                  <SelectItem value="LINK">{t("courses.directUrl")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {type === "LINK" ? (
            <div className="space-y-1.5">
              <Label htmlFor="m-url" className="text-xs font-medium text-muted-foreground">{t("courses.directUrl")}</Label>
              <Input id="m-url" value={fileUrl} onChange={(e) => setFileUrl(e.target.value)} placeholder="https://…" className="h-9 rounded-lg" />
            </div>
          ) : (
            <div className="space-y-1.5">
              <Label htmlFor="m-file" className="text-xs font-medium text-muted-foreground">{t("courses.videoFile")}</Label>
              <Input
                ref={fileInputRef}
                id="m-file"
                type="file"
                onChange={(e) => setFile(e.target.files?.[0] || null)}
                accept=".pdf,.doc,.docx,.ppt,.pptx,.txt"
              />
              {target && !file && (
                <p className="text-xs text-muted-foreground">{t("courses.videoFile")}</p>
              )}
            </div>
          )}

          <div className="flex items-center justify-between rounded-lg border border-border p-3">
            <Label htmlFor="m-pub" className="text-sm font-medium">{t("common.published")}</Label>
            <Switch id="m-pub" checked={isPublished} onCheckedChange={setIsPublished} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" className="h-9" onClick={() => onOpenChange(false)}>{t("common.cancel")}</Button>
          <Button disabled={saving} className="h-9" onClick={submit}>{saving ? t("common.saving") : target ? t("profile.saveChanges") : t("courses.addMaterial")}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ============= ASSIGNMENTS TAB =============
function AssignmentsTab({ course, onRefresh }: { course: CourseDetail; onRefresh: () => void }) {
  const { t } = useI18n();
  const navigate = useAppStore((s) => s.navigate);
  const [addOpen, setAddOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<AssignmentRow | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<AssignmentRow | null>(null);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-heading text-base font-semibold text-foreground">{t("common.assignments")}</h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            {course.assignments.length} {t("common.assignments")} · {" "}
            {course.assignments.reduce((a, x) => a + x.submissionsCount, 0)} {t("common.submissions")}
          </p>
        </div>
        <Button className="h-9 gap-2" onClick={() => setAddOpen(true)}>
          <Plus className="h-4 w-4" /> {t("courses.addAssignment")}
        </Button>
      </div>

      {course.assignments.length === 0 ? (
        <EmptyState
          icon={<ClipboardList className="h-5 w-5" />}
          title={t("common.noData")}
          description={t("courses.assignmentInstructions")}
          action={<Button onClick={() => setAddOpen(true)} className="gap-2"><Plus className="h-4 w-4" /> {t("courses.addAssignment")}</Button>}
        />
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {course.assignments.map((a) => (
            <Card key={a.id} className="p-4 space-y-3 border-border bg-card shadow-sm transition-shadow hover:shadow-md">
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
                  <Badge variant="outline" className="text-muted-foreground shrink-0">{t("common.draft")}</Badge>
                )}
              </div>
              {a.description && (
                <p className="text-sm text-muted-foreground line-clamp-2">{a.description}</p>
              )}
              <div className="flex flex-wrap gap-2 text-xs">
                <Badge variant="outline" className="bg-accent/10 text-accent">
                  {a.submissionsCount} {t("common.submissions")}
                </Badge>
                {a.allowResubmission && (
                  <Badge variant="outline" className="text-muted-foreground">{t("courses.allowResubmission")}</Badge>
                )}
                {a.fileUrl && (
                  <a
                    href={a.fileUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-accent hover:underline"
                  >
                    <ExternalLink className="h-3 w-3" /> {t("courses.assignmentFile")}
                  </a>
                )}
              </div>
              <Separator />
              <div className="flex items-center justify-between">
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 gap-1"
                  onClick={() => navigate(["admin", "submissions"], { assignmentId: a.id })}
                >
                  <ClipboardList className="h-3.5 w-3.5" /> {t("common.submissions")}
                </Button>
                <div className="flex items-center gap-1">
                  <Button variant="ghost" size="icon" aria-label={t("common.edit")} className="h-8 w-8 text-muted-foreground hover:text-foreground" onClick={() => setEditTarget(a)}>
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <Button variant="ghost" size="icon" aria-label={t("common.delete")} className="h-8 w-8 text-muted-foreground hover:text-destructive" onClick={() => setDeleteTarget(a)}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      <AssignmentFormDialog
        open={addOpen}
        onOpenChange={setAddOpen}
        courseId={course.id}
        onSaved={() => { onRefresh(); setAddOpen(false); }}
      />
      <AssignmentFormDialog
        open={!!editTarget}
        onOpenChange={(v) => !v && setEditTarget(null)}
        courseId={course.id}
        target={editTarget}
        onSaved={() => { onRefresh(); setEditTarget(null); }}
      />
      <AlertDialog open={!!deleteTarget} onOpenChange={(v) => !v && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("common.delete")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("courses.deleteCourseConfirm")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-white hover:bg-destructive/90"
              onClick={async () => {
                if (!deleteTarget) return;
                try {
                  await apiPost(`/api/admin/assignments/${deleteTarget.id}`, null, { method: "DELETE" });
                  toast({ title: t("common.success") });
                  setDeleteTarget(null);
                  onRefresh();
                } catch { /* toast */ }
              }}
            >
              {t("common.delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function AssignmentFormDialog({
  open, onOpenChange, courseId, target, onSaved,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  courseId: string;
  target?: AssignmentRow | null;
  onSaved: () => void;
}) {
  const { t } = useI18n();
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
      toast({ title: t("common.title") + " " + t("common.required"), variant: "destructive" });
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
        const res = await authFetch(`/api/admin/assignments/${target.id}`, {
          method: "PUT",
          body: fd,
          credentials: "include",
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || "Failed");
        markApiCacheStale();
        toast({ title: t("common.success") });
      } else {
        await apiUpload(`/api/admin/courses/${courseId}/assignments`, fd);
        toast({ title: t("common.success") });
      }
      onSaved();
    } catch (e) {
      if (e instanceof Error) {
        toast({ title: t("common.error"), description: e.message, variant: "destructive" });
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="animate-scale-in w-[95vw] max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-heading text-lg font-semibold">{target ? t("common.edit") : t("courses.addAssignment")}</DialogTitle>
          <DialogDescription>{t("courses.assignmentInstructions")}</DialogDescription>
        </DialogHeader>
        <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-1 scrollbar-thin">
          <div className="space-y-1.5">
            <Label htmlFor="a-title" className="text-xs font-medium text-muted-foreground">{t("courses.assignmentTitle")}</Label>
            <Input id="a-title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder={t("courses.assignmentTitle")} className="h-9 rounded-lg" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="a-desc" className="text-xs font-medium text-muted-foreground">{t("courses.assignmentDescription")}</Label>
            <Textarea id="a-desc" value={description} onChange={(e) => setDescription(e.target.value)} rows={2} className="rounded-lg" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="a-ins" className="text-xs font-medium text-muted-foreground">{t("courses.assignmentInstructions")}</Label>
            <Textarea id="a-ins" value={instructions} onChange={(e) => setInstructions(e.target.value)} rows={4} placeholder={t("courses.assignmentInstructions")} className="rounded-lg" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="a-due" className="text-xs font-medium text-muted-foreground">{t("courses.dueDate")}</Label>
            <Input id="a-due" type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className="h-9 rounded-lg" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="a-file" className="text-xs font-medium text-muted-foreground">{t("courses.assignmentFile")}</Label>
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
                <a href={target.fileUrl} target="_blank" rel="noopener noreferrer" className="text-accent hover:underline inline-flex items-center gap-1">
                  <ExternalLink className="h-3 w-3" /> {t("courses.assignmentFile")}
                </a>
                <label className="flex items-center gap-1 text-muted-foreground">
                  <Checkbox checked={clearFile} onCheckedChange={(v) => setClearFile(!!v)} />
                  {t("common.delete")}
                </label>
              </div>
            )}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="flex items-center justify-between rounded-lg border border-border p-3">
              <Label htmlFor="a-pub" className="text-sm font-medium">{t("common.published")}</Label>
              <Switch id="a-pub" checked={isPublished} onCheckedChange={setIsPublished} />
            </div>
            <div className="flex items-center justify-between rounded-lg border border-border p-3">
              <Label htmlFor="a-resub" className="text-sm font-medium">{t("courses.allowResubmission")}</Label>
              <Switch id="a-resub" checked={allowResubmission} onCheckedChange={setAllowResubmission} />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" className="h-9" onClick={() => onOpenChange(false)}>{t("common.cancel")}</Button>
          <Button disabled={saving} className="h-9" onClick={submit}>{saving ? t("common.saving") : target ? t("profile.saveChanges") : t("courses.addAssignment")}</Button>
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
  const [layout, setLayout] = useState<"CLASSIC" | "MODERN" | "MINIMAL">(template?.layout || "CLASSIC");
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
      await apiPost(`/api/admin/courses/${course.id}/certificate`, {
        isEnabled,
        title,
        bodyText,
        organizationName,
        layout,
      }, { method: "PUT" });
      toast({ title: t("common.success") });
      onRefresh();
    } catch { /* toast */ } finally {
      setSaving(false);
    }
  }

  // Live preview with sample data
  const previewText = bodyText
    .replace(/\{\{studentName\}\}/g, "Aisha Khalid")
    .replace(/\{\{courseName\}\}/g, course.title)
    .replace(/\{\{issueDate\}\}/g, formatDate(new Date()))
    .replace(/\{\{certificateNumber\}\}/g, "LL-SAMPLE-001")
    .replace(/\{\{organizationName\}\}/g, organizationName);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-heading text-base font-semibold text-foreground">{t("common.certificate")}</h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            {t("courses.certificateDesc")}
          </p>
        </div>
        <Button className="h-9 gap-2" disabled={saving} onClick={save}>
          <Save className="h-4 w-4" /> {saving ? t("common.saving") : t("courses.saveTemplate")}
        </Button>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="p-5 space-y-3 border-border bg-card shadow-sm">
          <CardHeader className="p-0">
            <CardTitle className="text-sm font-heading font-semibold">{t("courses.certificateSettings")}</CardTitle>
            <CardDescription className="mt-1">{t("courses.certificateDesc")}</CardDescription>
          </CardHeader>
          <CardContent className="p-0 space-y-3">
            {/* Info banner explaining the three certificate modes */}
            <div className="rounded-xl border border-accent/25 bg-soft-sage/60 p-3">
              <div className="flex items-start gap-2">
                <div className="flex h-6 w-6 items-center justify-center rounded-md bg-accent/15 text-accent shrink-0 mt-0.5">
                  <Info className="h-3.5 w-3.5" />
                </div>
                <div className="text-xs space-y-1.5">
                  <p className="font-semibold text-foreground">{t("courses.certificateInfo")}</p>
                  <p className="text-muted-foreground">
                    {t("courses.certificateDesc")}
                  </p>
                </div>
              </div>
            </div>
            <div className="flex items-center justify-between rounded-lg border border-border p-3">
              <Label htmlFor="c-enabled" className="text-sm font-medium">{t("courses.enableCertificates")}</Label>
              <Switch id="c-enabled" checked={isEnabled} onCheckedChange={setIsEnabled} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="c-title" className="text-xs font-medium text-muted-foreground">{t("courses.certificateTitle")}</Label>
              <Input id="c-title" value={title} onChange={(e) => setTitle(e.target.value)} className="h-9 rounded-lg" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="c-body" className="text-xs font-medium text-muted-foreground">{t("courses.bodyText")}</Label>
              <Textarea id="c-body" value={bodyText} onChange={(e) => setBodyText(e.target.value)} rows={4} className="rounded-lg" />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="c-org" className="text-xs font-medium text-muted-foreground">{t("courses.organizationName")}</Label>
                <Input id="c-org" value={organizationName} onChange={(e) => setOrganizationName(e.target.value)} className="h-9 rounded-lg" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-muted-foreground">{t("courses.layout")}</Label>
                <Select value={layout} onValueChange={(v) => setLayout(v as "CLASSIC" | "MODERN" | "MINIMAL")}>
                  <SelectTrigger className="w-full h-9 rounded-lg">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="CLASSIC">{t("courses.layout")}</SelectItem>
                    <SelectItem value="MODERN">{t("courses.layout")}</SelectItem>
                    <SelectItem value="MINIMAL">{t("courses.layout")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="p-5 space-y-3 border-border bg-card shadow-sm">
          <CardHeader className="p-0">
            <CardTitle className="text-sm font-heading font-semibold">{t("courses.livePreview")}</CardTitle>
            <CardDescription className="mt-1">{t("courses.livePreview")}</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <CertificatePreview
              title={title}
              bodyText={previewText}
              organizationName={organizationName}
              layout={layout}
              studentName="Aisha Khalid"
              courseTitle={course.title}
              certNumber="LL-SAMPLE-001"
              issueDate={formatDate(new Date())}
            />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function CertificatePreview({
  title, bodyText, organizationName, layout, studentName, courseTitle, certNumber, issueDate,
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
        <p className="text-[10px] uppercase tracking-widest text-muted-foreground">{organizationName}</p>
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
      <div className="rounded-xl border-2 border-accent/40 bg-gradient-to-br from-accent/[0.04] to-primary/[0.04] p-6">
        <div className="flex items-center justify-between">
          <Award className="h-8 w-8 text-accent" />
          <p className="text-[10px] uppercase tracking-widest text-muted-foreground">{organizationName}</p>
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
        <p className="text-[10px] uppercase tracking-[0.3em] text-muted-foreground">{organizationName}</p>
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
  course, plans, onRefresh, onDeleted,
}: {
  course: CourseDetail;
  plans: SubscriptionPlanPublic[];
  onRefresh: () => void;
  onDeleted: () => void;
}) {
  const { t } = useI18n();
  const navigate = useAppStore((s) => s.navigate);
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
    setPlanIds((cur) =>
      cur.includes(id) ? cur.filter((p) => p !== id) : [...cur, id]
    );
  }

  async function uploadThumbnail(file: File) {
    setUploadingThumb(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await apiUpload<{ thumbnail: string }>(
        `/api/admin/courses/${course.id}/thumbnail`,
        fd
      );
      setThumbnail(res.thumbnail);
      toast({ title: t("common.success") });
      onRefresh();
    } catch {
      /* toast */
    } finally {
      setUploadingThumb(false);
    }
  }

  async function save() {
    if (!title.trim()) {
      toast({ title: t("common.title") + " " + t("common.required"), variant: "destructive" });
      return;
    }
    if (accessType === "PAID" && planIds.length === 0) {
      toast({ title: t("courses.requiredPlans"), variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      await apiPost(`/api/admin/courses/${course.id}`, {
        title: title.trim(),
        description: description.trim() || null,
        category: category.trim() || null,
        accessType,
        isPublished,
        thumbnail: thumbnail.trim() || null,
        planIds,
      }, { method: "PUT" });
      toast({ title: t("common.success") });
      onRefresh();
    } catch { /* toast */ } finally {
      setSaving(false);
    }
  }

  async function doDelete() {
    try {
      await apiPost(`/api/admin/courses/${course.id}`, null, { method: "DELETE" });
      toast({ title: t("common.success"), description: course.title });
      onDeleted();
    } catch { /* toast */ }
  }

  return (
    <div className="space-y-4">
      <Card className="p-5 space-y-3 border-border bg-card shadow-sm">
        <CardHeader className="p-0">
          <CardTitle className="font-heading text-base font-semibold">{t("courses.courseDescription")}</CardTitle>
          <CardDescription className="mt-1">{t("courses.courseDescription")}</CardDescription>
        </CardHeader>
        <CardContent className="p-0 space-y-3">
          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-muted-foreground">{t("courses.courseThumbnail")}</Label>
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
                  placeholder={t("courses.courseThumbnail")}
                  className="h-9 rounded-lg"
                />
                <label className="inline-flex items-center gap-1.5 cursor-pointer text-xs text-accent hover:underline">
                  <Upload className="h-3.5 w-3.5" />
                  {uploadingThumb ? t("common.saving") : t("common.upload")}
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    disabled={uploadingThumb}
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      e.target.value = "";
                      if (f) uploadThumbnail(f);
                    }}
                  />
                </label>
              </div>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="s-title" className="text-xs font-medium text-muted-foreground">{t("common.title")}</Label>
            <Input id="s-title" value={title} onChange={(e) => setTitle(e.target.value)} className="h-9 rounded-lg" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="s-desc" className="text-xs font-medium text-muted-foreground">{t("common.description")}</Label>
            <Textarea id="s-desc" value={description} onChange={(e) => setDescription(e.target.value)} rows={3} className="rounded-lg" />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="s-cat" className="text-xs font-medium text-muted-foreground">{t("common.category")}</Label>
              <Input id="s-cat" value={category} onChange={(e) => setCategory(e.target.value)} className="h-9 rounded-lg" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-muted-foreground">{t("courses.accessType")}</Label>
              <Select value={accessType} onValueChange={(v) => setAccessType(v as "FREE" | "PAID")}>
                <SelectTrigger className="w-full h-9 rounded-lg">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="FREE">{t("common.free")}</SelectItem>
                  <SelectItem value="PAID">{t("common.paid")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {accessType === "PAID" && (
            <div className="space-y-2 rounded-lg border border-border p-3 bg-muted/30">
              <Label className="text-[11px] uppercase tracking-wider text-muted-foreground">{t("courses.requiredPlans")}</Label>
              {plans.length === 0 ? (
                <p className="text-xs text-destructive">{t("common.subscriptionPlans")}</p>
              ) : (
                <div className="space-y-2 max-h-32 overflow-y-auto scrollbar-thin">
                  {plans.map((p) => (
                    <label key={p.id} className="flex items-center gap-2 cursor-pointer rounded-md p-1.5 transition-colors hover:bg-background">
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
              <Label htmlFor="s-pub" className="text-sm font-medium">{t("common.published")}</Label>
              <p className="text-xs text-muted-foreground mt-0.5">{t("courses.published")}</p>
            </div>
            <Switch id="s-pub" checked={isPublished} onCheckedChange={setIsPublished} />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button disabled={saving} onClick={save} className="h-9 gap-2">
              <Save className="h-4 w-4" /> {saving ? t("common.saving") : t("profile.saveChanges")}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Danger zone */}
      <Card className="border-destructive/30 p-5 shadow-sm">
        <CardHeader className="p-0">
          <CardTitle className="font-heading text-base font-semibold text-destructive">{t("courses.dangerZone")}</CardTitle>
          <CardDescription className="mt-1">{t("courses.deleteCourseConfirm")}</CardDescription>
        </CardHeader>
        <CardContent className="p-0 mt-4">
          <div className="flex items-center justify-between rounded-xl border border-destructive/30 bg-destructive/5 p-4">
            <div>
              <p className="text-sm font-medium text-foreground">{t("courses.deleteCourse")}</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {t("courses.deleteCourseConfirm")}
              </p>
            </div>
            <Button
              variant="destructive"
              size="sm"
              className="h-9 gap-2"
              onClick={() => setDeleteOpen(true)}
            >
              <Trash2 className="h-4 w-4" /> {t("courses.deleteCourse")}
            </Button>
          </div>
        </CardContent>
      </Card>

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("courses.deleteCourse")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("courses.deleteCourseConfirm")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-white hover:bg-destructive/90"
              onClick={doDelete}
            >
              {t("common.delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <div className="flex items-center justify-between text-xs text-muted-foreground pt-2">
        <span>{formatDateTime(course.createdAt)}</span>
        <button
          className="text-accent hover:underline"
          onClick={() => navigate(["admin", "courses"])}
        >
          {t("common.back")}
        </button>
      </div>
    </div>
  );
}
