"use client";

import { useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { EmptyState } from "@/components/shared/empty-state";
import { useApiFetch } from "@/hooks/use-api";
import { useAppStore } from "@/stores/app-store";
import { useI18n } from "@/lib/i18n/store";
import { toast } from "@/hooks/use-toast";
import { formatDate, formatDateTime } from "@/types";
import {
  Award, Search, MoreHorizontal, Settings2, Eye, Download,
} from "lucide-react";

interface CourseListItem { id: string; title: string; isPublished: boolean; }

interface TemplateRow {
  courseId: string;
  courseTitle: string;
  template: {
    id: string;
    isEnabled: boolean;
    title: string;
    layout: "CLASSIC" | "MODERN" | "MINIMAL";
    organizationName: string;
    createdAt: string;
  } | null;
  issuedCount: number;
}

interface TemplatesResponse { templates: TemplateRow[] }

interface IssuedCertificate {
  id: string;
  studentName: string;
  studentEmail: string;
  courseTitle: string;
  templateTitle: string;
  certificateNumber: string;
  issuedAt: string;
}

export function AdminCertificates() {
  const { t } = useI18n();
  const navigate = useAppStore((s) => s.navigate);
  const [search, setSearch] = useState("");
  const [courseFilter, setCourseFilter] = useState<string>("ALL");
  const [issuedFor, setIssuedFor] = useState<TemplateRow | null>(null);

  const { data: coursesData } = useApiFetch<{ courses: CourseListItem[] }>("/api/admin/courses");
  const { data, loading, error, refetch } = useApiFetch<TemplatesResponse>(
    "/api/admin/certificates/templates"
  );

  const templates = data?.templates || [];

  const filtered = useMemo(() => {
    let list = templates;
    if (courseFilter !== "ALL") {
      list = list.filter((t) => t.courseId === courseFilter);
    }
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter(
        (t) =>
          t.courseTitle.toLowerCase().includes(q) ||
          (t.template?.title || "").toLowerCase().includes(q)
      );
    }
    return list;
  }, [templates, courseFilter, search]);

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
              <SelectTrigger className="h-9 w-full rounded-lg sm:w-[200px]" aria-label={t("common.course")}>
                <SelectValue placeholder={t("common.all")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">{t("common.all")}</SelectItem>
                {(coursesData?.courses || []).map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.title}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </Card>

      <Card className="border-border bg-card p-0 shadow-sm overflow-hidden">
        {loading ? (
          <div className="space-y-2 p-4">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-14 w-full" />
            ))}
          </div>
        ) : error ? (
          <EmptyState className="m-4" icon={<Award className="h-5 w-5" />} title={t("common.error")} description={error} />
        ) : filtered.length === 0 ? (
          <EmptyState
            className="m-4"
            icon={<Award className="h-5 w-5" />}
            title={t("empty.noCourses")}
            description={t("courses.certificateDesc")}
          />
        ) : (
          <div className="overflow-x-auto scrollbar-thin">
<Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{t("table.course")}</TableHead>
                <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{t("common.title")}</TableHead>
                <TableHead className="text-center text-xs font-semibold uppercase tracking-wider text-muted-foreground">{t("certificates.issuedOn")}</TableHead>
                <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{t("common.status")}</TableHead>
                <TableHead className="hidden text-xs font-semibold uppercase tracking-wider text-muted-foreground md:table-cell">{t("common.date")}</TableHead>
                <TableHead className="text-right text-xs font-semibold uppercase tracking-wider text-muted-foreground">{t("table.actions")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((row) => (
                <TableRow key={row.courseId} className="hover:bg-muted/40">
                  <TableCell className="font-medium text-foreground">{row.courseTitle}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {row.template?.title || <span className="italic text-muted-foreground/70">Not configured</span>}
                  </TableCell>
                  <TableCell className="text-center">
                    {row.issuedCount > 0 ? (
                      <button
                        className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-sm font-medium text-accent transition-colors hover:bg-accent/10"
                        onClick={() => setIssuedFor(row)}
                      >
                        {row.issuedCount}
                      </button>
                    ) : (
                      <span className="text-sm text-muted-foreground">0</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {!row.template ? (
                      <Badge variant="outline" className="text-muted-foreground">{t("courses.certificateSettings")}</Badge>
                    ) : row.template.isEnabled ? (
                      <Badge className="bg-success/15 text-success">{t("common.active")}</Badge>
                    ) : (
                      <Badge className="bg-warning/15 text-warning">{t("common.expired")}</Badge>
                    )}
                  </TableCell>
                  <TableCell className="hidden text-sm text-muted-foreground md:table-cell">
                    {row.template ? formatDate(row.template.createdAt) : "—"}
                  </TableCell>
                  <TableCell className="text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" aria-label={`Actions for ${row.courseTitle}`} className="text-muted-foreground hover:text-foreground hover:bg-muted">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-48">
                        <DropdownMenuItem
                          onClick={() => navigate(["admin", "courses", row.courseId], { tab: "certificate" })}
                          className="gap-2"
                        >
                          <Settings2 className="h-4 w-4 text-muted-foreground" /> {t("courses.certificateSettings")}
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => setIssuedFor(row)}
                          disabled={row.issuedCount === 0}
                          className="gap-2"
                        >
                          <Eye className="h-4 w-4 text-muted-foreground" /> {t("admin.viewDetails")}
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
</div>
        )}
      </Card>

      {/* Issued certificates dialog */}
      <IssuedCertificatesDialog
        row={issuedFor}
        onOpenChange={(open) => !open && setIssuedFor(null)}
        onRefresh={refetch}
      />
    </div>
  );
}

function IssuedCertificatesDialog({
  row, onOpenChange, onRefresh,
}: {
  row: TemplateRow | null;
  onOpenChange: (v: boolean) => void;
  onRefresh: () => void;
}) {
  const courseId = row?.courseId;
  const { data, loading, error } = useApiFetch<{ certificates: IssuedCertificate[] }>(
    courseId ? `/api/admin/certificates?courseId=${courseId}` : null,
    { skip: !courseId }
  );

  const open = !!row;
  const certs = data?.certificates || [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="animate-scale-in w-[95vw] max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-heading text-lg font-semibold">Issued Certificates — {row?.courseTitle}</DialogTitle>
          <DialogDescription>
            {certs.length} certificate{certs.length === 1 ? "" : "s"} issued for this course.
          </DialogDescription>
        </DialogHeader>
        {loading ? (
          <div className="space-y-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        ) : error ? (
          <EmptyState icon={<Award className="h-5 w-5" />} title="Couldn't load certificates" description={error} />
        ) : certs.length === 0 ? (
          <EmptyState icon={<Award className="h-5 w-5" />} title="No certificates issued yet" description="Once students complete this course, their certificates will appear here." />
        ) : (
          <div className="max-h-[60vh] overflow-y-auto -mx-1 px-1 scrollbar-thin">
            <div className="overflow-x-auto scrollbar-thin">
<Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Student</TableHead>
                  <TableHead className="hidden text-xs font-semibold uppercase tracking-wider text-muted-foreground md:table-cell">Certificate No.</TableHead>
                  <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Issued</TableHead>
                  <TableHead className="text-right text-xs font-semibold uppercase tracking-wider text-muted-foreground">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {certs.map((c) => (
                  <TableRow key={c.id} className="hover:bg-muted/40">
                    <TableCell>
                      <p className="font-medium text-foreground">{c.studentName}</p>
                      <p className="text-xs text-muted-foreground truncate">{c.studentEmail}</p>
                    </TableCell>
                    <TableCell className="hidden md:table-cell">
                      <code className="rounded bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">
                        {c.certificateNumber}
                      </code>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {formatDateTime(c.issuedAt)}
                    </TableCell>
                    <TableCell className="text-right">
                      <a
                        href={`/api/public/certificates/${c.certificateNumber}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-accent"
                        aria-label="View certificate"
                        onClick={(e) => {
                          // If public verification endpoint doesn't exist, just inform via toast
                          if (!c.certificateNumber) {
                            e.preventDefault();
                            toast({ title: "Certificate number missing", variant: "destructive" });
                          }
                        }}
                      >
                        <Download className="h-3.5 w-3.5" />
                      </a>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
</div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
