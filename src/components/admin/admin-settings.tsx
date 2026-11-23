"use client";

import { useEffect, useState } from "react";
import {
  Card, CardContent, CardDescription, CardHeader, CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { useApiFetch, apiPost } from "@/hooks/use-api";
import { useAppStore } from "@/stores/app-store";
import { useI18n } from "@/lib/i18n/store";
import { toast } from "@/hooks/use-toast";
import {
  Shield, Mail, Lock, BookOpen, Users, Award, CreditCard, ClipboardList,
  Layers, Cpu, Database, Server, Save, Sparkles, Upload, Trash2, GraduationCap,
} from "lucide-react";

interface OverviewData {
  totalStudents: number;
  totalCourses: number;
  totalFreeCourses: number;
  totalPaidCourses: number;
  totalActiveSubscriptions: number;
  totalExpiredSubscriptions: number;
  totalAssignments: number;
  totalSubmittedAssignments: number;
  totalCertificatesIssued: number;
}

export function AdminSettings() {
  const { t } = useI18n();
  const user = useAppStore((s) => s.user);
  const branding = useAppStore((s) => s.branding);
  const setBranding = useAppStore((s) => s.setBranding);
  const refreshBranding = useAppStore((s) => s.refreshBranding);
  const { data, loading } = useApiFetch<OverviewData>("/api/admin/overview");

  // App Branding state
  const [appName, setAppName] = useState(branding.appName || "CourseLearn");
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(branding.logoUrl);
  const [removeLogo, setRemoveLogo] = useState(false);
  const [savingBranding, setSavingBranding] = useState(false);

  // Sync branding state when store refreshes
  useEffect(() => {
    setAppName(branding.appName || "CourseLearn");
  }, [branding.appName]);

  useEffect(() => {
    setLogoPreview(branding.logoUrl);
  }, [branding.logoUrl]);

  // Revoke object URL preview on cleanup
  useEffect(() => {
    return () => {
      if (logoPreview && logoPreview.startsWith("blob:")) {
        URL.revokeObjectURL(logoPreview);
      }
    };
  }, [logoPreview]);

  function handleLogoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (logoPreview && logoPreview.startsWith("blob:")) {
      URL.revokeObjectURL(logoPreview);
    }
    setLogoFile(file);
    setRemoveLogo(false);
    setLogoPreview(URL.createObjectURL(file));
  }

  function handleRemoveLogo() {
    if (logoPreview && logoPreview.startsWith("blob:")) {
      URL.revokeObjectURL(logoPreview);
    }
    setLogoFile(null);
    setLogoPreview(null);
    setRemoveLogo(true);
  }

  async function saveBranding() {
    const cleanName = appName.trim();
    if (!cleanName) {
      toast({ title: "App name is required", variant: "destructive" });
      return;
    }
    setSavingBranding(true);
    try {
      const fd = new FormData();
      fd.append("appName", cleanName);
      if (logoFile) {
        fd.append("logo", logoFile);
      }
      if (removeLogo && !logoFile) {
        fd.append("removeLogo", "true");
      }
      const updated = await apiPost<{ appName: string; logoUrl: string | null }>(
        "/api/admin/settings",
        fd,
        { method: "POST", rawBody: true }
      );
      setBranding({
        appName: updated.appName,
        logoUrl: updated.logoUrl,
      });
      setLogoFile(null);
      setRemoveLogo(false);
      setLogoPreview(updated.logoUrl);
      await refreshBranding();
      toast({
        title: "App branding updated",
        description: `${updated.appName} is now active across the platform and certificates.`,
      });
    } catch {
      /* toast shown by apiPost */
    } finally {
      setSavingBranding(false);
    }
  }

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [saving, setSaving] = useState(false);

  async function changePassword() {
    if (!currentPassword || !newPassword) {
      toast({ title: t("common.required"), variant: "destructive" });
      return;
    }
    if (newPassword.length < 6) {
      toast({ title: t("common.password"), description: t("common.required"), variant: "destructive" });
      return;
    }
    if (newPassword !== confirmPassword) {
      toast({ title: t("common.password"), variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      await apiPost("/api/auth/password", {
        currentPassword,
        newPassword,
      });
      toast({ title: t("profile.passwordChanged") });
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch {
      /* toast */
    } finally {
      setSaving(false);
    }
  }

  const initials = (user?.name || "A")
    .split(" ")
    .map((s) => s[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <div className="space-y-5 max-w-4xl">
      {/* App Branding (Name & Logo) */}
      <Card className="border-border bg-card p-5 shadow-sm">
        <CardHeader className="p-0">
          <CardTitle className="font-heading text-base font-semibold flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-accent" /> App Branding (Name &amp; Logo)
          </CardTitle>
          <CardDescription className="mt-1">
            Customize the platform name and logo shown across all dashboards, login screens, navigation bars, browser title, and issued certificates.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0 mt-4 space-y-4">
          <div className="grid gap-4 sm:grid-cols-[1fr_auto] sm:items-end">
            <div className="space-y-1.5">
              <Label htmlFor="platform-app-name" className="text-xs font-medium text-muted-foreground">
                Platform App Name
              </Label>
              <Input
                id="platform-app-name"
                value={appName}
                onChange={(e) => setAppName(e.target.value)}
                placeholder="e.g. EduPulse Academy"
                maxLength={80}
                className="h-9 rounded-lg"
              />
            </div>

            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-xl border border-border bg-muted/40 shrink-0">
                {logoPreview ? (
                  <img
                    key="admin-branding-preview"
                    src={logoPreview}
                    alt={appName || "App logo"}
                    className="h-full w-full object-contain bg-card p-1"
                  />
                ) : (
                  <GraduationCap key="admin-branding-icon" className="h-6 w-6 text-primary" />
                )}
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Label
                  htmlFor="platform-logo-upload"
                  className="inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-lg border border-border bg-background px-3 text-xs font-medium text-foreground shadow-sm transition-colors hover:bg-muted"
                >
                  <Upload className="h-3.5 w-3.5" />
                  <span>{logoPreview ? "Change Logo" : "Upload Logo"}</span>
                </Label>
                <input
                  id="platform-logo-upload"
                  type="file"
                  accept="image/png,image/jpeg,image/webp,image/svg+xml"
                  onChange={handleLogoChange}
                  className="sr-only"
                />
                {logoPreview && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleRemoveLogo}
                    className="h-9 gap-1.5 text-destructive hover:text-destructive"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    <span>Remove</span>
                  </Button>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between gap-3 rounded-lg border border-border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
            <span>Accepted formats: PNG, JPG, WebP, SVG. Changes apply immediately everywhere.</span>
            <Button
              type="button"
              disabled={savingBranding}
              onClick={saveBranding}
              className="h-9 gap-2 shrink-0"
            >
              <Save className="h-4 w-4" />
              <span>{savingBranding ? t("common.saving") : "Save Branding"}</span>
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Platform Information */}
      <Card className="border-border bg-card p-5 shadow-sm">
        <CardHeader className="p-0">
          <CardTitle className="font-heading text-base font-semibold">{t("admin.platformInfo")}</CardTitle>
          <CardDescription className="mt-1">{t("admin.platformInfo")}</CardDescription>
        </CardHeader>
        <CardContent className="p-0 mt-4">
          {loading ? (
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              {Array.from({ length: 8 }).map((_, i) => (
                <Skeleton key={i} className="h-20 w-full" />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              <StatBox icon={<Users className="h-4 w-4" />} label={t("common.students")} value={data?.totalStudents ?? 0} />
              <StatBox icon={<BookOpen className="h-4 w-4" />} label={t("common.courses")} value={data?.totalCourses ?? 0} />
              <StatBox icon={<Layers className="h-4 w-4" />} label={t("common.free")} value={data?.totalFreeCourses ?? 0} />
              <StatBox icon={<Layers className="h-4 w-4" />} label={t("common.paid")} value={data?.totalPaidCourses ?? 0} />
              <StatBox icon={<CreditCard className="h-4 w-4" />} label={t("common.active")} value={data?.totalActiveSubscriptions ?? 0} />
              <StatBox icon={<CreditCard className="h-4 w-4" />} label={t("common.expired")} value={data?.totalExpiredSubscriptions ?? 0} />
              <StatBox icon={<ClipboardList className="h-4 w-4" />} label={t("common.assignments")} value={data?.totalAssignments ?? 0} />
              <StatBox icon={<Award className="h-4 w-4" />} label={t("common.certificateManagement")} value={data?.totalCertificatesIssued ?? 0} />
            </div>
          )}
        </CardContent>
      </Card>

      {/* Admin Profile */}
      <Card className="border-border bg-card p-5 shadow-sm">
        <CardHeader className="p-0">
          <CardTitle className="font-heading text-base font-semibold">{t("dashboard.adminConsole")}</CardTitle>
          <CardDescription className="mt-1">{t("common.profile")}</CardDescription>
        </CardHeader>
        <CardContent className="p-0 mt-4">
          <div className="flex items-center gap-4 rounded-xl border border-border bg-gradient-to-br from-primary/5 to-accent/5 p-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary text-primary-foreground font-semibold ring-2 ring-accent/20 shrink-0">
              {initials}
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-heading font-semibold text-foreground">{user?.name}</p>
              <p className="text-sm text-muted-foreground flex items-center gap-1.5 mt-0.5">
                <Mail className="h-3.5 w-3.5 shrink-0" /> {user?.email}
              </p>
            </div>
            <Badge className="bg-accent/15 text-accent gap-1">
              <Shield className="h-3 w-3" /> {t("dashboard.adminConsole")}
            </Badge>
          </div>
        </CardContent>
      </Card>

      {/* Change Password */}
      <Card className="border-border bg-card p-5 shadow-sm">
        <CardHeader className="p-0">
          <CardTitle className="font-heading text-base font-semibold flex items-center gap-2">
            <Lock className="h-4 w-4 text-accent" /> {t("profile.changePassword")}
          </CardTitle>
          <CardDescription className="mt-1">{t("profile.changePassword")}</CardDescription>
        </CardHeader>
        <CardContent className="p-0 mt-4 space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="cur-pass" className="text-xs font-medium text-muted-foreground">{t("profile.currentPassword")}</Label>
            <Input
              id="cur-pass"
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              autoComplete="current-password"
              className="h-9 rounded-lg"
            />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="new-pass" className="text-xs font-medium text-muted-foreground">{t("profile.newPassword")}</Label>
              <Input
                id="new-pass"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                autoComplete="new-password"
                className="h-9 rounded-lg"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="conf-pass" className="text-xs font-medium text-muted-foreground">{t("profile.newPassword")}</Label>
              <Input
                id="conf-pass"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                autoComplete="new-password"
                className="h-9 rounded-lg"
              />
            </div>
          </div>
          <div className="flex justify-end">
            <Button disabled={saving} onClick={changePassword} className="h-9 gap-2">
              <Save className="h-4 w-4" /> {saving ? t("common.saving") : t("profile.saveChanges")}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Platform Information */}
      <Card className="border-border bg-card p-5 shadow-sm">
        <CardHeader className="p-0">
          <CardTitle className="font-heading text-base font-semibold">{t("admin.platformInfo")}</CardTitle>
          <CardDescription className="mt-1">{t("admin.platformInfo")}</CardDescription>
        </CardHeader>
        <CardContent className="p-0 mt-4">
          <ul className="space-y-2.5 text-sm">
            <InfoRow icon={<Cpu className="h-4 w-4" />} label="Framework" value="Next.js 16 (App Router)" />
            <InfoRow icon={<Server className="h-4 w-4" />} label="Language" value="TypeScript 5" />
            <InfoRow icon={<Database className="h-4 w-4" />} label="Database" value="SQLite via Prisma ORM" />
            <InfoRow icon={<Layers className="h-4 w-4" />} label="UI Components" value="shadcn/ui (New York) + Tailwind CSS 4" />
            <InfoRow icon={<Shield className="h-4 w-4" />} label="Auth" value="Cookie-based HMAC session tokens (PBKDF2 password hashing)" />
          </ul>
          <Separator className="my-4" />
          <p className="text-xs text-muted-foreground">
            {branding.appName || "CourseLearn"} — Online Training &amp; Course Management Platform.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

function StatBox({ icon, label, value }: { icon: React.ReactNode; label: string; value: number }) {
  return (
    <div className="rounded-xl border border-border bg-card p-3 flex items-center gap-3 shadow-sm transition-shadow hover:shadow-md">
      <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-accent/10 text-accent shrink-0">
        {icon}
      </div>
      <div className="min-w-0">
        <p className="font-heading text-xl font-bold text-foreground leading-none">
          {value.toLocaleString()}
        </p>
        <p className="text-[11px] uppercase tracking-wider text-muted-foreground mt-1 truncate">{label}</p>
      </div>
    </div>
  );
}

function InfoRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <li className="flex items-center gap-3">
      <div className="flex h-7 w-7 items-center justify-center rounded-md bg-muted text-muted-foreground shrink-0">
        {icon}
      </div>
      <span className="text-muted-foreground w-32 text-xs">{label}</span>
      <span className="text-foreground font-medium">{value}</span>
    </li>
  );
}
