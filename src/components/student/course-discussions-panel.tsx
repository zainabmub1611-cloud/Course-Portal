"use client";
import { useI18n } from "@/lib/i18n/store";

import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Collapsible,
  CollapsibleTrigger,
  CollapsibleContent,
} from "@/components/ui/collapsible";
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
import { useApiFetch, apiPost } from "@/hooks/use-api";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import {
  MessageSquare, Pin, Lock, Reply, ChevronDown, ChevronRight,
  Plus, Send, Pencil, Trash2, Loader2,
} from "lucide-react";
import { formatDateTime } from "@/types";

interface DiscussionItem {
  id: string;
  courseId: string;
  authorId: string;
  title: string;
  content: string;
  isPinned: boolean;
  isLocked: boolean;
  createdAt: string;
  updatedAt: string;
  author: { id: string; name: string; profilePhoto: string | null };
  course: { id: string; title: string } | null;
  replyCount: number;
}

interface ReplyItem {
  id: string;
  discussionId: string;
  authorId: string;
  content: string;
  isInstructor: boolean;
  createdAt: string;
  updatedAt: string;
  author: { id: string; name: string; profilePhoto: string | null };
}

interface DiscussionsResponse {
  discussions: DiscussionItem[];
}

interface RepliesResponse {
  replies: ReplyItem[];
  isLocked: boolean;
}

/**
 * CourseDiscussionsPanel — embedded inside the learning page for a single
 * course. Lists all discussion threads for the course, lets the student
 * create a new thread (title + content), expand a thread to read its
 * replies, and post their own reply. Edit and delete controls are exposed
 * on the student's OWN posts only.
 *
 * Optional `highlightDiscussionId` is used by the parent learning page
 * when the student navigates from the global Discussions view via a
 * `?discussion=<id>` query — the matching thread auto-expands and
 * scrolls into view.
 */
