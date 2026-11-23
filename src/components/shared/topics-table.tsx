"use client";

import { useMemo, useRef, useState } from "react";
import { ArrowUp, ArrowDown, Trash2, Plus, Save, AlertCircle, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { apiPost } from "@/hooks/use-api";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

export const MAX_COURSE_TOPICS = 10;

export interface TopicTableItem {
  id: string;
  title: string;
  description: string | null;
  displayOrder: number;
}

interface DraftTopicRow {
  tempId: string;
  id?: string;
  title: string;
  description: string;
  isNew: boolean;
  dirty: boolean;
}

function buildDraftRows(topics: TopicTableItem[]): DraftTopicRow[] {
  return [...topics]
    .sort((a, b) => a.displayOrder - b.displayOrder)
    .map((t) => ({
      tempId: t.id,
      id: t.id,
      title: t.title,
      description: t.description ?? "",
      isNew: false,
      dirty: false,
    }));
}

export function TopicsTable({
  courseId,
  topics,
  apiBase,
  readOnly = false,
  onRefresh,
}: {
  courseId: string;
  topics: TopicTableItem[];
  apiBase: "/api/admin" | "/api/university";
  readOnly?: boolean;
  onRefresh: () => void;
}) {
  const topicsSignature = useMemo(
    () =>
      [...topics]
        .sort((a, b) => a.displayOrder - b.displayOrder)
        .map((t) => `${t.id}:${t.title}:${t.description ?? ""}:${t.displayOrder}`)
        .join("|"),
    [topics]
  );

  const [prevSignature, setPrevSignature] = useState(topicsSignature);
  const [rows, setRows] = useState<DraftTopicRow[]>(() => buildDraftRows(topics));
  const [orderDirty, setOrderDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [reordering, setReordering] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<DraftTopicRow | null>(null);
  const [invalidTempIds, setInvalidTempIds] = useState<Set<string>>(new Set());
  const [limitWarning, setLimitWarning] = useState(false);
  const inputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  if (topicsSignature !== prevSignature) {
    setPrevSignature(topicsSignature);
    setRows(buildDraftRows(topics));
    setOrderDirty(false);
    setInvalidTempIds(new Set());
    setLimitWarning(false);
  }

  const hasUnsavedChanges = useMemo(
    () => orderDirty || rows.some((r) => r.isNew || r.dirty),
    [orderDirty, rows]
  );

  const atLimit = rows.length >= MAX_COURSE_TOPICS;

  function handleAddRow() {
    if (readOnly || saving) return;
    if (rows.length >= MAX_COURSE_TOPICS) {
      setLimitWarning(true);
      toast({
        title: "Topic limit reached",
        description: "Do not add more than 10 topics per course.",
        variant: "destructive",
      });
      return;
    }

    const tempId = `new_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    setRows((prev) => [
      ...prev,
      {
        tempId,
        title: "",
        description: "",
        isNew: true,
        dirty: true,
      },
    ]);
    setLimitWarning(false);

    requestAnimationFrame(() => {
      inputRefs.current[tempId]?.focus();
    });
  }

  function updateRow(tempId: string, field: "title" | "description", value: string) {
    if (readOnly) return;
    setRows((prev) =>
      prev.map((row) => {
        if (row.tempId !== tempId) return row;
        return {
          ...row,
          [field]: value,
          dirty: true,
        };
      })
    );
    if (field === "title" && value.trim()) {
      setInvalidTempIds((prev) => {
        if (!prev.has(tempId)) return prev;
        const next = new Set(prev);
        next.delete(tempId);
        return next;
      });
    }
  }

  async function moveRow(idx: number, dir: -1 | 1) {
    if (readOnly || saving || reordering) return;
    const targetIdx = idx + dir;
    if (targetIdx < 0 || targetIdx >= rows.length) return;

    const nextRows = [...rows];
    [nextRows[idx], nextRows[targetIdx]] = [nextRows[targetIdx], nextRows[idx]];
    setRows(nextRows);

    // If everything is already saved on the server, persist reorder immediately
    const allPersisted = nextRows.every((r) => !r.isNew && !r.dirty && r.id);
    if (allPersisted) {
      setReordering(true);
      try {
        await apiPost(`${apiBase}/courses/${courseId}/topics/reorder`, {
          orderedIds: nextRows.map((r) => r.id!),
        });
        onRefresh();
      } catch {
        setRows(rows);
      } finally {
        setReordering(false);
      }
    } else {
      setOrderDirty(true);
    }
  }

  function handleDeleteClick(row: DraftTopicRow) {
    if (readOnly || saving) return;
    if (row.isNew || !row.id) {
      setRows((prev) => prev.filter((r) => r.tempId !== row.tempId));
      setInvalidTempIds((prev) => {
        if (!prev.has(row.tempId)) return prev;
        const next = new Set(prev);
        next.delete(row.tempId);
        return next;
      });
      setLimitWarning(false);
      return;
    }
    setDeleteTarget(row);
  }

  async function confirmDeleteSaved() {
    if (!deleteTarget?.id) return;
    try {
      await apiPost(`${apiBase}/topics/${deleteTarget.id}`, null, { method: "DELETE" });
      toast({ title: "Topic deleted" });
      setDeleteTarget(null);
      onRefresh();
    } catch {
      /* toast handled by apiPost */
    }
  }

  function handleDiscard() {
    setRows(buildDraftRows(topics));
    setOrderDirty(false);
    setInvalidTempIds(new Set());
    setLimitWarning(false);
  }

  async function handleSaveAll() {
    if (readOnly || saving) return;
    if (rows.length > MAX_COURSE_TOPICS) {
      setLimitWarning(true);
      toast({
        title: "Too many topics",
        description: "Do not add more than 10 topics per course.",
        variant: "destructive",
      });
      return;
    }

    const missing = new Set<string>();
    rows.forEach((r) => {
      if (!r.title.trim()) {
        missing.add(r.tempId);
      }
    });
    if (missing.size > 0) {
      setInvalidTempIds(missing);
      toast({
        title: "Topic name required",
        description: "Please enter a topic name for every row before saving.",
        variant: "destructive",
      });
      return;
    }

    setSaving(true);
    try {
      const persistedIds: string[] = [];

      for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        if (row.isNew || !row.id) {
          const res = await apiPost<{ topic: { id: string } }>(
            `${apiBase}/courses/${courseId}/topics`,
            {
              title: row.title.trim(),
              description: row.description.trim() || null,
              displayOrder: i,
            }
          );
          persistedIds.push(res.topic.id);
        } else {
          if (row.dirty) {
            await apiPost(
              `${apiBase}/topics/${row.id}`,
              {
                title: row.title.trim(),
                description: row.description.trim() || null,
              },
              { method: "PUT" }
            );
          }
          persistedIds.push(row.id);
        }
      }

      if (persistedIds.length > 0 && (orderDirty || rows.some((r) => r.isNew))) {
        await apiPost(`${apiBase}/courses/${courseId}/topics/reorder`, {
          orderedIds: persistedIds,
        });
      }

      toast({ title: "Topics saved" });
      setOrderDirty(false);
      setInvalidTempIds(new Set());
      onRefresh();
    } catch {
      /* toast handled by apiPost */
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden">
      {/* Table Header */}
      <div className="hidden sm:grid sm:grid-cols-[36px_minmax(0,1fr)_minmax(0,1.4fr)_104px] items-center gap-3 px-4 py-3 border-b border-border bg-muted/20">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          #
        </span>
        <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          Topic Name
        </span>
        <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          Description
        </span>
        <span className="sr-only">Actions</span>
      </div>

      {/* Rows */}
      {rows.length === 0 ? (
        <div className="px-4 py-8 text-center text-sm text-muted-foreground">
          {readOnly
            ? "No topics have been added to this course yet."
            : "No topics added yet. Click \"ADD A TOPIC\" below to create your first topic."}
        </div>
      ) : (
        <div className="divide-y divide-border/70">
          {rows.map((row, idx) => {
            const isInvalid = invalidTempIds.has(row.tempId);
            return (
              <div
                key={row.tempId}
                className={cn(
                  "grid grid-cols-1 sm:grid-cols-[36px_minmax(0,1fr)_minmax(0,1.4fr)_104px] items-center gap-2.5 sm:gap-3 px-4 py-2.5 transition-colors hover:bg-muted/20",
                  row.isNew && "bg-accent/[0.03]"
                )}
              >
                {/* Row Number */}
                <div className="flex items-center justify-between sm:justify-start">
                  <span className="text-sm font-medium text-muted-foreground tabular-nums">
                    {idx + 1}
                  </span>
                  {!readOnly && (
                    <div className="flex items-center gap-1 sm:hidden">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-muted-foreground"
                        disabled={idx === 0 || saving || reordering}
                        onClick={() => moveRow(idx, -1)}
                        aria-label={`Move topic ${idx + 1} up`}
                      >
                        <ArrowUp className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-muted-foreground"
                        disabled={idx === rows.length - 1 || saving || reordering}
                        onClick={() => moveRow(idx, 1)}
                        aria-label={`Move topic ${idx + 1} down`}
                      >
                        <ArrowDown className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-muted-foreground hover:text-destructive"
                        disabled={saving}
                        onClick={() => handleDeleteClick(row)}
                        aria-label={`Delete topic ${idx + 1}`}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  )}
                </div>

                {/* Topic Name Input */}
                <div className="min-w-0">
                  <Input
                    ref={(el) => {
                      inputRefs.current[row.tempId] = el;
                    }}
                    value={row.title}
                    onChange={(e) => updateRow(row.tempId, "title", e.target.value)}
                    placeholder="Topic name"
                    readOnly={readOnly}
                    disabled={readOnly || saving}
                    aria-label={`Topic ${idx + 1} name`}
                    aria-invalid={isInvalid}
                    className={cn(
                      "h-9 rounded-lg border-border/80 bg-background text-sm",
                      isInvalid && "border-destructive ring-1 ring-destructive/30"
                    )}
                  />
                </div>

                {/* Description Input */}
                <div className="min-w-0">
                  <Input
                    value={row.description}
                    onChange={(e) => updateRow(row.tempId, "description", e.target.value)}
                    placeholder="Topic description (optional)"
                    readOnly={readOnly}
                    disabled={readOnly || saving}
                    aria-label={`Topic ${idx + 1} description`}
                    className="h-9 rounded-lg border-border/80 bg-background text-sm"
                  />
                </div>

                {/* Desktop Row Actions */}
                {!readOnly ? (
                  <div className="hidden sm:flex items-center justify-end gap-1">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-muted-foreground hover:text-foreground"
                      disabled={idx === 0 || saving || reordering}
                      onClick={() => moveRow(idx, -1)}
                      aria-label={`Move topic ${idx + 1} up`}
                    >
                      <ArrowUp className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-muted-foreground hover:text-foreground"
                      disabled={idx === rows.length - 1 || saving || reordering}
                      onClick={() => moveRow(idx, 1)}
                      aria-label={`Move topic ${idx + 1} down`}
                    >
                      <ArrowDown className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-muted-foreground hover:text-destructive"
                      disabled={saving}
                      onClick={() => handleDeleteClick(row)}
                      aria-label={`Delete topic ${idx + 1}`}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                ) : (
                  <div className="hidden sm:block" />
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Footer Message & Add / Save Controls */}
      {!readOnly && (
        <div className="border-t border-border/70 bg-muted/10 px-4 py-3 space-y-3">
          <div
            className={cn(
              "flex items-center justify-between gap-2 text-xs rounded-lg px-2.5 py-1.5",
              atLimit || limitWarning
                ? "bg-amber-50 text-amber-800 border border-amber-200 dark:bg-amber-950/30 dark:text-amber-300 dark:border-amber-800/60"
                : "text-muted-foreground"
            )}
          >
            <span className="flex items-center gap-1.5">
              <AlertCircle className="h-3.5 w-3.5 shrink-0" />
              {atLimit
                ? "Maximum limit of 10 topics reached. Please do not add more than 10 topics."
                : "Please do not add more than 10 topics per course."}
            </span>
            <span className="font-medium tabular-nums shrink-0">
              {rows.length} / {MAX_COURSE_TOPICS}
            </span>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleAddRow}
              disabled={saving || atLimit}
              className="h-8 px-2 text-xs font-semibold uppercase tracking-wider text-foreground hover:text-primary"
            >
              <Plus className="h-3.5 w-3.5" />
              Add a Topic
            </Button>

            {hasUnsavedChanges && (
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={saving}
                  onClick={handleDiscard}
                  className="h-8 gap-1.5 text-xs"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                  Discard
                </Button>
                <Button
                  type="button"
                  size="sm"
                  disabled={saving}
                  onClick={handleSaveAll}
                  className="h-8 gap-1.5 text-xs"
                >
                  <Save className="h-3.5 w-3.5" />
                  {saving ? "Saving..." : "Save Topics"}
                </Button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Delete Confirmation Dialog for Saved Topics */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(v) => !v && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete topic?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete <strong>{deleteTarget?.title || "this topic"}</strong> and all
              videos inside it.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-white hover:bg-destructive/90"
              onClick={confirmDeleteSaved}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
