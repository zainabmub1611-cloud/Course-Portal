"use client";

import { useEffect, useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { EmptyState } from "@/components/shared/empty-state";
import { useApiFetch, apiPost, apiUpload } from "@/hooks/use-api";
import { useAppStore } from "@/stores/app-store";
import { useI18n } from "@/lib/i18n/store";
import { toast } from "@/hooks/use-toast";
import { formatDate, type SubscriptionPlanPublic } from "@/types";
import { CourseThumbnail } from "@/components/shared/course-thumbnail";
import {
  BookOpen, Search, Plus, MoreHorizontal, Pencil, Trash2, Settings2,
  Eye, EyeOff, Upload, PlayCircle, Video, Layers, CreditCard,
} from "lucide-react";

interface CourseRow {
  id: string;
  title: string;
  description: string | null;
  thumbnail: string | null;
  category: string | null;
  accessType: "FREE" | "PAID";
  isPublished: boolean;
  createdAt: string;
  topicsCount: number;
  videosCount: number;
  planNames: string[];
}

interface CoursesResponse { courses: CourseRow[] }
interface PlansResponse { plans: SubscriptionPlanPublic[] }

export function AdminCourses() {
  const { t } = useI18n();
  const query = useAppStore((s) => s.query);
  const navigate = useAppStore((s) => s.navigate);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("");
  const [published, setPublished] = useState<"ALL" | "true" | "false">("ALL");
  const [addOpen, setAddOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<CourseRow | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<CourseRow | null>(null);

  const { data: plansData } = useApiFetch<PlansResponse>("/api/public/plans");

  const qs = useMemo(() => {
    const p = new URLSearchParams();
    if (search.trim()) p.set("q", search.trim());
    if (category) p.set("category", category);
    if (published !== "ALL") p.set("published", published);
    const s = p.toString();
    return s ? `?${s}` : "";
  }, [search, category, published]);

  const { data, loading, error, refetch } = useApiFetch<CoursesResponse>(
    qs ? `/api/admin/courses${qs}` : "/api/admin/courses"
  );

  // Auto-open Add dialog when query.action=new — React 19 "store previous value" pattern
  const [lastAction, setLastAction] = useState<string | undefined>(undefined);
  if (query.action !== lastAction) {
    setLastAction(query.action);
    if (query.action === "new") setAddOpen(true);
  }

  const courses = data?.courses || [];

  // Derive unique categories for filter dropdown
  const categories = useMemo(() => {
    const set = new Set<string>();
    courses.forEach((c) => { if (c.category) set.add(c.category); });
    return Array.from(set).sort();
  }, [courses]);

  async function togglePublish(course: CourseRow) {
    try {
      await apiPost(`/api/admin/courses/${course.id}/publish`, {
        isPublished: !course.isPublished,
      }, { method: "PATCH" });
      toast({
        title: course.isPublished ? t("courses.unpublish") : t("courses.publish"),
        description: course.title,
      });
      refetch();
    } catch {
      /* toast */
    }
  }

  return (
    <div className="space-y-4">
      <Card className="border-border bg-card p-4 shadow-sm">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="flex flex-1 flex-col gap-3 sm:flex-row sm:items-center">
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={t("common.search")}
                className="h-9 rounded-lg pl-9 focus-visible:ring-2 focus-visible:ring-ring"
                aria-label={t("common.search")}
              />
            </div>
            <Select value={category || "ALL"} onValueChange={(v) => setCategory(v === "ALL" ? "" : v)}>
              <SelectTrigger className="h-9 w-full rounded-lg sm:w-[160px]" aria-label={t("common.category")}>
                <SelectValue placeholder={t("common.allCategories")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">{t("common.allCategories")}</SelectItem>
                {categories.map((c) => (
                  <SelectItem key={c} value={c}>{c}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={published}
              onValueChange={(v) => setPublished(v as "ALL" | "true" | "false")}
            >
              <SelectTrigger className="h-9 w-full rounded-lg sm:w-[140px]" aria-label={t("common.status")}>
                <SelectValue placeholder={t("common.allStatuses")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">{t("common.allStatuses")}</SelectItem>
                <SelectItem value="true">{t("common.published")}</SelectItem>
                <SelectItem value="false">{t("common.draft")}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button className="h-9 gap-2" onClick={() => setAddOpen(true)}>
            <Plus className="h-4 w-4" /> {t("courses.createCourse")}
          </Button>
        </div>
      </Card>

      {/* Course count summary */}
      {!loading && !error && courses.length > 0 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            {t("common.showing")} <span className="font-medium text-foreground">{courses.length}</span> {t("common.courses")}
          </p>
        </div>
      )}

      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Card key={i} className="overflow-hidden border-border p-0">
              <Skeleton className="h-36 w-full rounded-none" />
              <div className="p-5 space-y-3">
                <Skeleton className="h-4 w-1/3" />
                <Skeleton className="h-5 w-3/4" />
                <Skeleton className="h-4 w-full" />
                <div className="flex gap-2 pt-2">
                  <Skeleton className="h-8 w-20" />
                  <Skeleton className="h-8 w-20" />
                </div>
              </div>
            </Card>
          ))}
        </div>
      ) : error ? (
        <EmptyState
          className="m-4"
          icon={<BookOpen className="h-5 w-5" />}
          title={t("common.error")}
          description={error}
        />
      ) : courses.length === 0 ? (
        <EmptyState
          className="m-4"
          icon={<BookOpen className="h-5 w-5" />}
          title={t("empty.noCourses")}
          description={t("empty.noCoursesDesc")}
          action={<Button onClick={() => setAddOpen(true)} className="gap-2"><Plus className="h-4 w-4" /> {t("courses.createCourse")}</Button>}
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {courses.map((c) => (
            <CourseCard
              key={c.id}
              course={c}
              onManage={() => navigate(["admin", "courses", c.id])}
              onEdit={() => setEditTarget(c)}
              onTogglePublish={() => togglePublish(c)}
              onDelete={() => setDeleteTarget(c)}
            />
          ))}
        </div>
      )}

      <CourseFormDialog
        open={addOpen}
        onOpenChange={setAddOpen}
        plans={plansData?.plans || []}
        onSaved={(id) => {
          if (id) {
            toast({ title: t("common.success") });
            setAddOpen(false);
            navigate(["admin", "courses", id]);
          } else {
            refetch();
          }
        }}
      />

      <CourseFormDialog
        open={!!editTarget}
        onOpenChange={(v) => !v && setEditTarget(null)}
        target={editTarget}
        plans={plansData?.plans || []}
        onSaved={() => {
          refetch();
          setEditTarget(null);
          toast({ title: t("common.success") });
        }}
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
                  await apiPost(`/api/admin/courses/${deleteTarget.id}`, null, { method: "DELETE" });
                  toast({ title: t("common.success"), description: deleteTarget.title });
                  setDeleteTarget(null);
                  refetch();
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

interface CourseFormValues {
  title: string;
  description: string;
  category: string;
  accessType: "FREE" | "PAID";
  isPublished: boolean;
  thumbnail: string;
  planIds: string[];
}

function CourseFormDialog({
  open,
  onOpenChange,
  target,
  plans,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  target?: CourseRow | null;
  plans: SubscriptionPlanPublic[];
  onSaved: (createdId?: string) => void;
}) {
  const { t } = useI18n();
  const isEdit = !!target;
  const [values, setValues] = useState<CourseFormValues>({
    title: "",
    description: "",
    category: "",
    accessType: "FREE",
    isPublished: false,
    thumbnail: "",
    planIds: [],
  });
  const [saving, setSaving] = useState(false);
  const [uploadingThumb, setUploadingThumb] = useState(false);
  const [pendingThumbFile, setPendingThumbFile] = useState<File | null>(null);
  const [pendingThumbPreview, setPendingThumbPreview] = useState<string | null>(null);

  useEffect(() => {
    return () => {
      if (pendingThumbPreview && pendingThumbPreview.startsWith("blob:")) {
        URL.revokeObjectURL(pendingThumbPreview);
      }
    };
  }, [pendingThumbPreview]);

  useEffect(() => {
    setPendingThumbFile(null);
    setPendingThumbPreview(null);
    if (target) {
      setValues({
        title: target.title,
        description: target.description || "",
        category: target.category || "",
        accessType: target.accessType,
        isPublished: target.isPublished,
        thumbnail: target.thumbnail || "",
        planIds: [],
      });
    } else if (open) {
      setValues({
        title: "",
        description: "",
        category: "",
        accessType: "FREE",
        isPublished: false,
        thumbnail: "",
        planIds: [],
      });
    }
  }, [target, open]);

  function togglePlan(id: string) {
    setValues((v) => ({
      ...v,
      planIds: v.planIds.includes(id)
        ? v.planIds.filter((p) => p !== id)
        : [...v.planIds, id],
    }));
  }

  async function uploadThumbnail(file: File) {
    if (!target) {
      setPendingThumbFile(file);
      setPendingThumbPreview(URL.createObjectURL(file));
      return;
    }
    setUploadingThumb(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await apiUpload<{ thumbnail: string }>(`/api/admin/courses/${target.id}/thumbnail`, fd);
      setValues((v) => ({ ...v, thumbnail: res.thumbnail }));
      toast({ title: t("common.success") });
    } catch {
      /* toast */
    } finally {
      setUploadingThumb(false);
    }
  }

  async function submit() {
    if (!values.title.trim()) {
      toast({ title: t("common.title") + " " + t("common.required"), variant: "destructive" });
      return;
    }
    if (values.accessType === "PAID" && values.planIds.length === 0) {
      toast({
        title: t("courses.requiredPlans"),
        description: t("courses.requiredPlans"),
        variant: "destructive",
      });
      return;
    }

    setSaving(true);
    try {
      if (isEdit && target) {
        await apiPost(`/api/admin/courses/${target.id}`, {
          title: values.title.trim(),
          description: values.description.trim() || null,
          category: values.category.trim() || null,
          accessType: values.accessType,
          isPublished: values.isPublished,
          thumbnail: values.thumbnail || null,
          ...(values.accessType === "PAID" ? { planIds: values.planIds } : {}),
        }, { method: "PUT" });
        onSaved();
      } else {
        const res = await apiPost<{ course: { id: string } }>("/api/admin/courses", {
          title: values.title.trim(),
          description: values.description.trim() || null,
          category: values.category.trim() || null,
          accessType: values.accessType,
          isPublished: values.isPublished,
          thumbnail: values.thumbnail || null,
          planIds: values.planIds,
        });
        if (pendingThumbFile) {
          const fd = new FormData();
          fd.append("file", pendingThumbFile);
          await apiUpload<{ thumbnail: string }>(
            `/api/admin/courses/${res.course.id}/thumbnail`,
            fd
          );
        }
        onSaved(res.course.id);
      }
    } catch {
      /* toast */
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="animate-scale-in w-[95vw] max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-heading text-lg font-semibold">{isEdit ? t("courses.editCourse") : t("courses.createNewCourse")}</DialogTitle>
          <DialogDescription>
            {isEdit
              ? t("courses.editCourse")
              : t("courses.createCourse")}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-1">
          <div className="space-y-1.5">
            <Label htmlFor="cf-title" className="text-xs font-medium text-muted-foreground">{t("courses.courseTitle")}</Label>
            <Input id="cf-title" value={values.title} onChange={(e) => setValues({ ...values, title: e.target.value })} placeholder={t("courses.courseTitle")} className="h-9 rounded-lg" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="cf-desc" className="text-xs font-medium text-muted-foreground">{t("courses.courseDescription")}</Label>
            <Textarea id="cf-desc" value={values.description} onChange={(e) => setValues({ ...values, description: e.target.value })} placeholder={t("courses.courseDescription")} rows={3} className="rounded-lg" />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="cf-cat" className="text-xs font-medium text-muted-foreground">{t("courses.courseCategory")}</Label>
              <Input id="cf-cat" value={values.category} onChange={(e) => setValues({ ...values, category: e.target.value })} placeholder={t("courses.courseCategory")} className="h-9 rounded-lg" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-muted-foreground">{t("courses.accessType")}</Label>
              <Select value={values.accessType} onValueChange={(v) => setValues({ ...values, accessType: v as "FREE" | "PAID" })}>
                <SelectTrigger className="w-full h-9 rounded-lg">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="FREE">{t("courses.free_openToAll")}</SelectItem>
                  <SelectItem value="PAID">{t("common.paid")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {values.accessType === "PAID" && (
            <div className="space-y-2 rounded-lg border border-border p-3 bg-muted/30">
              <Label className="text-[11px] uppercase tracking-wider text-muted-foreground">{t("courses.requiredPlans")}</Label>
              <p className="text-xs text-muted-foreground -mt-1">
                {t("courses.requiredPlans")}
              </p>
              {plans.length === 0 ? (
                <p className="text-xs text-destructive">{t("common.subscriptionPlans")}</p>
              ) : (
                <div className="space-y-2 max-h-32 overflow-y-auto scrollbar-thin">
                  {plans.map((p) => (
                    <label key={p.id} className="flex items-center gap-2 cursor-pointer rounded-md p-1.5 transition-colors hover:bg-background">
                      <Checkbox
                        checked={values.planIds.includes(p.id)}
                        onCheckedChange={() => togglePlan(p.id)}
                      />
                      <span className="text-sm text-foreground">{p.name}</span>
                      <Badge variant="outline" className="ml-auto text-xs">{p.price} {p.currency}</Badge>
                    </label>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Thumbnail */}
          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-muted-foreground">{t("courses.courseThumbnail")}</Label>
            <div className="flex items-center gap-3">
              <div className="h-16 w-24 overflow-hidden rounded-lg bg-muted flex items-center justify-center shrink-0 ring-1 ring-border">
                {(pendingThumbPreview || values.thumbnail) ? (
                  <img src={pendingThumbPreview || values.thumbnail} alt="" className="h-full w-full object-cover" />
                ) : (
                  <PlayCircle className="h-5 w-5 text-muted-foreground" />
                )}
              </div>
              <div className="flex-1 space-y-1.5">
                <Input
                  value={values.thumbnail}
                  onChange={(e) => setValues({ ...values, thumbnail: e.target.value })}
                  placeholder={t("courses.courseThumbnail")}
                  className="h-9 rounded-lg"
                />
                <label className="inline-flex items-center gap-1.5 cursor-pointer text-xs text-accent hover:underline">
                  <Upload className="h-3.5 w-3.5" />
                  {uploadingThumb ? t("common.saving") : pendingThumbFile ? pendingThumbFile.name : t("common.upload")}
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

          {/* Published switch */}
          <div className="flex items-center justify-between rounded-lg border border-border p-3">
            <div>
              <Label htmlFor="cf-pub" className="text-sm font-medium">{t("courses.publishImmediately")}</Label>
              <p className="text-xs text-muted-foreground mt-0.5">{t("courses.draft")}</p>
            </div>
            <Switch
              id="cf-pub"
              checked={values.isPublished}
              onCheckedChange={(v) => setValues({ ...values, isPublished: v })}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" className="h-9" onClick={() => onOpenChange(false)}>{t("common.cancel")}</Button>
          <Button disabled={saving} className="h-9" onClick={submit}>
            {saving ? t("common.saving") : isEdit ? t("profile.saveChanges") : t("courses.createCourse")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Premium Course Card ────────────────────────────────────────────────
function CourseCard({
  course,
  onManage,
  onEdit,
  onTogglePublish,
  onDelete,
}: {
  course: CourseRow;
  onManage: () => void;
  onEdit: () => void;
  onTogglePublish: () => void;
  onDelete: () => void;
}) {
  const { t } = useI18n();
  return (
    <Card className="group card-glow flex flex-col overflow-hidden border-border p-0 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md hover:border-accent/30">
      {/* Cover image */}
      <button onClick={onManage} className="relative h-36 overflow-hidden bg-muted text-left">
        <CourseThumbnail
          thumbnail={course.thumbnail}
          firstVideoUrl={(course as any).firstVideoUrl}
          firstVideoSource={(course as any).firstVideoSource}
          alt={course.title}
          className="h-full w-full"
        />
        {/* Badge overlays */}
        <div className="absolute top-3 left-3 flex gap-1.5">
          {course.accessType === "FREE" ? (
            <Badge className="border-0 bg-success/95 text-success-foreground backdrop-blur shadow-sm">{t("common.free")}</Badge>
          ) : (
            <Badge className="border-0 bg-primary/95 text-primary-foreground backdrop-blur shadow-sm">{t("common.paid")}</Badge>
          )}
          {course.category && (
            <Badge variant="outline" className="border-0 bg-background/85 text-foreground backdrop-blur shadow-sm">
              {course.category}
            </Badge>
          )}
        </div>
        <div className="absolute top-3 right-3">
          {course.isPublished ? (
            <Badge className="border-0 bg-success/95 text-success-foreground backdrop-blur shadow-sm gap-1">
              {t("common.published")}
            </Badge>
          ) : (
            <Badge variant="outline" className="border-0 bg-background/85 text-muted-foreground backdrop-blur shadow-sm">
              {t("common.draft")}
            </Badge>
          )}
        </div>
      </button>

      {/* Content */}
      <div className="flex flex-1 flex-col p-5">
        <button onClick={onManage} className="text-left">
          <h3 className="font-heading font-semibold text-foreground line-clamp-1 transition-colors duration-200 group-hover:text-accent">
            {course.title}
          </h3>
          <p className="mt-1 text-sm text-muted-foreground line-clamp-2 min-h-[2.5rem]">
            {course.description || t("common.description")}
          </p>
        </button>

        {/* Stats row */}
        <div className="mt-4 flex items-center gap-4 border-t border-border pt-3 text-xs">
          <span className="flex items-center gap-1 text-muted-foreground">
            <Layers className="h-3.5 w-3.5 text-accent" />
            <span className="font-semibold text-foreground">{course.topicsCount}</span> {t("common.topics")}
          </span>
          <span className="flex items-center gap-1 text-muted-foreground">
            <Video className="h-3.5 w-3.5 text-accent" />
            <span className="font-semibold text-foreground">{course.videosCount}</span> {t("common.lessons")}
          </span>
          {course.accessType === "PAID" && course.planNames.length > 0 && (
            <span className="flex items-center gap-1 text-muted-foreground truncate">
              <CreditCard className="h-3.5 w-3.5 text-accent" />
              <span className="font-semibold text-foreground">{course.planNames.length}</span> {t("common.subscriptionPlans")}
            </span>
          )}
        </div>

        {/* Actions */}
        <div className="mt-4 flex items-center gap-2">
          <Button size="sm" className="h-9 flex-1 gap-1.5" onClick={onManage}>
            <Settings2 className="h-3.5 w-3.5" /> {t("common.manage")}
          </Button>
          <Button variant="outline" size="sm" className="h-9 gap-1.5" onClick={onEdit} aria-label={t("common.edit")}>
            <Pencil className="h-3.5 w-3.5" />
            <span className="sr-only">{t("common.edit")}</span>
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="h-9 px-2" aria-label={`More actions for ${course.title}`}>
                <MoreHorizontal className="h-3.5 w-3.5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuItem onClick={onTogglePublish} className="gap-2">
                {course.isPublished ? (
                  <><EyeOff className="h-4 w-4 text-muted-foreground" /> {t("courses.unpublish")}</>
                ) : (
                  <><Eye className="h-4 w-4 text-muted-foreground" /> {t("courses.publish")}</>
                )}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={onEdit} className="gap-2">
                <Pencil className="h-4 w-4 text-muted-foreground" /> {t("common.edit")}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem variant="destructive" onClick={onDelete} className="gap-2">
                <Trash2 className="h-4 w-4" /> {t("common.delete")}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </Card>
  );
}
