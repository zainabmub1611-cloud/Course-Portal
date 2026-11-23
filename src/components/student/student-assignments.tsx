"use client";

import { useRef, useState } from "react";
import { useAppStore } from "@/stores/app-store";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/shared/empty-state";
import {
  Collapsible, CollapsibleTrigger, CollapsibleContent,
} from "@/components/ui/collapsible";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { useApiFetch, apiUpload, markApiCacheUrlStale, authFetch } from "@/hooks/use-api";
import { toast } from "@/hooks/use-toast";
import {
  ClipboardList, Lock, Download, Upload, ChevronDown, CheckCircle2,
  Clock, AlertTriangle, Award, FileText, BookOpen, Eye, ExternalLink, XCircle,
} from "lucide-react";
import { formatDateTime, formatDate } from "@/types";
import { useI18n } from "@/lib/i18n/store";

interface AssignmentItem {
  id: string;
  courseId: string;
  courseTitle: string;
  title: string;
  description: string | null;
  instructions: string | null;
  fileUrl: string | null;
  dueDate: string | null;
  isPublished: boolean;
  allowResubmission: boolean;
  submission: {
    id: string;
    fileUrl: string;
    submittedAt: string;
    status: "SUBMITTED" | "PASSED" | "FAILED" | "REVIEWED";
    reviewNotes: string | null;
    reviewedAt: string | null;
  } | null;
  certificate?: {
    id: string;
    certificateNumber: string;
    issuedAt: string;
  } | null;
  unlocked: boolean;
  lockedReason: string | null;
  courseCompletion: {
    percent: number;
    completedVideos: number;
    totalVideos: number;
    allCompleted: boolean;
  };
}

interface AssignmentsData {
  assignments: AssignmentItem[];
  subscription: {
    status: "ACTIVE" | "EXPIRED";
    planName: string;
  } | null;
}

export function StudentAssignments() {
  const { t } = useI18n();
  const navigate = useAppStore((s) => s.navigate);
  const { data, loading, error, refetch } = useApiFetch<AssignmentsData>(
    "/api/student/assignments",
    { freshOnMount: true, revalidateOnFocus: true }
  );

  if (loading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-40 rounded-xl" />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <EmptyState
        icon={<ClipboardList className="h-5 w-5" />}
        title={t("assignments.couldntLoad")}
        description={error}
        action={<Button onClick={() => window.location.reload()}>{t("common.reload")}</Button>}
      />
    );
  }

  const assignments = data?.assignments || [];
  const isExpired = data?.subscription?.status === "EXPIRED";

  if (assignments.length === 0) {
    return (
      <EmptyState
        icon={<ClipboardList className="h-5 w-5" />}
        title={t("assignments.noAssignmentsYet")}
        description={t("assignments.appearHere")}
        action={<Button onClick={() => navigate(["student", "courses"])} className="gap-2 shadow-sm">
          {t("student.browseCoursesShort")} <BookOpen className="h-4 w-4" />
        </Button>}
      />
    );
  }

  return (
    <div className="space-y-4">
      {isExpired && (
        <Card className="border-destructive/30 bg-destructive/5 shadow-sm">
          <CardContent className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div className="flex items-start gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-destructive/10 text-destructive shrink-0">
                <AlertTriangle className="h-5 w-5" />
              </div>
              <div>
                <p className="font-semibold text-foreground">{t("assignments.subscriptionExpiredShort")}</p>
                <p className="text-sm text-muted-foreground mt-0.5">
                  {t("assignments.allLocked")}
                </p>
              </div>
            </div>
            <Button onClick={() => navigate(["student", "subscription"])} className="shrink-0 shadow-sm">
              {t("assignments.renewSubscriptionShort")}
            </Button>
          </CardContent>
        </Card>
      )}

      {assignments.map((a) => (
        <AssignmentCard key={a.id} assignment={a} onSubmitted={refetch} />
      ))}
    </div>
  );
}

