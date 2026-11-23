"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { EmptyState } from "@/components/shared/empty-state";
import { useApiFetch } from "@/hooks/use-api";
import {
  Award, Download, Eye, FileText, Calendar, ShieldCheck, Building2, UserCheck, PenTool,
} from "lucide-react";
import { formatDate } from "@/types";
import { useI18n } from "@/lib/i18n/store";

interface CertificateItem {
  id: string;
  certificateNumber: string;
  courseId: string;
  courseTitle: string;
  templateTitle: string;
  templateText: string;
  organizationName: string;
  appName?: string;
  appLogoUrl?: string | null;
  universityName?: string | null;
  instructorName?: string | null;
  instructorSignatureUrl?: string | null;
  issuedAt: string;
}

export function StudentCertificates({
  initialCertId = null,
}: {
  initialCertId?: string | null;
}) {
  const { t } = useI18n();
  const { data, loading, error } = useApiFetch<{
    certificates: CertificateItem[];
  }>("/api/student/certificates", {
    freshOnMount: true,
    revalidateOnFocus: true,
  });

  const [previewCert, setPreviewCert] = useState<CertificateItem | null>(null);

  useEffect(() => {
    if (!initialCertId || !data?.certificates) return;
    const match = data.certificates.find((c) => c.id === initialCertId);
    if (match) {
      setPreviewCert(match);
    }
  }, [initialCertId, data?.certificates]);

  if (loading) {
    return (
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-64 rounded-xl" />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <EmptyState
        icon={<Award className="h-5 w-5" />}
        title={t("certificates.couldntLoad")}
        description={error}
        action={<Button onClick={() => window.location.reload()}>{t("common.reload")}</Button>}
      />
    );
  }

  const certs = data?.certificates || [];

  if (certs.length === 0) {
    return (
      <EmptyState
        icon={<Award className="h-5 w-5" />}
        title={t("certificates.noCertificates")}
        description={t("certificates.earnFirstDesc")}
      />
    );
  }

  return (
    <div className="space-y-6">
      {/* Header banner */}
      <Card className="overflow-hidden border-accent/20 shadow-sm">
        <div className="relative bg-gradient-to-br from-soft-sage via-accent/[0.06] to-card">
          <div
            className="pointer-events-none absolute -right-12 -top-12 h-48 w-48 rounded-full opacity-50"
            style={{ background: "radial-gradient(circle, rgba(120,151,134,0.18), transparent 70%)" }}
          />
          <CardContent className="relative p-5 flex items-start gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent/15 text-accent shrink-0 ring-1 ring-accent/20">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <div>
              <p className="font-heading font-semibold text-foreground">
                {certs.length} {t("certificates.certificateEarned")}
              </p>
              <p className="text-sm text-muted-foreground mt-0.5 max-w-2xl">
                {t("certificates.eachCertificateDesc")}
              </p>
            </div>
          </CardContent>
        </div>
      </Card>

      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {certs.map((c) => (
          <Card key={c.id} className="group overflow-hidden p-0 shadow-sm transition-all duration-200 hover:shadow-md hover:-translate-y-1 flex flex-col">
            {/* Premium ribbon header */}
            <div className="relative h-32 bg-gradient-to-br from-primary via-primary to-accent flex items-center justify-center overflow-hidden">
              {/* Decorative pattern */}
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.25),transparent_60%)] pointer-events-none" />
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_bottom_left,rgba(120,151,134,0.35),transparent_50%)] pointer-events-none" />
              {/* Subtle pattern */}
              <div className="pointer-events-none absolute inset-0 opacity-20" style={{ backgroundImage: "repeating-linear-gradient(135deg, transparent, transparent 10px, rgba(255,255,255,0.05) 10px, rgba(255,255,255,0.05) 20px)" }} />
              <Award className="relative h-12 w-12 text-primary-foreground drop-shadow-lg transition-transform duration-300 group-hover:scale-110" />
              <Badge className="absolute top-3 right-3 bg-white/15 backdrop-blur text-primary-foreground border border-white/20">
                <ShieldCheck className="h-3 w-3" /> {t("common.verified")}
              </Badge>
              {/* Certificate icon accent */}
              <div className="absolute -bottom-6 left-1/2 -translate-x-1/2 flex h-12 w-12 items-center justify-center rounded-full bg-card ring-4 ring-card shadow-md">
                <Award className="h-6 w-6 text-accent" />
              </div>
            </div>
            <CardContent className="p-5 pt-8 space-y-3 flex-1 flex flex-col">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">{c.templateTitle}</p>
                <h3 className="font-heading text-base font-semibold text-foreground line-clamp-2 mt-1.5 min-h-[2.5rem]">
                  {c.courseTitle}
                </h3>
              </div>
              <div className="space-y-1.5 text-xs text-muted-foreground">
                <p className="flex items-center gap-1.5">
                  <Calendar className="h-3 w-3 text-accent shrink-0" /> {t("certificates.issuedOn")} {formatDate(c.issuedAt)}
                </p>
                <p className="flex items-center gap-1.5">
                  <FileText className="h-3 w-3 text-accent shrink-0" /> {t("certificates.certificateId")}: {c.certificateNumber}
                </p>
                <p className="flex items-center gap-1.5">
                  <ShieldCheck className="h-3 w-3 text-accent shrink-0" /> {t("certificates.issuedBy")} {c.appName || c.organizationName}
                </p>
                {c.universityName && (
                  <p className="flex items-center gap-1.5">
                    <Building2 className="h-3 w-3 text-accent shrink-0" /> {c.universityName}
                  </p>
                )}
                {c.instructorName && (
                  <p className="flex items-center gap-1.5">
                    <UserCheck className="h-3 w-3 text-accent shrink-0" /> Instructor: {c.instructorName}
                  </p>
                )}
              </div>

              {/* Instructor Signature Box */}
              <div className="rounded-lg border border-border/80 bg-muted/30 p-2.5 mt-auto">
                <div className="flex items-center justify-between gap-2 mb-1.5">
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                    <PenTool className="h-3 w-3 text-accent" /> Instructor Signature
                  </span>
                  {c.instructorName && (
                    <span className="text-[11px] font-medium text-foreground truncate max-w-[140px]">
                      {c.instructorName}
                    </span>
                  )}
                </div>
                {c.instructorSignatureUrl ? (
                  <div className="h-12 w-full rounded bg-white border border-border/60 flex items-center justify-center px-2">
                    <img
                      src={c.instructorSignatureUrl}
                      alt={`${c.instructorName || "Instructor"} signature`}
                      className="max-h-10 max-w-full object-contain"
                    />
                  </div>
                ) : (
                  <div className="h-10 w-full rounded bg-white/60 border border-dashed border-border flex items-center justify-center">
                    <span className="text-[11px] italic text-muted-foreground">
                      {c.instructorName ? `Authorized by ${c.instructorName}` : "Authorized Signatory"}
                    </span>
                  </div>
                )}
              </div>

              <div className="flex gap-2 pt-3 border-t border-border">
                <Button
                  size="sm"
                  variant="outline"
                  className="flex-1 gap-2 shadow-sm"
                  onClick={() => setPreviewCert(c)}
                >
                  <Eye className="h-4 w-4" /> {t("certificates.view")}
                </Button>
                <Button
                  size="sm"
                  className="flex-1 gap-2 shadow-sm"
                  asChild
                >
                  <a
                    href={`/api/student/certificates/${c.id}/pdf`}
                    download
                    rel="noreferrer"
                  >
                    <Download className="h-4 w-4" /> {t("certificates.pdf")}
                  </a>
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Preview dialog with iframe */}
      <Dialog open={!!previewCert} onOpenChange={(o) => !o && setPreviewCert(null)}>
        <DialogContent className="animate-scale-in max-w-5xl w-full h-[90vh] flex flex-col p-0 gap-0">
          <DialogHeader className="p-4 border-b border-border flex-row items-center justify-between space-y-0 bg-gradient-to-r from-soft-sage/60 to-card">
            <div>
              <DialogTitle className="text-base">{previewCert?.templateTitle}</DialogTitle>
              <DialogDescription>{previewCert?.courseTitle}</DialogDescription>
            </div>
            {previewCert && (
              <Button asChild size="sm" className="gap-2 shadow-sm">
                <a
                  href={`/api/student/certificates/${previewCert.id}/pdf`}
                  download
                  rel="noreferrer"
                >
                  <Download className="h-4 w-4" /> {t("certificates.downloadPdf")}
                </a>
              </Button>
            )}
          </DialogHeader>
          {previewCert && (
            <iframe
              src={`/api/student/certificates/${previewCert.id}/preview`}
              title={previewCert.templateTitle}
              className="flex-1 w-full border-0"
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
