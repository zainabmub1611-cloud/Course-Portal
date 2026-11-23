"use client";

import { useEffect, useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
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
import { useApiFetch, apiPost } from "@/hooks/use-api";
import { useAppStore } from "@/stores/app-store";
import { useI18n } from "@/lib/i18n/store";
import { toast } from "@/hooks/use-toast";
import { formatDate, formatDateTime, type SubscriptionPlanPublic } from "@/types";
import {
  Users, Search, Plus, MoreHorizontal, Eye, Pencil, Trash2, Mail,
  Phone, Calendar, Shield, Award, ClipboardList, BookOpen, User as UserIcon,
} from "lucide-react";

interface StudentRow {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  createdAt: string;
  subscription: {
    planName: string;
    startDate: string;
    expiryDate: string;
    status: "ACTIVE" | "EXPIRED";
    planId: string;
  } | null;
}

interface StudentsResponse {
  students: StudentRow[];
}

interface PlansResponse {
  plans: SubscriptionPlanPublic[];
}

interface StudentProfile {
  student: {
    id: string;
    name: string;
    email: string;
    phone: string | null;
    bio: string | null;
    profilePhoto: string | null;
    createdAt: string;
  };
  subscription: {
    id: string;
    planId: string;
    planName: string;
    planPrice: number;
    planCurrency: string;
    planDuration: number;
    planDurationUnit: string;
    startDate: string;
    expiryDate: string;
    status: "ACTIVE" | "EXPIRED";
  } | null;
  availableCourses: {
    id: string;
    title: string;
    thumbnail: string | null;
    category: string | null;
    accessType: "FREE" | "PAID";
    accessible: boolean;
  }[];
  submissions: {
    id: string;
    assignmentTitle: string;
    courseTitle: string;
    submittedAt: string;
    status: "SUBMITTED" | "PASSED" | "FAILED" | "REVIEWED";
    fileUrl: string;
  }[];
  certificates: {
    id: string;
    courseTitle: string;
    certificateNumber: string;
    issuedAt: string;
    templateTitle: string;
  }[];
  stats: {
    accessibleCourseCount: number;
    submissionsCount: number;
    certificatesCount: number;
  };
}

const PAGE_SIZE = 10;

export function AdminStudents() {
  const { t } = useI18n();
  const query = useAppStore((s) => s.query);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"ALL" | "ACTIVE" | "EXPIRED">("ALL");
  const [planFilter, setPlanFilter] = useState<string>("ALL");
  const [page, setPage] = useState(1);
  const [addOpen, setAddOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [profileId, setProfileId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<StudentRow | null>(null);
  const [editTarget, setEditTarget] = useState<StudentRow | null>(null);

  const { data: plansData } = useApiFetch<PlansResponse>("/api/public/plans");

  // Build query string
  const qs = useMemo(() => {
    const p = new URLSearchParams();
    if (search.trim()) p.set("q", search.trim());
    if (statusFilter !== "ALL") p.set("status", statusFilter);
    if (planFilter !== "ALL") p.set("planId", planFilter);
    const s = p.toString();
    return s ? `?${s}` : "";
  }, [search, statusFilter, planFilter]);

  const { data, loading, error, refetch } = useApiFetch<StudentsResponse>(
    qs ? `/api/admin/students${qs}` : "/api/admin/students"
  );

  // Auto-open Add dialog when query.action=new — React 19 "store previous value" pattern
  const [lastAction, setLastAction] = useState<string | undefined>(undefined);
  if (query.action !== lastAction) {
    setLastAction(query.action);
    if (query.action === "new") setAddOpen(true);
  }

  const students = data?.students || [];
  const totalPages = Math.max(1, Math.ceil(students.length / PAGE_SIZE));
  const currentPage = Math.min(Math.max(1, page), totalPages);
  const pageItems = students.slice(
    (currentPage - 1) * PAGE_SIZE,
    currentPage * PAGE_SIZE
  );

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <Card className="border-border bg-card p-4 shadow-sm">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="flex flex-1 flex-col gap-3 sm:flex-row sm:items-center">
            <div className="relative flex-1">
              <Search className="absolute start-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
                placeholder={t("common.search")}
                className="h-10 sm:h-9 rounded-lg ps-9 focus-visible:ring-2 focus-visible:ring-ring"
                aria-label={t("common.search")}
              />
            </div>
            <Select
              value={statusFilter}
              onValueChange={(v) => {
                setStatusFilter(v as "ALL" | "ACTIVE" | "EXPIRED");
                setPage(1);
              }}
            >
              <SelectTrigger className="h-9 w-full rounded-lg sm:w-[140px]" aria-label={t("common.status")}>
                <SelectValue placeholder={t("common.allStatuses")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">{t("common.allStatuses")}</SelectItem>
                <SelectItem value="ACTIVE">{t("common.active")}</SelectItem>
                <SelectItem value="EXPIRED">{t("common.expired")}</SelectItem>
              </SelectContent>
            </Select>
            <Select
              value={planFilter}
              onValueChange={(v) => {
                setPlanFilter(v);
                setPage(1);
              }}
            >
              <SelectTrigger className="h-9 w-full rounded-lg sm:w-[180px]" aria-label={t("table.plan")}>
                <SelectValue placeholder={t("common.subscriptionPlans")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">{t("common.subscriptionPlans")}</SelectItem>
                {(plansData?.plans || []).map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button className="h-9 gap-2" onClick={() => setAddOpen(true)}>
            <Plus className="h-4 w-4" /> {t("dashboard.addStudent")}
          </Button>
        </div>
      </Card>

      {/* Content */}
      <Card className="border-border bg-card p-0 shadow-sm overflow-hidden">
        {loading ? (
          <div className="space-y-2 p-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        ) : error ? (
          <EmptyState
            className="m-4"
            icon={<Users className="h-5 w-5" />}
            title={t("common.error")}
            description={error}
          />
        ) : students.length === 0 ? (
          <EmptyState
            className="m-4"
            icon={<Users className="h-5 w-5" />}
            title={t("empty.noStudents")}
            description={t("empty.noStudentsDesc")}
            action={<Button onClick={() => setAddOpen(true)} className="gap-2"><Plus className="h-4 w-4" /> {t("dashboard.addStudent")}</Button>}
          />
        ) : (
          <>
            <div className="overflow-x-auto scrollbar-thin">
<Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{t("table.student")}</TableHead>
                  <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{t("table.plan")}</TableHead>
                  <TableHead className="hidden text-xs font-semibold uppercase tracking-wider text-muted-foreground md:table-cell">{t("table.start")}</TableHead>
                  <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{t("table.expiry")}</TableHead>
                  <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{t("common.status")}</TableHead>
                  <TableHead className="text-right text-xs font-semibold uppercase tracking-wider text-muted-foreground">{t("table.actions")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pageItems.map((s) => (
                  <TableRow
                    key={s.id}
                    className="cursor-pointer hover:bg-muted/40"
                    onClick={() => setProfileId(s.id)}
                  >
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-soft-sage text-primary text-xs font-semibold ring-1 ring-border shrink-0">
                          {s.name
                            .split(" ")
                            .map((w) => w[0])
                            .slice(0, 2)
                            .join("")
                            .toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <p className="font-medium text-foreground truncate">{s.name}</p>
                          <p className="text-xs text-muted-foreground truncate">{s.email}</p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      {s.subscription ? (
                        <span className="text-sm font-medium text-foreground">{s.subscription.planName}</span>
                      ) : (
                        <Badge variant="outline" className="text-muted-foreground">{t("common.subscriptionPlans")}</Badge>
                      )}
                    </TableCell>
                    <TableCell className="hidden text-sm text-muted-foreground md:table-cell">
                      {s.subscription ? formatDate(s.subscription.startDate) : "—"}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {s.subscription ? formatDate(s.subscription.expiryDate) : "—"}
                    </TableCell>
                    <TableCell>
                      {!s.subscription ? (
                        <Badge variant="outline" className="text-muted-foreground">{t("common.subscriptionPlans")}</Badge>
                      ) : s.subscription.status === "ACTIVE" ? (
                        <Badge className="bg-success/15 text-success hover:bg-success/20">{t("common.active")}</Badge>
                      ) : (
                        <Badge className="bg-destructive/10 text-destructive hover:bg-destructive/15">{t("common.expired")}</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" aria-label={`Actions for ${s.name}`} className="text-muted-foreground hover:text-foreground hover:bg-muted">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-48">
                          <DropdownMenuLabel className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{t("common.actions")}</DropdownMenuLabel>
                          <DropdownMenuItem onClick={() => setProfileId(s.id)} className="gap-2">
                            <Eye className="h-4 w-4 text-muted-foreground" /> {t("common.profile")}
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => {
                              setEditTarget(s);
                              setEditOpen(true);
                            }}
                            className="gap-2"
                          >
                            <Pencil className="h-4 w-4 text-muted-foreground" /> {t("common.edit")}
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            variant="destructive"
                            onClick={() => setDeleteTarget(s)}
                            className="gap-2"
                          >
                            <Trash2 className="h-4 w-4" /> {t("common.delete")}
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
</div>

            {/* Pagination */}
            <div className="flex items-center justify-between gap-2 border-t border-border bg-muted/20 px-4 py-3">
              <p className="text-xs text-muted-foreground">
                {t("common.showing")} <span className="font-medium text-foreground">{(currentPage - 1) * PAGE_SIZE + 1}</span>–
                <span className="font-medium text-foreground">{Math.min(currentPage * PAGE_SIZE, students.length)}</span> {t("common.of")} <span className="font-medium text-foreground">{students.length}</span>
              </p>
              <div className="flex gap-1.5">
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8"
                  disabled={currentPage === 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                >
                  {t("common.previous")}
                </Button>
                <span className="px-3 py-1 text-xs font-medium text-muted-foreground self-center">
                  {t("common.page")} <span className="text-foreground">{currentPage}</span> / {totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8"
                  disabled={currentPage >= totalPages}
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                >
                  {t("common.next")}
                </Button>
              </div>
            </div>
          </>
        )}
      </Card>

      {/* Add Student Dialog */}
      <AddStudentDialog
        open={addOpen}
        onOpenChange={setAddOpen}
        plans={plansData?.plans || []}
        onCreated={() => {
          refetch();
          toast({ title: t("common.success") });
        }}
      />

      {/* Edit Student Dialog */}
      <EditStudentDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        target={editTarget}
        plans={plansData?.plans || []}
        onSaved={() => {
          refetch();
          toast({ title: t("common.success") });
        }}
      />

      {/* Student Profile Sheet */}
      <StudentProfileSheet
        studentId={profileId}
        onOpenChange={(open) => {
          if (!open) setProfileId(null);
        }}
        plans={plansData?.plans || []}
        onAssigned={() => refetch()}
      />

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
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
                  await apiPost(`/api/admin/students/${deleteTarget.id}`, null, {
                    method: "DELETE",
                  });
                  toast({ title: t("common.success") });
                  setDeleteTarget(null);
                  refetch();
                } catch {
                  /* toast shown by apiPost */
                }
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

// ---------- Add Student Dialog ----------
function AddStudentDialog({
  open,
  onOpenChange,
  plans,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  plans: SubscriptionPlanPublic[];
  onCreated: () => void;
}) {
  const { t } = useI18n();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [planId, setPlanId] = useState<string>("NONE");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setName("");
      setEmail("");
      setPassword("");
      setPlanId("NONE");
    }
  }, [open]);

  async function submit() {
    if (!name.trim() || !email.trim() || !password) {
      toast({ title: t("common.required"), description: t("common.required"), variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      await apiPost("/api/admin/students", {
        name: name.trim(),
        email: email.trim(),
        password,
        planId: planId === "NONE" ? undefined : planId,
      });
      onCreated();
      onOpenChange(false);
    } catch {
      /* toast shown by apiPost */
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="animate-scale-in w-[95vw] max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-heading text-lg font-semibold">{t("dashboard.addStudent")}</DialogTitle>
          <DialogDescription>{t("dashboard.addStudent")}</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="as-name" className="text-xs font-medium text-muted-foreground">{t("auth.fullName")}</Label>
            <Input id="as-name" value={name} onChange={(e) => setName(e.target.value)} placeholder={t("auth.fullName")} className="h-9 rounded-lg" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="as-email" className="text-xs font-medium text-muted-foreground">{t("common.email")}</Label>
            <Input id="as-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder={t("common.email")} className="h-9 rounded-lg" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="as-pass" className="text-xs font-medium text-muted-foreground">{t("common.password")}</Label>
            <Input id="as-pass" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder={t("common.password")} className="h-9 rounded-lg" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="as-plan" className="text-xs font-medium text-muted-foreground">{t("common.subscriptionPlans")} ({t("common.optional")})</Label>
            <Select value={planId} onValueChange={setPlanId}>
              <SelectTrigger id="as-plan" className="w-full h-9 rounded-lg">
                <SelectValue placeholder={t("common.optional")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="NONE">{t("common.optional")}</SelectItem>
                {plans.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" className="h-9" onClick={() => onOpenChange(false)}>{t("common.cancel")}</Button>
          <Button disabled={saving} className="h-9" onClick={submit}>
            {saving ? t("common.saving") : t("common.create")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ---------- Edit Student Dialog ----------
function EditStudentDialog({
  open,
  onOpenChange,
  target,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  target: StudentRow | null;
  plans: SubscriptionPlanPublic[];
  onSaved: () => void;
}) {
  const { t } = useI18n();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [bio, setBio] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (target) {
      setName(target.name);
      setPhone(target.phone || "");
      setBio("");
    }
  }, [target]);

  async function submit() {
    if (!target) return;
    if (!name.trim()) {
      toast({ title: t("common.name") + " " + t("common.required"), variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      await apiPost(`/api/admin/students/${target.id}`, {
        name: name.trim(),
        phone: phone.trim() || null,
        bio: bio.trim() || null,
      }, { method: "PUT" });
      onSaved();
      onOpenChange(false);
    } catch {
      /* toast */
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="animate-scale-in w-[95vw] max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-heading text-lg font-semibold">{t("profile.editProfile")}</DialogTitle>
          <DialogDescription>{target?.email}</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="es-name" className="text-xs font-medium text-muted-foreground">{t("auth.fullName")}</Label>
            <Input id="es-name" value={name} onChange={(e) => setName(e.target.value)} className="h-9 rounded-lg" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="es-phone" className="text-xs font-medium text-muted-foreground">{t("profile.phone")}</Label>
            <Input id="es-phone" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder={t("profile.phone")} className="h-9 rounded-lg" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="es-bio" className="text-xs font-medium text-muted-foreground">{t("profile.bio")}</Label>
            <Textarea id="es-bio" value={bio} onChange={(e) => setBio(e.target.value)} placeholder={t("profile.bio")} rows={3} className="rounded-lg" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" className="h-9" onClick={() => onOpenChange(false)}>{t("common.cancel")}</Button>
          <Button disabled={saving} className="h-9" onClick={submit}>
            {saving ? t("common.saving") : t("profile.saveChanges")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ---------- Student Profile Sheet ----------
function StudentProfileSheet({
  studentId,
  onOpenChange,
  plans,
  onAssigned,
}: {
  studentId: string | null;
  onOpenChange: (v: boolean) => void;
  plans: SubscriptionPlanPublic[];
  onAssigned: () => void;
}) {
  const { t } = useI18n();
  const { data, loading, error, refetch } = useApiFetch<StudentProfile>(
    studentId ? `/api/admin/students/${studentId}` : null,
    { skip: !studentId }
  );
  const [assignPlanId, setAssignPlanId] = useState<string>("NONE");
  const [assigning, setAssigning] = useState(false);

  useEffect(() => {
    setAssignPlanId("NONE");
  }, [studentId]);

  async function assignPlan() {
    if (!studentId || !data || assignPlanId === "NONE") return;
    setAssigning(true);
    try {
      await apiPost(`/api/admin/students/${studentId}`, { planId: assignPlanId }, { method: "PUT" });
      toast({
        title: t("common.success"),
        description: data.student.name,
      });
      setAssignPlanId("NONE");
      refetch();
      onAssigned();
    } catch {
      /* toast */
    } finally {
      setAssigning(false);
    }
  }

  const open = !!studentId;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-lg">
        <SheetHeader>
          <SheetTitle className="font-heading text-lg font-semibold">{t("common.profile")}</SheetTitle>
          <SheetDescription>{t("common.profile")}</SheetDescription>
        </SheetHeader>

        {loading ? (
          <div className="space-y-3 px-4 pb-6">
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-32 w-full" />
            <Skeleton className="h-32 w-full" />
          </div>
        ) : error ? (
          <div className="px-4 pb-6">
            <EmptyState icon={<UserIcon className="h-5 w-5" />} title={t("common.error")} description={error} />
          </div>
        ) : data ? (
          <div className="space-y-4 px-4 pb-6">
            {/* Basic info */}
            <div className="flex items-start gap-3 rounded-xl border border-border bg-gradient-to-br from-primary/5 to-accent/5 p-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary text-primary-foreground text-sm font-semibold shrink-0 ring-2 ring-accent/20">
                {data.student.name
                  .split(" ")
                  .map((w) => w[0])
                  .slice(0, 2)
                  .join("")
                  .toUpperCase()}
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-heading font-semibold text-foreground truncate">{data.student.name}</p>
                <p className="text-sm text-muted-foreground flex items-center gap-1.5 truncate">
                  <Mail className="h-3.5 w-3.5 shrink-0" /> {data.student.email}
                </p>
                {data.student.phone && (
                  <p className="text-sm text-muted-foreground flex items-center gap-1.5 mt-0.5">
                    <Phone className="h-3.5 w-3.5 shrink-0" /> {data.student.phone}
                  </p>
                )}
                <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1.5">
                  <Calendar className="h-3.5 w-3.5 shrink-0" /> {formatDate(data.student.createdAt)}
                </p>
              </div>
            </div>

            {/* Subscription */}
            <div className="rounded-xl border border-border bg-card p-4 space-y-3 shadow-sm">
              <div className="flex items-center justify-between">
                <h4 className="font-heading text-sm font-semibold text-foreground flex items-center gap-1.5">
                  <Shield className="h-4 w-4 text-accent" /> {t("subscription.mySubscription")}
                </h4>
                {data.subscription && (
                  data.subscription.status === "ACTIVE" ? (
                    <Badge className="bg-success/15 text-success">{t("common.active")}</Badge>
                  ) : (
                    <Badge className="bg-destructive/10 text-destructive">{t("common.expired")}</Badge>
                  )
                )}
              </div>
              {data.subscription ? (
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <p className="text-[11px] uppercase tracking-wider text-muted-foreground">{t("table.plan")}</p>
                    <p className="font-medium text-foreground mt-0.5">{data.subscription.planName}</p>
                  </div>
                  <div>
                    <p className="text-[11px] uppercase tracking-wider text-muted-foreground">{t("common.price")}</p>
                    <p className="font-medium text-foreground mt-0.5">
                      {data.subscription.planPrice.toLocaleString()} {data.subscription.planCurrency} /{" "}
                      {data.subscription.planDuration} {data.subscription.planDurationUnit.toLowerCase()}
                    </p>
                  </div>
                  <div>
                    <p className="text-[11px] uppercase tracking-wider text-muted-foreground">{t("table.start")}</p>
                    <p className="font-medium text-foreground mt-0.5">{formatDate(data.subscription.startDate)}</p>
                  </div>
                  <div>
                    <p className="text-[11px] uppercase tracking-wider text-muted-foreground">{t("table.expiry")}</p>
                    <p className="font-medium text-foreground mt-0.5">{formatDate(data.subscription.expiryDate)}</p>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">{t("subscription.accessExpired")}</p>
              )}

              <div className="border-t border-border pt-3 space-y-2">
                <Label htmlFor="assign-plan" className="text-[11px] uppercase tracking-wider text-muted-foreground">
                  {t("subscription.chooseNewPlan")}
                </Label>
                <div className="flex gap-2">
                  <Select value={assignPlanId} onValueChange={setAssignPlanId}>
                    <SelectTrigger id="assign-plan" className="h-9 rounded-lg flex-1">
                      <SelectValue placeholder={t("subscription.chooseNewPlan")} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="NONE">{t("common.optional")}</SelectItem>
                      {plans.map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button
                    size="sm"
                    className="h-9"
                    disabled={assigning || assignPlanId === "NONE"}
                    onClick={assignPlan}
                  >
                    {assigning ? t("common.saving") : t("common.create")}
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  {t("subscription.chooseNewPlan")}
                </p>
              </div>
            </div>

            {/* Stats row */}
            <div className="grid grid-cols-3 gap-2">
              <div className="rounded-xl border border-border bg-card p-3 text-center shadow-sm">
                <div className="mx-auto flex h-7 w-7 items-center justify-center rounded-md bg-accent/10 text-accent mb-1">
                  <BookOpen className="h-3.5 w-3.5" />
                </div>
                <p className="font-heading text-lg font-bold text-foreground">
                  {data.stats.accessibleCourseCount}
                </p>
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{t("common.courses")}</p>
              </div>
              <div className="rounded-xl border border-border bg-card p-3 text-center shadow-sm">
                <div className="mx-auto flex h-7 w-7 items-center justify-center rounded-md bg-warning/15 text-warning mb-1">
                  <ClipboardList className="h-3.5 w-3.5" />
                </div>
                <p className="font-heading text-lg font-bold text-foreground">
                  {data.stats.submissionsCount}
                </p>
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{t("common.submissions")}</p>
              </div>
              <div className="rounded-xl border border-border bg-card p-3 text-center shadow-sm">
                <div className="mx-auto flex h-7 w-7 items-center justify-center rounded-md bg-success/15 text-success mb-1">
                  <Award className="h-3.5 w-3.5" />
                </div>
                <p className="font-heading text-lg font-bold text-foreground">
                  {data.stats.certificatesCount}
                </p>
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{t("common.certificateManagement")}</p>
              </div>
            </div>

            {/* Accessible courses */}
            <div className="rounded-xl border border-border bg-card p-4 space-y-2 shadow-sm">
              <h4 className="font-heading text-sm font-semibold text-foreground flex items-center justify-between">
                <span>{t("common.courses")}</span>
                <span className="text-xs font-normal text-muted-foreground">{data.availableCourses.length} {t("common.all")}</span>
              </h4>
              {data.availableCourses.length === 0 ? (
                <p className="text-sm text-muted-foreground">{t("empty.noCourses")}</p>
              ) : (
                <ul className="space-y-1 max-h-48 overflow-y-auto scrollbar-thin">
                  {data.availableCourses.slice(0, 8).map((c) => (
                    <li key={c.id} className="flex items-center justify-between gap-2 text-sm py-1">
                      <span className="text-foreground truncate">{c.title}</span>
                      {c.accessible ? (
                        <Badge variant="outline" className="bg-success/15 text-success">{t("common.unlocked")}</Badge>
                      ) : (
                        <Badge variant="outline" className="text-muted-foreground">{t("common.locked")}</Badge>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {/* Submissions */}
            <div className="rounded-xl border border-border bg-card p-4 space-y-2 shadow-sm">
              <h4 className="font-heading text-sm font-semibold text-foreground">{t("dashboard.recentSubmissions")}</h4>
              {data.submissions.length === 0 ? (
                <p className="text-sm text-muted-foreground">{t("empty.noData")}</p>
              ) : (
                <ul className="space-y-1">
                  {data.submissions.slice(0, 5).map((s) => (
                    <li key={s.id} className="flex items-center justify-between gap-2 text-sm py-1">
                      <div className="min-w-0">
                        <p className="font-medium text-foreground truncate">{s.assignmentTitle}</p>
                        <p className="text-xs text-muted-foreground truncate">{s.courseTitle}</p>
                      </div>
                      <Badge variant="outline" className={
                        s.status === "PASSED" || s.status === "REVIEWED"
                          ? "bg-success/15 text-success border-success/30"
                          : s.status === "FAILED"
                            ? "bg-destructive/15 text-destructive border-destructive/30"
                            : "bg-warning/15 text-warning"
                      }>
                        {s.status === "PASSED" || s.status === "REVIEWED"
                          ? "Passed"
                          : s.status === "FAILED"
                            ? "Needs Revision"
                            : "Submitted"}
                      </Badge>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {/* Certificates */}
            <div className="rounded-xl border border-border bg-card p-4 space-y-2 shadow-sm">
              <h4 className="font-heading text-sm font-semibold text-foreground">{t("common.certificateManagement")}</h4>
              {data.certificates.length === 0 ? (
                <p className="text-sm text-muted-foreground">{t("certificates.noCertificates")}</p>
              ) : (
                <ul className="space-y-1">
                  {data.certificates.map((c) => (
                    <li key={c.id} className="flex items-center justify-between gap-2 text-sm py-1">
                      <div className="min-w-0">
                        <p className="font-medium text-foreground truncate">{c.courseTitle}</p>
                        <p className="text-xs text-muted-foreground truncate">{c.certificateNumber}</p>
                      </div>
                      <span className="text-xs text-muted-foreground">{formatDate(c.issuedAt)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}
