"use client";
import { useI18n } from "@/lib/i18n/store";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Collapsible,
  CollapsibleTrigger,
  CollapsibleContent,
} from "@/components/ui/collapsible";
import { useApiFetch, apiPost } from "@/hooks/use-api";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import {
  StickyNote, ChevronDown, Plus, Clock, PlayCircle, Trash2, Pencil, X,
  Loader2,
} from "lucide-react";
import { formatDateTime } from "@/types";

interface NoteItem {
  id: string;
  courseId: string;
  topicId: string | null;
  videoId: string | null;
  videoTimestamp: number | null;
  content: string;
  createdAt: string;
  updatedAt: string;
  course: { id: string; title: string };
  topic: { id: string; title: string } | null;
  video: { id: string; title: string } | null;
}

interface NotesResponse {
  notes: NoteItem[];
}

/**
 * VideoNotesPanel — inline, collapsible notes editor shown directly below
 * the video player on the learning page. It captures the current video
 * timestamp (via `getCurrentTime`) when adding a note and seeks back to a
 * note's timestamp (via `seekTo`) when the user clicks its chip.
 *
 * The panel is intentionally kept compact (collapsed by default after the
 * first note is added) so it doesn't crowd the player. It is also disabled
 * for YouTube videos, where the parent cannot report a precise current
 * timestamp — the UI shows a hint in that case.
 */
