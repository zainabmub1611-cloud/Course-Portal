"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { EmptyState } from "@/components/shared/empty-state";
import { useApiFetch, apiPost, apiUpload, authFetch, markApiCacheStale } from "@/hooks/use-api";
import { useAppStore } from "@/stores/app-store";
import { useI18n } from "@/lib/i18n/store";
import { toast } from "@/hooks/use-toast";
import { fileExtIcon, formatDate } from "@/types";
import {
  FileText, Search, Plus, MoreHorizontal, Pencil, Trash2, ExternalLink,
  FileType, FileType2, Presentation, Link as LinkIcon,
} from "lucide-react";

interface CourseListItem {
  id: string;
  title: string;
  isPublished: boolean;
}

interface MaterialListRow {
  id: string;
  title: string;
  description: string | null;
  type: "PDF" | "DOC" | "PRESENTATION" | "LINK";
  fileUrl: string;
  isPublished: boolean;
  createdAt: string;
  course: { id: string; title: string };
  topic: { id: string; title: string } | null;
}

interface CourseDetailForForm {
  id: string;
  title: string;
  topics: { id: string; title: string }[];
}

export function AdminMaterials() {
  const { t } = useI18n();
  const query = useAppStore((s) => s.query);
  const [search, setSearch] = useState("");
  const [courseFilter, setCourseFilter] = useState<string>("ALL");
  const [typeFilter, setTypeFilter] = useState<string>("ALL");
  const [addOpen, setAddOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<MaterialListRow | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<MaterialListRow | null>(null);
  const [formCourseId, setFormCourseId] = useState<string | null>(null);

  // Use the admin courses list (lighter than fetching full course detail).
  const { data: coursesData } = useApiFetch<{ courses: CourseListItem[] }>("/api/admin/courses");

  const qs = useMemo(() => {
    const p = new URLSearchParams();
    if (search.trim()) p.set("q", search.trim());
    if (courseFilter !== "ALL") p.set("courseId", courseFilter);
    if (typeFilter !== "ALL") p.set("type", typeFilter);
    const s = p.toString();
    return s ? `?${s}` : "";
  }, [search, courseFilter, typeFilter]);

  const { data, loading, error, refetch } = useApiFetch<{ materials: MaterialListRow[] }>(
    qs ? `/api/admin/materials${qs}` : "/api/admin/materials"
  );

  // Auto-open Add dialog when query.action=new — React 19 "store previous value" pattern
  const [lastAction, setLastAction] = useState<string | undefined>(undefined);
  if (query.action !== lastAction) {
    setLastAction(query.action);
    if (query.action === "new") {
      setFormCourseId(null);
      setAddOpen(true);
    }
  }

  const materials = data?.materials || [];

  // Fetch course detail for the form (topics list)
  const [detailCourseId, setDetailCourseId] = useState<string | null>(null);
  const { data: courseDetail } = useApiFetch<{ course: CourseDetailForForm }>(
    detailCourseId ? `/api/admin/courses/${detailCourseId}` : null,
    { skip: !detailCourseId }
  );

  function openAdd() {
    setFormCourseId(null);
    setAddOpen(true);
  }

  function openEdit(m: MaterialListRow) {
    setEditTarget(m);
    setDetailCourseId(m.course.id);
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
            <Select value={courseFilter} onValueChange={setCourseFilter}>
              <SelectTrigger className="h-9 w-full rounded-lg sm:w-[180px]" aria-label={t("common.course")}>
                <SelectValue placeholder={t("common.all")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">{t("common.all")}</SelectItem>
                {(coursesData?.courses || []).map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.title}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="h-9 w-full rounded-lg sm:w-[140px]" aria-label={t("common.type")}>
                <SelectValue placeholder={t("common.allTypes")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">{t("common.allTypes")}</SelectItem>
                <SelectItem value="PDF">PDF</SelectItem>
                <SelectItem value="DOC">{t("common.description")}</SelectItem>
                <SelectItem value="PRESENTATION">{t("courses.materialTitle")}</SelectItem>
                <SelectItem value="LINK">{t("courses.directUrl")}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button className="h-9 gap-2" onClick={openAdd}>
            <Plus className="h-4 w-4" /> {t("courses.addMaterial")}
          </Button>
        </div>
      </Card>

      <Card className="border-border bg-card p-0 shadow-sm overflow-hidden">
        {loading ? (
          <div className="space-y-2 p-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        ) : error ? (
          <EmptyState className="m-4" icon={<FileText className="h-5 w-5" />} title={t("common.error")} description={error} />
        ) : materials.length === 0 ? (
          <EmptyState
            className="m-4"
            icon={<FileText className="h-5 w-5" />}
            title={t("common.learningMaterials")}
            description={t("common.learningMaterials")}
            action={<Button onClick={openAdd} className="gap-2"><Plus className="h-4 w-4" /> {t("courses.addMaterial")}</Button>}
          />
        ) : (
          <div className="overflow-x-auto scrollbar-thin">
<Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{t("common.material")}</TableHead>
                <TableHead className="hidden text-xs font-semibold uppercase tracking-wider text-muted-foreground md:table-cell">{t("table.course")}</TableHead>
                <TableHead className="hidden text-xs font-semibold uppercase tracking-wider text-muted-foreground lg:table-cell">{t("common.topic")}</TableHead>
                <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{t("common.type")}</TableHead>
                <TableHead className="hidden text-xs font-semibold uppercase tracking-wider text-muted-foreground md:table-cell">{t("common.date")}</TableHead>
                <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{t("common.status")}</TableHead>
                <TableHead className="text-right text-xs font-semibold uppercase tracking-wider text-muted-foreground">{t("table.actions")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {materials.map((m) => (
                <TableRow key={m.id} className="hover:bg-muted/40">
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <FileTypeIcon type={m.type} />
                      <div className="min-w-0 max-w-[240px]">
                        <p className="font-medium text-foreground truncate">{m.title}</p>
                        {m.description && (
                          <p className="text-xs text-muted-foreground truncate">{m.description}</p>
                        )}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="hidden text-sm text-foreground md:table-cell">{m.course.title}</TableCell>
                  <TableCell className="hidden text-sm text-muted-foreground lg:table-cell">
                    {m.topic?.title || "—"}
                  </TableCell>
                  <TableCell>
                    <FileTypeBadge type={m.type} />
                  </TableCell>
                  <TableCell className="hidden text-sm text-muted-foreground md:table-cell">
                    {formatDate(m.createdAt)}
                  </TableCell>
                  <TableCell>
                    {m.isPublished ? (
                      <Badge className="bg-success/15 text-success">{t("common.published")}</Badge>
                    ) : (
                      <Badge variant="outline" className="text-muted-foreground">{t("common.draft")}</Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <a
                        href={m.fileUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-accent"
                        aria-label={t("common.view")}
                      >
                        <ExternalLink className="h-3.5 w-3.5" />
                      </a>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" aria-label={`Actions for ${m.title}`} className="text-muted-foreground hover:text-foreground hover:bg-muted">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-48">
                          <DropdownMenuItem onClick={() => openEdit(m)} className="gap-2">
                            <Pencil className="h-4 w-4 text-muted-foreground" /> {t("common.edit")}
                          </DropdownMenuItem>
                          <DropdownMenuItem variant="destructive" onClick={() => setDeleteTarget(m)} className="gap-2">
                            <Trash2 className="h-4 w-4" /> {t("common.delete")}
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
</div>
        )}
      </Card>

      {/* Add / Edit Material Dialog */}
      <GlobalMaterialFormDialog
        open={addOpen}
        onOpenChange={setAddOpen}
        courses={coursesData?.courses || []}
        courseDetail={courseDetail?.course || null}
        onCourseChange={(id) => setDetailCourseId(id)}
        onSaved={() => {
          refetch();
          setAddOpen(false);
        }}
      />

      <GlobalMaterialFormDialog
        open={!!editTarget}
        onOpenChange={(v) => !v && setEditTarget(null)}
        courses={coursesData?.courses || []}
        courseDetail={courseDetail?.course || null}
        target={editTarget}
        onCourseChange={(id) => setDetailCourseId(id)}
        onSaved={() => {
          refetch();
          setEditTarget(null);
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
                  await apiPost(`/api/admin/materials/${deleteTarget.id}`, null, { method: "DELETE" });
                  toast({ title: t("common.success") });
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

function GlobalMaterialFormDialog({
  open, onOpenChange, courses, courseDetail, target, onCourseChange, onSaved,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  courses: CourseListItem[];
  courseDetail: CourseDetailForForm | null;
  target?: MaterialListRow | null;
  onCourseChange: (id: string) => void;
  onSaved: () => void;
}) {
  const { t } = useI18n();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [courseId, setCourseId] = useState<string>("");
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
      setCourseId(target.course.id);
      onCourseChange(target.course.id);
      setTopicId(target.topic?.id || "none");
      setType(target.type);
      setFileUrl(target.type === "LINK" ? target.fileUrl : "");
      setIsPublished(target.isPublished);
    } else if (open) {
      setTitle("");
      setDescription("");
      setCourseId("");
      setTopicId("none");
      setType("PDF");
      setFileUrl("");
      setIsPublished(true);
    }
    setFile(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }, [target, open]);

  function onCourseChange2(id: string) {
    setCourseId(id);
    setTopicId("none");
    onCourseChange(id);
  }

  async function submit() {
    if (!title.trim()) {
      toast({ title: t("common.title") + " " + t("common.required"), variant: "destructive" });
      return;
    }
    if (!courseId) {
      toast({ title: t("common.course") + " " + t("common.required"), variant: "destructive" });
      return;
    }
    if (type === "LINK" && !fileUrl.trim() && !target) {
      toast({ title: t("courses.directUrl") + " " + t("common.required"), variant: "destructive" });
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
        await apiUpload(`/api/admin/courses/${courseId}/materials`, fd);
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
        <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-1">
          <div className="space-y-1.5">
            <Label htmlFor="gm-title" className="text-xs font-medium text-muted-foreground">{t("common.title")}</Label>
            <Input id="gm-title" value={title} onChange={(e) => setTitle(e.target.value)} className="h-9 rounded-lg" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="gm-desc" className="text-xs font-medium text-muted-foreground">{t("common.description")} ({t("common.optional")})</Label>
            <Input id="gm-desc" value={description} onChange={(e) => setDescription(e.target.value)} className="h-9 rounded-lg" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-muted-foreground">{t("common.course")}</Label>
            <Select value={courseId} onValueChange={onCourseChange2}>
              <SelectTrigger className="w-full h-9 rounded-lg">
                <SelectValue placeholder={t("common.course")} />
              </SelectTrigger>
              <SelectContent>
                {courses.map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.title}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {courseDetail && (
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-muted-foreground">{t("common.topic")} ({t("common.optional")})</Label>
              <Select value={topicId} onValueChange={setTopicId}>
                <SelectTrigger className="w-full h-9 rounded-lg">
                  <SelectValue placeholder={t("common.topic")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">{t("common.topic")}</SelectItem>
                  {courseDetail.topics.map((tp) => (
                    <SelectItem key={tp.id} value={tp.id}>{tp.title}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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
            <div className="flex items-center justify-between rounded-lg border border-border px-3">
              <Label htmlFor="gm-pub" className="text-sm font-medium">{t("common.published")}</Label>
              <Switch id="gm-pub" checked={isPublished} onCheckedChange={setIsPublished} />
            </div>
          </div>
          {type === "LINK" ? (
            <div className="space-y-1.5">
              <Label htmlFor="gm-url" className="text-xs font-medium text-muted-foreground">{t("courses.directUrl")}</Label>
              <Input id="gm-url" value={fileUrl} onChange={(e) => setFileUrl(e.target.value)} placeholder="https://…" className="h-9 rounded-lg" />
            </div>
          ) : (
            <div className="space-y-1.5">
              <Label htmlFor="gm-file" className="text-xs font-medium text-muted-foreground">{t("courses.videoFile")}</Label>
              <Input ref={fileInputRef} id="gm-file" type="file" onChange={(e) => setFile(e.target.files?.[0] || null)} accept=".pdf,.doc,.docx,.ppt,.pptx,.txt" />
              {target && !file && (
                <p className="text-xs text-muted-foreground">{t("courses.videoFile")}</p>
              )}
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" className="h-9" onClick={() => onOpenChange(false)}>{t("common.cancel")}</Button>
          <Button disabled={saving} className="h-9" onClick={submit}>{saving ? t("common.saving") : target ? t("profile.saveChanges") : t("courses.addMaterial")}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── File type helpers ─────────────────────────────────────────────────
function FileTypeIcon({ type }: { type: "PDF" | "DOC" | "PRESENTATION" | "LINK" }) {
  const config = {
    PDF: { icon: FileType, bg: "bg-destructive/10", color: "text-destructive" },
    DOC: { icon: FileType2, bg: "bg-accent/10", color: "text-accent" },
    PRESENTATION: { icon: Presentation, bg: "bg-warning/15", color: "text-warning" },
    LINK: { icon: LinkIcon, bg: "bg-success/15", color: "text-success" },
  };
  const c = config[type];
  return (
    <div className={`flex h-9 w-9 items-center justify-center rounded-lg ${c.bg} ${c.color} shrink-0`}>
      <c.icon className="h-4 w-4" />
    </div>
  );
}

function FileTypeBadge({ type }: { type: "PDF" | "DOC" | "PRESENTATION" | "LINK" }) {
  const config = {
    PDF: { label: "PDF", className: "bg-destructive/10 text-destructive" },
    DOC: { label: fileExtIcon(".docx"), className: "bg-accent/10 text-accent" },
    PRESENTATION: { label: fileExtIcon(".pptx"), className: "bg-warning/15 text-warning" },
    LINK: { label: "LINK", className: "bg-success/15 text-success" },
  };
  const c = config[type];
  return (
    <Badge variant="outline" className={`border-0 ${c.className}`}>
      {c.label}
    </Badge>
  );
}