function AssignmentCard({
  assignment,
  onSubmitted,
}: {
  assignment: AssignmentItem;
  onSubmitted: () => void;
}) {
  const { t } = useI18n();
  const navigate = useAppStore((s) => s.navigate);
  const [open, setOpen] = useState(false);
  const [viewOpen, setViewOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isPassed = assignment.submission?.status === "PASSED" || assignment.submission?.status === "REVIEWED";
  const isFailed = assignment.submission?.status === "FAILED";
  const canUpload = assignment.unlocked && (!assignment.submission || (!isPassed && (isFailed || assignment.allowResubmission)));

  const [downloading, setDownloading] = useState(false);

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
        `${assignment.title.replace(/[^a-z0-9-_]+/gi, "_")}${fallbackExt}`;

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

  const statusBadge = (() => {
    if (assignment.submission) {
      if (isPassed) {
        return <Badge className="bg-success/15 text-success border-transparent gap-1"><CheckCircle2 className="h-3 w-3" /> Passed</Badge>;
      }
      if (isFailed) {
        return <Badge className="bg-destructive/15 text-destructive border-transparent gap-1"><XCircle className="h-3 w-3" /> Needs Revision</Badge>;
      }
      return <Badge className="bg-warning/15 text-warning border-transparent gap-1"><Clock className="h-3 w-3" /> Pending Review</Badge>;
    }
    if (assignment.unlocked) {
      return <Badge className="bg-primary text-primary-foreground">{t("assignments.available")}</Badge>;
    }
    return <Badge variant="outline" className="text-muted-foreground bg-muted"><Lock className="h-3 w-3" /> {t("assignments.locked")}</Badge>;
  })();

  async function handleSubmit() {
    if (!selectedFile) {
      toast({ title: t("assignments.selectAFile"), description: t("assignments.selectAFileDesc"), variant: "destructive" });
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
      if (fileInputRef.current) fileInputRef.current.value = "";
      markApiCacheUrlStale("/api/student/certificates");
      markApiCacheUrlStale("/api/student/overview");
      onSubmitted();
      toast({
        title: "Assignment uploaded",
        description: "Your certificate will be issued once your teacher or instructor marks it as Pass.",
      });
    } catch {
    } finally {
      setUploading(false);
    }
  }

  return (
    <>
      <Card className="shadow-sm transition-all duration-200 hover:shadow-md">
        <CardHeader className="space-y-2">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1.5">
                <BookOpen className="h-3 w-3 text-accent" />
                <button
                  onClick={() => navigate(["student", "learn", assignment.courseId])}
                  className="hover:text-accent hover:underline font-medium"
                >
                  {assignment.courseTitle}
                </button>
              </div>
              <CardTitle className="text-base flex items-center gap-2">
                <ClipboardList className="h-4 w-4 text-accent" />
                {assignment.title}
              </CardTitle>
              {assignment.description && (
                <CardDescription className="mt-1.5 line-clamp-2">
                  {assignment.description}
                </CardDescription>
              )}
            </div>
            <div className="flex flex-col items-end gap-2 shrink-0">
              {statusBadge}
              {assignment.dueDate && (
                <span className="text-xs text-muted-foreground flex items-center gap-1.5">
                  <Clock className="h-3 w-3 text-accent" /> {t("assignments.due")} {formatDate(assignment.dueDate)}
                </span>
              )}
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-3">
          {/* Locked progress bar */}
          {!assignment.unlocked && (
            <div className="rounded-lg border border-border bg-muted/40 p-3.5 space-y-3">
              <div className="flex items-center gap-2">
                <Lock className="h-4 w-4 text-muted-foreground" />
                <p className="text-sm font-medium text-foreground">
                  {assignment.lockedReason || t("assignments.completeCourseFirst")}
                </p>
              </div>
              <div>
                <div className="flex justify-between text-xs text-muted-foreground mb-1.5">
                  <span>{t("assignments.lessonsCompletedCount").replace("{completed}", String(assignment.courseCompletion.completedVideos)).replace("{total}", String(assignment.courseCompletion.totalVideos))}</span>
                  <span className="font-semibold text-foreground">{assignment.courseCompletion.percent}%</span>
                </div>
                <Progress value={assignment.courseCompletion.percent} className="h-1.5 bg-muted [&_[data-slot=progress-indicator]]:bg-accent" />
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={() => navigate(["student", "learn", assignment.courseId])}
                className="gap-2 shadow-sm"
              >
                <BookOpen className="h-4 w-4" /> {t("assignments.continueCourse")}
              </Button>
            </div>
          )}

          {/* View & Download actions once unlocked */}
          {assignment.unlocked && (
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

          {/* Submission view */}
          {assignment.submission && (
            <div
              className={`rounded-lg border p-3.5 space-y-2.5 ${
                isPassed
                  ? "border-success/30 bg-success/5"
                  : isFailed
                    ? "border-destructive/30 bg-destructive/5"
                    : "border-warning/30 bg-warning/5"
              }`}
            >
              <div className="flex items-center gap-2">
                {isPassed ? (
                  <CheckCircle2 className="h-4 w-4 text-success" />
                ) : isFailed ? (
                  <XCircle className="h-4 w-4 text-destructive" />
                ) : (
                  <Clock className="h-4 w-4 text-warning" />
                )}
                <p className="text-sm font-medium text-foreground">
                  {t("assignments.submittedOn")} {formatDateTime(assignment.submission.submittedAt)}
                </p>
              </div>
              {!isPassed && !isFailed && (
                <p className="text-xs text-muted-foreground">
                  Waiting for your teacher or instructor to review and mark it Pass. Your certificate will be issued automatically once passed.
                </p>
              )}
              <a
                href={assignment.submission.fileUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 text-sm text-accent hover:underline"
              >
                <Download className="h-3.5 w-3.5" /> {t("assignments.viewYourSubmission")}
              </a>
              {assignment.submission.reviewNotes && (
                <div className="rounded-lg border border-border bg-card p-3 mt-2">
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">{t("assignments.reviewerNotes")}</p>
                  <p className="text-sm text-foreground whitespace-pre-wrap">
                    {assignment.submission.reviewNotes}
                  </p>
                </div>
              )}
              {!isPassed && (isFailed || assignment.allowResubmission) && (
                <p className="text-xs text-muted-foreground flex items-start gap-1.5">
                  <FileText className="h-3.5 w-3.5 text-accent shrink-0 mt-0.5" />
                  {isFailed ? "Revision requested — upload an updated file below." : t("assignments.resubmissionEnabled")}
                </p>
              )}
            </div>
          )}

          {/* Expandable upload section when unlocked & eligible */}
          {canUpload && (
            <Collapsible open={open} onOpenChange={setOpen}>
              <div className="flex flex-wrap items-center gap-2">
                <CollapsibleTrigger asChild>
                  <Button size="sm" className="gap-2 shadow-sm">
                    <Upload className="h-4 w-4" />
                    {assignment.submission ? t("assignments.resubmit") : t("assignments.submitAssignment")}
                    <ChevronDown className={`h-3 w-3 transition-transform ${open ? "rotate-180" : ""}`} />
                  </Button>
                </CollapsibleTrigger>
              </div>
              <CollapsibleContent className="mt-3 space-y-3">
                {assignment.instructions && (
                  <div className="rounded-lg border border-border bg-muted/40 p-3.5">
                    <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">{t("assignments.instructions")}</p>
                    <p className="text-sm text-foreground whitespace-pre-wrap">{assignment.instructions}</p>
                  </div>
                )}
                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground flex items-center gap-2">
                    <FileText className="h-4 w-4 text-accent" />
                    {t("assignments.uploadSubmissionFormats")}
                  </label>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".pdf,.doc,.docx,.ppt,.pptx,.txt"
                    onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                    className="block w-full text-sm text-foreground file:mr-3 file:py-1.5 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-primary file:text-primary-foreground hover:file:bg-primary/90 cursor-pointer"
                  />
                  {selectedFile && (
                    <p className="text-xs text-muted-foreground">
                      {t("assignments.selected")} {selectedFile.name} ({Math.round(selectedFile.size / 1024)} KB)
                    </p>
                  )}
                  <Button onClick={handleSubmit} disabled={!selectedFile || uploading} size="sm" className="gap-2 shadow-sm">
                    <Upload className="h-4 w-4" />
                    {uploading ? t("assignments.uploading") : t("assignments.confirmSubmission")}
                  </Button>
                </div>
              </CollapsibleContent>
            </Collapsible>
          )}

          {/* Certificate link shown only once passed or issued */}
          {(isPassed || assignment.certificate) && (
            <div className="pt-2 border-t border-border">
              <Button variant="link" size="sm" onClick={() => navigate(["student", "certificates"])} className="gap-2 p-0 h-auto text-accent">
                <Award className="h-4 w-4" /> {t("assignments.viewMyCertificates")}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={viewOpen} onOpenChange={setViewOpen}>
        <DialogContent className="w-[95vw] max-w-3xl max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ClipboardList className="h-4 w-4 text-accent" />
              {assignment.title}
            </DialogTitle>
            <DialogDescription>
              {assignment.courseTitle}
              {assignment.dueDate ? ` · Due ${formatDate(assignment.dueDate)}` : ""}
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
                  {t("assignments.instructions")}
                </p>
                <p className="text-sm text-foreground whitespace-pre-wrap">{assignment.instructions}</p>
              </div>
            )}
            {assignment.fileUrl ? (
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Assignment Brief
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
                  title={assignment.title}
                  className="w-full h-[360px] rounded-lg border border-border bg-background"
                />
              </div>
            ) : (
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