export function VideoNotesPanel({
  courseId,
  topicId,
  videoId,
  videoTitle,
  getCurrentTime,
  seekTo,
  canCaptureTimestamp,
}: {
  courseId: string;
  topicId: string | null;
  videoId: string;
  videoTitle?: string;
  /** Returns the current playback position in seconds, or 0 if unknown. */
  getCurrentTime?: () => number;
  /** Seeks the active video element to the given position in seconds. */
  seekTo?: (seconds: number) => void;
  /** False for YouTube videos (no way to read currentTime). */
  canCaptureTimestamp?: boolean;
}) {
  const { t } = useI18n();
  const { data, loading, refetch, setData } = useApiFetch<NotesResponse>(
    `/api/student/notes?courseId=${encodeURIComponent(courseId)}`
  );

  // Only the notes attached to THIS video are shown in the inline panel.
  const videoNotes = (data?.notes ?? []).filter((n) => n.videoId === videoId);

  const [open, setOpen] = useState(true);
  const [draft, setDraft] = useState("");
  const [capturedTs, setCapturedTs] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState("");

  function captureTimestamp() {
    const t = getCurrentTime?.() ?? 0;
    setCapturedTs(Math.max(0, Math.floor(t)));
  }

  async function handleAdd() {
    if (!draft.trim()) {
      toast({
        title: "Note is empty",
        description: "Write something before saving.",
        variant: "destructive",
      });
      return;
    }
    setSaving(true);
    try {
      const ts = capturedTs ?? (canCaptureTimestamp ? Math.max(0, Math.floor(getCurrentTime?.() ?? 0)) : null);
      const res = await apiPost<{ note: NoteItem }>("/api/student/notes", {
        courseId,
        topicId,
        videoId,
        videoTimestamp: ts,
        content: draft.trim(),
      });
      // Prepend to the local cache (notes are ordered by updatedAt desc).
      if (data) {
        setData({ notes: [res.note, ...data.notes.filter((n) => n.id !== res.note.id)] });
      } else {
        setData({ notes: [res.note] });
      }
      setDraft("");
      setCapturedTs(null);
      setOpen(true); // make sure the list is visible after adding
      toast({ title: "Note saved" });
    } catch {
    } finally {
      setSaving(false);
    }
  }

  async function handleSaveEdit(id: string) {
    if (!editContent.trim()) {
      toast({
        title: "Note can't be empty",
        variant: "destructive",
      });
      return;
    }
    try {
      const res = await apiPost<{ note: NoteItem }>(
        `/api/student/notes/${id}`,
        { content: editContent },
        { method: "PUT" }
      );
      if (data) {
        setData({
          notes: data.notes.map((n) => (n.id === res.note.id ? res.note : n)),
        });
      }
      setEditingId(null);
      setEditContent("");
      toast({ title: "Note updated" });
    } catch {
    }
  }

  async function handleDelete(id: string) {
    try {
      await apiPost(`/api/student/notes/${id}`, null, { method: "DELETE" });
      if (data) {
        setData({ notes: data.notes.filter((n) => n.id !== id) });
      }
      toast({ title: "Note deleted" });
    } catch {
    }
  }

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <Card className="shadow-sm border-border">
        <CollapsibleTrigger asChild>
          <CardHeader className="cursor-pointer hover:bg-soft-sage/40 transition-colors border-b border-border/60">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5 min-w-0">
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent/10 text-accent shrink-0">
                  <StickyNote className="h-4 w-4" />
                </span>
                <div className="min-w-0">
                  <CardTitle className="text-base flex items-center gap-2">
                    My notes for this lesson
                  </CardTitle>
                  <CardDescription className="mt-0.5 truncate">
                    {videoNotes.length === 0
                      ? "Capture key points as you watch"
                      : `${videoNotes.length} note${videoNotes.length > 1 ? "s" : ""}`}
                  </CardDescription>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {videoNotes.length > 0 && (
                  <Badge variant="outline" className="border-accent/30 text-accent">
                    {videoNotes.length}
                  </Badge>
                )}
                <ChevronDown className="h-4 w-4 text-muted-foreground [[data-state=open]_&]:rotate-180 transition-transform" />
              </div>
            </div>
          </CardHeader>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <CardContent className="p-4 space-y-4">
            {/* ─── Compose row ─── */}
            <div className="rounded-lg border border-border bg-muted/20 p-3 space-y-2">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={captureTimestamp}
                    disabled={!canCaptureTimestamp}
                    className="gap-1.5"
                    title={
                      canCaptureTimestamp
                        ? "Stamp the current playback position"
                        : "Timestamp capture isn't available for YouTube videos"
                    }
                  >
                    <Clock className="h-3.5 w-3.5" />
                    {capturedTs !== null
                      ? `@ ${formatTimestamp(capturedTs)}`
                      : "Add at current time"}
                  </Button>
                  {capturedTs !== null && (
                    <button
                      type="button"
                      onClick={() => setCapturedTs(null)}
                      className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-0.5"
                    >
                      <X className="h-3 w-3" /> clear
                    </button>
                  )}
                </div>
                <Button
                  type="button"
                  size="sm"
                  onClick={handleAdd}
                  disabled={saving || !draft.trim()}
                  className="gap-1.5"
                >
                  {saving ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Plus className="h-3.5 w-3.5" />
                  )}
                  Save note
                </Button>
              </div>
              <Textarea
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                placeholder={`Write a note about “${truncate(videoTitle || "this lesson", 40)}”…`}
                rows={2}
                className="resize-y bg-card"
              />
              {!canCaptureTimestamp && (
                <p className="text-[11px] text-muted-foreground flex items-start gap-1.5">
                  <Clock className="h-3 w-3 mt-0.5 shrink-0" />
                  YouTube videos can&apos;t report their playback position to us,
                  so timestamps can&apos;t be captured automatically. You can
                  still write notes without one.
                </p>
              )}
            </div>

            {/* ─── Existing notes ─── */}
            {loading ? (
              <div className="flex items-center justify-center py-6 text-sm text-muted-foreground gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading notes…
              </div>
            ) : videoNotes.length === 0 ? (
              <div className="text-center py-6 text-sm text-muted-foreground">
                No notes for this lesson yet.
              </div>
            ) : (
              <ul className="space-y-2">
                {videoNotes.map((n) => (
                  <li
                    key={n.id}
                    className="group rounded-lg border border-border bg-card p-3 hover:border-accent/30 transition-colors"
                  >
                    {editingId === n.id ? (
                      <div className="space-y-2">
                        <Textarea
                          value={editContent}
                          onChange={(e) => setEditContent(e.target.value)}
                          rows={3}
                          autoFocus
                          className="resize-y"
                        />
                        <div className="flex items-center gap-2 justify-end">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setEditingId(null);
                              setEditContent("");
                            }}
                          >
                            Cancel
                          </Button>
                          <Button
                            size="sm"
                            onClick={() => handleSaveEdit(n.id)}
                            className="gap-1.5"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                            Save
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <div className="flex items-start justify-between gap-2 mb-1.5">
                          {n.videoTimestamp !== null ? (
                            <button
                              onClick={() => seekTo?.(n.videoTimestamp!)}
                              className="inline-flex items-center gap-1 rounded-md border border-accent/30 bg-accent/5 px-2 py-0.5 text-[11px] font-medium text-accent hover:bg-accent/10 transition-colors"
                              title="Jump to this moment in the video"
                            >
                              <PlayCircle className="h-3 w-3" />
                              {formatTimestamp(n.videoTimestamp)}
                            </button>
                          ) : (
                            <span className="text-[11px] text-muted-foreground">
                              No timestamp
                            </span>
                          )}
                          <div className="flex items-center gap-0.5 opacity-60 group-hover:opacity-100 transition-opacity">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6 text-muted-foreground hover:text-accent"
                              onClick={() => {
                                setEditingId(n.id);
                                setEditContent(n.content);
                              }}
                              aria-label="Edit note"
                            >
                              <Pencil className="h-3 w-3" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6 text-muted-foreground hover:text-destructive"
                              onClick={() => handleDelete(n.id)}
                              aria-label="Delete note"
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </div>
                        </div>
                        <p className="text-sm text-foreground whitespace-pre-wrap leading-relaxed">
                          {n.content}
                        </p>
                        <p className="mt-1.5 text-[11px] text-muted-foreground">
                          {formatDateTime(n.updatedAt)}
                        </p>
                      </>
                    )}
                  </li>
                ))}
              </ul>
            )}

            {/* Hidden refetch hook — render this so the parent can trigger
                a refresh by changing videoId (the URL changes when videoId
                changes, which re-runs the useApiFetch effect automatically). */}
            <button
              type="button"
              onClick={() => refetch()}
              className="sr-only"
              aria-hidden
              tabIndex={-1}
            >
              Refresh notes
            </button>
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
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

function truncate(s: string, max: number): string {
  return s.length > max ? s.slice(0, max - 1) + "…" : s;
}

// Suppress the unused-import lint — cn is reserved for future use in
// additional styling tweaks.
export const _unused = { cn };
