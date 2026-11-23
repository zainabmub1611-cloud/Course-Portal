"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
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
import { formatDate } from "@/types";
import {
  ClipboardList, Search, Plus, MoreHorizontal, Pencil, Trash2, ExternalLink, Eye,
} from "lucide-react";

interface CourseListItem {
  id: string;
  title: string;
  isPublished: boolean;
}

interface AssignmentListRow {
  id: string;
  title: string;
  description: string | null;
  instructions: string | null;
  fileUrl: string | null;
  dueDate: string | null;
  isPublished: boolean;
  allowResubmission: boolean;
  createdAt: string;
  course: { id: string; title: string };
  submissionsCount: number;
}

export function UniversityAssignments() {
  const { t } = useI18n();
  const navigate = useAppStore((s) => s.navigate);
  const query = useAppStore((s) => s.query);
  const isInstructor = useAppStore((s) => s.user?.role === "INSTRUCTOR");
  const [search, setSearch] = useState("");
  const [courseFilter, setCourseFilter] = useState<string>("ALL");
  const [addOpen, setAddOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<AssignmentListRow | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<AssignmentListRow | null>(null);
  const [viewTarget, setViewTarget] = useState<AssignmentListRow | null>(null);

  const { data: coursesData } = useApiFetch<{ courses: CourseListItem[] }>(
    "/api/university/courses"
  );

  const qs = useMemo(() => {
    const p = new URLSearchParams();
    if (search.trim()) p.set("q", search.trim());
    if (courseFilter !== "ALL") p.set("courseId", courseFilter);
    const s = p.toString();
    return s ? `?${s}` : "";
  }, [search, courseFilter]);

  const { data, loading, error, refetch } = useApiFetch<{ assignments: AssignmentListRow[] }>(
    qs ? `/api/university/assignments${qs}` : "/api/university/assignments"
  );

  // Auto-open Add dialog when query.action=new — React 19 "store previous value" pattern
  const [lastAction, setLastAction] = useState<string | undefined>(undefined);
  if (query.action !== lastAction) {
    setLastAction(query.action);
    if (query.action === "new" && !isInstructor) setAddOpen(true);
  }

  const assignments = data?.assignments || [];

  function openAdd() {
    setEditTarget(null);
    setAddOpen(true);
  }

  return (
    <div className="space-y-4">
      <Card className="rounded-lg border-border bg-card p-4 shadow-sm">
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
              <SelectTrigger className="h-9 w-full rounded-lg sm:w-[200px]" aria-label={t("common.course")}>
                <SelectValue placeholder="All courses" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">{t("common.all")}</SelectItem>
                {(coursesData?.courses || []).map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.title}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {!isInstructor && (
            <Button className="h-9 gap-2" onClick={openAdd}>
              <Plus className="h-4 w-4" /> Add Assignment
            </Button>
          )}
        </div>
      </Card>

      <Card className="rounded-lg border-border bg-card p-0 shadow-sm overflow-hidden">
        {loading ? (
          <div className="space-y-2 p-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        ) : error ? (
          <EmptyState className="m-4" icon={<ClipboardList className="h-5 w-5" />} title={t("common.error")} description={error} />
        ) : assignments.length === 0 ? (
          <EmptyState
            className="m-4"
            icon={<ClipboardList className="h-5 w-5" />}
            title={t("common.assignments")}
            description={
              isInstructor
                ? "No assignments found for your assigned courses."
                : "Create assignments so students can submit work for your review."
            }
            action={
              !isInstructor ? (
                <Button onClick={openAdd} className="gap-2"><Plus className="h-4 w-4" /> Add Assignment</Button>
              ) : undefined
            }
          />
        ) : (
          <div className="overflow-x-auto scrollbar-thin">
<Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Assignment</TableHead>
                <TableHead className="hidden text-xs font-semibold uppercase tracking-wider text-muted-foreground md:table-cell">Course</TableHead>
                <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Due</TableHead>
                <TableHead className="text-center text-xs font-semibold uppercase tracking-wider text-muted-foreground">Submissions</TableHead>
                <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Status</TableHead>
                <TableHead className="text-right text-xs font-semibold uppercase tracking-wider text-muted-foreground">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {assignments.map((a) => (
                <TableRow key={a.id} className="hover:bg-muted/40">
                  <TableCell>
                    <div className="min-w-0 max-w-[260px]">
                      <p className="font-medium text-foreground truncate">{a.title}</p>
                      {a.description && (
                        <p className="text-xs text-muted-foreground truncate">{a.description}</p>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="hidden text-sm text-foreground md:table-cell">{a.course.title}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {a.dueDate ? formatDate(a.dueDate) : "—"}
                  </TableCell>
                  <TableCell className="text-center">
                    <button
                      className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-sm font-medium text-accent transition-colors hover:bg-accent/10"
                      onClick={() => navigate(["university", "submissions"], { assignmentId: a.id })}
                    >
                      {a.submissionsCount}
                    </button>
                  </TableCell>
                  <TableCell>
                    {a.isPublished ? (
                      <Badge className="bg-success/15 text-success">{t("common.published")}</Badge>
                    ) : (
                      <Badge variant="outline" className="text-muted-foreground">{t("common.draft")}</Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 gap-1"
                        onClick={() => setViewTarget(a)}
                      >
                        <Eye className="h-3.5 w-3.5" /> View
                      </Button>
                      {a.fileUrl && (
                        <a
                          href={a.fileUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-accent"
                          aria-label="View assignment brief"
                        >
                          <ExternalLink className="h-3.5 w-3.5" />
                        </a>
                      )}
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-8 gap-1"
                        onClick={() => navigate(["university", "submissions"], { assignmentId: a.id })}
                      >
                        View Submissions
                      </Button>
                      {!isInstructor && (
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" aria-label={`Actions for ${a.title}`} className="text-muted-foreground hover:text-foreground hover:bg-muted">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-48">
                            <DropdownMenuItem onClick={() => { setEditTarget(a); setAddOpen(true); }} className="gap-2">
                              <Pencil className="h-4 w-4 text-muted-foreground" /> Edit
                            </DropdownMenuItem>
                            <DropdownMenuItem variant="destructive" onClick={() => setDeleteTarget(a)} className="gap-2">
                              <Trash2 className="h-4 w-4" /> Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
</div>
        )}
      </Card>

      <Dialog open={!!viewTarget} onOpenChange={(v) => !v && setViewTarget(null)}>
        <DialogContent className="w-[95vw] max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ClipboardList className="h-4 w-4 text-accent" />
              {viewTarget?.title}
            </DialogTitle>
            <DialogDescription>
              {viewTarget?.course.title}
              {viewTarget?.dueDate ? ` · Due ${formatDate(viewTarget.dueDate)}` : ""}
            </DialogDescription>
          </DialogHeader>
          {viewTarget && (
            <div className="space-y-4">
              {viewTarget.description && (
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">
                    Description
                  </p>
                  <p className="text-sm text-foreground whitespace-pre-wrap">{viewTarget.description}</p>
                </div>
              )}
              {viewTarget.instructions && (
                <div className="rounded-lg border border-border bg-muted/40 p-3.5">
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">
                    Instructions
                  </p>
                  <p className="text-sm text-foreground whitespace-pre-wrap">{viewTarget.instructions}</p>
                </div>
              )}
              {viewTarget.fileUrl && (
                <a
                  href={viewTarget.fileUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-sm font-medium text-accent hover:bg-muted"
                >
                  <ExternalLink className="h-4 w-4" /> Open Attachment
                </a>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setViewTarget(null)}>Close</Button>
            {viewTarget && (
              <Button
                onClick={() => {
                  const id = viewTarget.id;
                  setViewTarget(null);
                  navigate(["university", "submissions"], { assignmentId: id });
                }}
              >
                View Submissions ({viewTarget.submissionsCount})
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {!isInstructor && (
        <>
          <AssignmentFormDialog
            open={addOpen}
            onOpenChange={setAddOpen}
            courses={coursesData?.courses || []}
            target={editTarget}
            onSaved={() => {
              refetch();
              setAddOpen(false);
              setEditTarget(null);
            }}
          />

          <AlertDialog open={!!deleteTarget} onOpenChange={(v) => !v && setDeleteTarget(null)}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete assignment?</AlertDialogTitle>
                <AlertDialogDescription>
                  This will permanently delete <strong>{deleteTarget?.title}</strong> and all {deleteTarget?.submissionsCount || 0} submission(s) associated with it.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
                <AlertDialogAction
                  className="bg-destructive text-white hover:bg-destructive/90"
                  onClick={async () => {
                    if (!deleteTarget) return;
                    try {
                      await apiPost(`/api/university/assignments/${deleteTarget.id}`, null, { method: "DELETE" });
                      toast({ title: "Assignment deleted" });
                      setDeleteTarget(null);
                      refetch();
                    } catch { /* toast */ }
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
  courses,
  target,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  courses: CourseListItem[];
  target: AssignmentListRow | null;
  onSaved: () => void;
}) {
  const { t } = useI18n();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [instructions, setInstructions] = useState("");
  const [courseId, setCourseId] = useState<string>("");
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
      setCourseId(target.course.id);
      setDueDate(target.dueDate ? target.dueDate.slice(0, 10) : "");
      setIsPublished(target.isPublished);
      setAllowResubmission(target.allowResubmission);
    } else if (open) {
      setTitle("");
      setDescription("");
      setInstructions("");
      setCourseId("");
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
    if (!courseId) {
      toast({ title: "Select a course", variant: "destructive" });
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
          <DialogTitle className="font-heading text-lg font-semibold">{target ? "Edit Assignment" : "Add Assignment"}</DialogTitle>
          <DialogDescription>Create a task for students to complete and submit.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-1 scrollbar-thin">
          <div className="space-y-1.5">
            <Label htmlFor="ga-title" className="text-xs font-medium text-muted-foreground">Title</Label>
            <Input id="ga-title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Final Project" className="h-9 rounded-lg" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-muted-foreground">Course</Label>
            <Select value={courseId} onValueChange={setCourseId}>
              <SelectTrigger className="w-full h-9 rounded-lg">
                <SelectValue placeholder="Select course" />
              </SelectTrigger>
              <SelectContent>
                {courses.map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.title}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ga-desc" className="text-xs font-medium text-muted-foreground">Short Description</Label>
            <Textarea id="ga-desc" value={description} onChange={(e) => setDescription(e.target.value)} rows={2} className="rounded-lg" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ga-ins" className="text-xs font-medium text-muted-foreground">Instructions</Label>
            <Textarea id="ga-ins" value={instructions} onChange={(e) => setInstructions(e.target.value)} rows={4} className="rounded-lg" />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="ga-due" className="text-xs font-medium text-muted-foreground">Due Date (optional)</Label>
              <Input id="ga-due" type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className="h-9 rounded-lg" />
            </div>
            <div className="flex items-center justify-between rounded-lg border border-border px-3">
              <Label htmlFor="ga-pub" className="text-sm font-medium">Published</Label>
              <Switch id="ga-pub" checked={isPublished} onCheckedChange={setIsPublished} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ga-file" className="text-xs font-medium text-muted-foreground">Attachment File (optional)</Label>
            <Input
              ref={fileInputRef}
              id="ga-file"
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
                  <ExternalLink className="h-3 w-3" /> Current file
                </a>
                <label className="flex items-center gap-1 text-muted-foreground">
                  <Checkbox checked={clearFile} onCheckedChange={(v) => setClearFile(!!v)} />
                  Remove existing
                </label>
              </div>
            )}
          </div>
          <div className="flex items-center justify-between rounded-lg border border-border p-3">
            <div>
              <Label htmlFor="ga-resub" className="text-sm font-medium">Allow resubmission</Label>
              <p className="text-xs text-muted-foreground mt-0.5">Let students submit again after review.</p>
            </div>
            <Switch id="ga-resub" checked={allowResubmission} onCheckedChange={setAllowResubmission} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" className="h-9" onClick={() => onOpenChange(false)}>{t("common.cancel")}</Button>
          <Button disabled={saving} className="h-9" onClick={submit}>{saving ? "Saving…" : target ? "Save Changes" : "Add Assignment"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