export function CourseDiscussionsPanel({
  courseId,
  highlightDiscussionId,
}: {
  courseId: string;
  highlightDiscussionId?: string | null;
}) {
  const { t } = useI18n();
  const { data, loading, error, refetch, setData } = useApiFetch<DiscussionsResponse>(
    `/api/student/discussions?courseId=${encodeURIComponent(courseId)}`
  );

  const [newDialogOpen, setNewDialogOpen] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newContent, setNewContent] = useState("");
  const [creating, setCreating] = useState(false);

  // Auto-open a thread when navigated from the global Discussions list.
  // The effect runs once when the data first arrives with a matching id.
  const didAutoOpenRef = useRef<string | null>(null);
  useEffect(() => {
    if (!highlightDiscussionId) return;
    if (didAutoOpenRef.current === highlightDiscussionId) return;
    const exists = (data?.discussions ?? []).some(
      (d) => d.id === highlightDiscussionId
    );
    if (exists) {
      didAutoOpenRef.current = highlightDiscussionId;
      // Slight delay to let the layout settle before scrolling.
      const t = setTimeout(() => {
        const el = document.getElementById(`discussion-${highlightDiscussionId}`);
        if (el) {
          el.scrollIntoView({ behavior: "smooth", block: "start" });
        }
      }, 120);
      return () => clearTimeout(t);
    }
  }, [highlightDiscussionId, data?.discussions]);

  async function handleCreate() {
    if (!newTitle.trim() || !newContent.trim()) {
      toast({
        title: "Both fields are required",
        description: "Add a title and some content for your post.",
        variant: "destructive",
      });
      return;
    }
    setCreating(true);
    try {
      const res = await apiPost<{ discussion: DiscussionItem }>(
        "/api/student/discussions",
        {
          courseId,
          title: newTitle.trim(),
          content: newContent.trim(),
        }
      );
      if (data) {
        setData({ discussions: [res.discussion, ...data.discussions] });
      } else {
        setData({ discussions: [res.discussion] });
      }
      setNewTitle("");
      setNewContent("");
      setNewDialogOpen(false);
      toast({ title: "Discussion posted" });
    } catch {
    } finally {
      setCreating(false);
    }
  }

  if (loading) {
    return (
      <Card className="shadow-sm">
        <CardHeader>
          <Skeleton className="h-6 w-48 rounded-md" />
          <Skeleton className="h-4 w-72 rounded-md" />
        </CardHeader>
        <CardContent className="space-y-3">
          {[1, 2].map((i) => (
            <Skeleton key={i} className="h-20 rounded-lg" />
          ))}
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MessageSquare className="h-4 w-4 text-accent" />
            Discussions
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="rounded-lg border border-destructive/20 bg-destructive/5 p-4 text-sm text-destructive flex items-center justify-between">
            <span>{error}</span>
            <Button variant="outline" size="sm" onClick={() => refetch()}>
              Retry
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  const discussions = data?.discussions ?? [];

  return (
    <Card className="shadow-sm border-border">
      <CardHeader className="border-b border-border/60 bg-gradient-to-br from-soft-sage/40 to-card">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <CardTitle className="text-base flex items-center gap-2">
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-accent/10 text-accent">
                <MessageSquare className="h-4 w-4" />
              </span>
              Course Discussions
            </CardTitle>
            <CardDescription className="mt-1">
              {discussions.length === 0
                ? "Ask a question or share an insight"
                : `${discussions.length} thread${discussions.length > 1 ? "s" : ""}`}
            </CardDescription>
          </div>
          <Button
            size="sm"
            onClick={() => setNewDialogOpen(true)}
            className="gap-1.5"
          >
            <Plus className="h-4 w-4" />
            New Post
          </Button>
        </div>
      </CardHeader>

      <CardContent className="p-4">
        {discussions.length === 0 ? (
          <div className="text-center py-10">
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-accent/10 text-accent">
              <MessageSquare className="h-5 w-5" />
            </div>
            <p className="font-heading text-base font-semibold text-foreground">
              Start the conversation
            </p>
            <p className="text-sm text-muted-foreground mt-1 max-w-sm mx-auto">
              There are no discussions in this course yet. Be the first to post
              a question or share an insight.
            </p>
            <Button
              className="mt-4 gap-1.5"
              onClick={() => setNewDialogOpen(true)}
            >
              <Plus className="h-4 w-4" />
              Create the first post
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            {discussions.map((d) => (
              <DiscussionThread
                key={d.id}
                discussion={d}
                defaultOpen={highlightDiscussionId === d.id}
                onReplyPosted={(updated) => {
                  if (data) {
                    setData({
                      discussions: data.discussions.map((x) =>
                        x.id === updated.id ? updated : x
                      ),
                    });
                  }
                }}
                onDeleted={(id) => {
                  if (data) {
                    setData({
                      discussions: data.discussions.filter((x) => x.id !== id),
                    });
                  }
                }}
                onUpdated={(updated) => {
                  if (data) {
                    setData({
                      discussions: data.discussions.map((x) =>
                        x.id === updated.id ? updated : x
                      ),
                    });
                  }
                }}
              />
            ))}
          </div>
        )}
      </CardContent>

      {/* New post dialog */}
      <Dialog open={newDialogOpen} onOpenChange={setNewDialogOpen}>
        <DialogContent className="animate-scale-in">
          <DialogHeader>
            <DialogTitle>Start a new discussion</DialogTitle>
            <DialogDescription>
              Ask a question or share an insight. Other students in this course
              will be able to reply.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1 block">
                Title
              </label>
              <Input
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                placeholder="A short, descriptive title"
                autoFocus
              />
            </div>
            <div>
              <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1 block">
                Content
              </label>
              <Textarea
                value={newContent}
                onChange={(e) => setNewContent(e.target.value)}
                placeholder="Describe your question or thought in detail…"
                rows={5}
                className="resize-y"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setNewDialogOpen(false)}
              disabled={creating}
            >
              Cancel
            </Button>
            <Button onClick={handleCreate} disabled={creating} className="gap-1.5">
              {creating ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
              Post discussion
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

/* ──────────────────────────────────────────────────────────────────────── */

function DiscussionThread({
  discussion,
  defaultOpen,
  onReplyPosted,
  onDeleted,
  onUpdated,
}: {
  discussion: DiscussionItem;
  defaultOpen: boolean;
  onReplyPosted: (updated: DiscussionItem) => void;
  onDeleted: (id: string) => void;
  onUpdated: (updated: DiscussionItem) => void;
}) {
  const { t } = useI18n();
  const [open, setOpen] = useState(defaultOpen);
  const [replyDraft, setReplyDraft] = useState("");
  const [postingReply, setPostingReply] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editTitle, setEditTitle] = useState("");
  const [editContent, setEditContent] = useState("");
  const [savingEdit, setSavingEdit] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  // Lazily fetch replies only when the thread is first expanded.
  const {
    data: repliesData,
    loading: repliesLoading,
    error: repliesError,
    refetch: refetchReplies,
    setData: setRepliesData,
  } = useApiFetch<RepliesResponse>(
    open ? `/api/student/discussions/${discussion.id}/replies` : null
  );

  const initials = useMemo(
    () =>
      discussion.author.name
        .split(" ")
        .map((s) => s[0])
        .slice(0, 2)
        .join("")
        .toUpperCase(),
    [discussion.author.name]
  );

  async function handlePostReply() {
    if (!replyDraft.trim()) {
      toast({
        title: "Reply is empty",
        variant: "destructive",
      });
      return;
    }
    setPostingReply(true);
    try {
      const res = await apiPost<{ reply: ReplyItem }>(
        `/api/student/discussions/${discussion.id}/replies`,
        { content: replyDraft.trim() }
      );
      if (repliesData) {
        setRepliesData({
          replies: [...repliesData.replies, res.reply],
          isLocked: repliesData.isLocked,
        });
      } else {
        setRepliesData({ replies: [res.reply], isLocked: false });
      }
      // Optimistically bump the reply count + updatedAt in the parent list.
      onReplyPosted({
        ...discussion,
        replyCount: discussion.replyCount + 1,
        updatedAt: new Date().toISOString(),
      });
      setReplyDraft("");
      toast({ title: "Reply posted" });
    } catch {
    } finally {
      setPostingReply(false);
    }
  }

  function startEdit() {
    setEditTitle(discussion.title);
    setEditContent(discussion.content);
    setEditing(true);
  }

  async function saveEdit() {
    if (!editTitle.trim() || !editContent.trim()) {
      toast({
        title: "Both fields are required",
        variant: "destructive",
      });
      return;
    }
    setSavingEdit(true);
    try {
      const res = await apiPost<{ discussion: DiscussionItem }>(
        `/api/student/discussions/${discussion.id}`,
        { title: editTitle, content: editContent },
        { method: "PUT" }
      );
      onUpdated(res.discussion);
      setEditing(false);
      toast({ title: "Discussion updated" });
    } catch {
    } finally {
      setSavingEdit(false);
    }
  }

  async function doDelete() {
    try {
      await apiPost(`/api/student/discussions/${discussion.id}`, null, {
        method: "DELETE",
      });
      onDeleted(discussion.id);
      toast({ title: "Discussion deleted" });
    } catch {
    } finally {
      setConfirmDelete(false);
    }
  }

  return (
    <div
      id={`discussion-${discussion.id}`}
      className={cn(
        "rounded-lg border bg-card transition-colors scroll-mt-24",
        defaultOpen
          ? "border-accent/40 ring-1 ring-accent/10"
          : "border-border hover:border-accent/30"
      )}
    >
      {/* Header — clickable to expand */}
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full text-left px-4 py-3"
        aria-expanded={open}
      >
        <div className="flex items-start gap-3">
          <Avatar className="h-9 w-9 ring-2 ring-accent/15 ring-offset-2 ring-offset-background shrink-0">
            {discussion.author.profilePhoto ? (
              <AvatarImage
                src={discussion.author.profilePhoto}
                alt={discussion.author.name}
              />
            ) : null}
            <AvatarFallback className="bg-gradient-to-br from-primary to-accent text-[11px] font-semibold text-primary-foreground">
              {initials}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1">
            <div className="flex items-start gap-2">
              <h3 className="text-sm font-semibold text-foreground line-clamp-1 flex-1 min-w-0">
                {discussion.title}
              </h3>
              <div className="flex items-center gap-1 shrink-0">
                {discussion.isPinned && (
                  <Badge className="bg-accent/15 text-accent border-transparent px-1.5 py-0 h-5 gap-0.5">
                    <Pin className="h-3 w-3" /> Pinned
                  </Badge>
                )}
                {discussion.isLocked && (
                  <Badge className="bg-muted text-muted-foreground border-transparent px-1.5 py-0 h-5 gap-0.5">
                    <Lock className="h-3 w-3" /> Locked
                  </Badge>
                )}
              </div>
            </div>
            <div className="mt-0.5 flex items-center gap-2 text-[11px] text-muted-foreground">
              <span className="font-medium text-foreground/80">
                {discussion.author.name}
              </span>
              <span>·</span>
              <span>{formatDateTime(discussion.createdAt)}</span>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Badge variant="outline" className="border-border text-muted-foreground gap-1">
              <Reply className="h-3 w-3" />
              {discussion.replyCount}
            </Badge>
            <ChevronDown className="h-4 w-4 text-muted-foreground [[data-state=open]_&]:rotate-180 transition-transform" />
          </div>
        </div>
      </button>

      {/* Body — only when expanded */}
      {open && (
        <div className="px-4 pb-4 space-y-3 border-t border-border/60 pt-3">
          {editing ? (
            <div className="space-y-2 rounded-lg border border-accent/30 bg-soft-sage/30 p-3">
              <Input
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                placeholder="Title"
              />
              <Textarea
                value={editContent}
                onChange={(e) => setEditContent(e.target.value)}
                rows={4}
                className="resize-y"
              />
              <div className="flex items-center justify-end gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setEditing(false)}
                  disabled={savingEdit}
                >
                  Cancel
                </Button>
                <Button size="sm" onClick={saveEdit} disabled={savingEdit} className="gap-1.5">
                  {savingEdit ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Pencil className="h-3.5 w-3.5" />
                  )}
                  Save
                </Button>
              </div>
            </div>
          ) : (
            <p className="text-sm text-foreground whitespace-pre-wrap leading-relaxed">
              {discussion.content}
            </p>
          )}

          {/* Owner-only edit / delete row */}
          {!editing && (
            <div className="flex items-center justify-end gap-1">
              <Button
                variant="ghost"
                size="sm"
                onClick={startEdit}
                className="h-7 gap-1 text-muted-foreground hover:text-accent"
              >
                <Pencil className="h-3.5 w-3.5" /> Edit
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setConfirmDelete(true)}
                className="h-7 gap-1 text-muted-foreground hover:text-destructive"
              >
                <Trash2 className="h-3.5 w-3.5" /> Delete
              </Button>
            </div>
          )}

          {/* Replies list */}
          <div className="space-y-2 pl-3 border-l-2 border-border/60">
            {repliesLoading ? (
              <div className="flex items-center gap-2 text-xs text-muted-foreground py-3">
                <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading replies…
              </div>
            ) : repliesError ? (
              <div className="text-xs text-destructive py-2 flex items-center justify-between gap-2">
                <span>{repliesError}</span>
                <Button variant="outline" size="sm" onClick={() => refetchReplies()}>
                  Retry
                </Button>
              </div>
            ) : (repliesData?.replies ?? []).length === 0 ? (
              <p className="text-xs text-muted-foreground py-2 italic">
                No replies yet — be the first to respond.
              </p>
            ) : (
              (repliesData?.replies ?? []).map((r) => (
                <ReplyRow key={r.id} reply={r} />
              ))
            )}
          </div>

          {/* Reply composer */}
          {discussion.isLocked ? (
            <div className="rounded-md border border-muted bg-muted/30 p-3 text-xs text-muted-foreground flex items-center gap-2">
              <Lock className="h-3.5 w-3.5" />
              This discussion is locked — new replies cannot be added.
            </div>
          ) : (
            <div className="flex items-end gap-2 pt-1">
              <Textarea
                value={replyDraft}
                onChange={(e) => setReplyDraft(e.target.value)}
                placeholder="Write a reply…"
                rows={2}
                className="resize-y text-sm min-h-[44px]"
              />
              <Button
                size="sm"
                onClick={handlePostReply}
                disabled={postingReply || !replyDraft.trim()}
                className="gap-1.5 shrink-0"
              >
                {postingReply ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
                <span className="hidden sm:inline">Reply</span>
              </Button>
            </div>
          )}
        </div>
      )}

      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this discussion?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the post and all of its replies. This
              action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={doDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────────────── */

function ReplyRow({ reply }: { reply: ReplyItem }) {
  const { t } = useI18n();
  const initials = reply.author.name
    .split(" ")
    .map((s) => s[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <div className="rounded-md border border-border/80 bg-card p-2.5">
      <div className="flex items-start gap-2">
        <Avatar className="h-6 w-6 shrink-0 ring-1 ring-accent/15">
          {reply.author.profilePhoto ? (
            <AvatarImage
              src={reply.author.profilePhoto}
              alt={reply.author.name}
            />
          ) : null}
          <AvatarFallback className="bg-gradient-to-br from-primary to-accent text-[9px] font-semibold text-primary-foreground">
            {initials}
          </AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 mb-0.5 flex-wrap">
            <span className="text-xs font-semibold text-foreground">
              {reply.author.name}
            </span>
            {reply.isInstructor && (
              <Badge className="bg-primary/10 text-primary border-transparent px-1.5 py-0 h-4 text-[10px]">
                Instructor
              </Badge>
            )}
            <span className="text-[11px] text-muted-foreground">
              · {formatDateTime(reply.createdAt)}
            </span>
          </div>
          <p className="text-sm text-foreground whitespace-pre-wrap leading-relaxed">
            {reply.content}
          </p>
        </div>
      </div>
    </div>
  );
}

// Unused export kept for tree-shaking clarity
export const _icons = { ChevronRight };
