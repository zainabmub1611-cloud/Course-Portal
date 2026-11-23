"use client";

import { useEffect, useState } from "react";
// (useEffect retained for form sync in PlanFormDialog)
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
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
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { EmptyState } from "@/components/shared/empty-state";
import { useApiFetch, apiPost } from "@/hooks/use-api";
import { useAppStore } from "@/stores/app-store";
import { useI18n } from "@/lib/i18n/store";
import { toast } from "@/hooks/use-toast";
import { formatDate, formatPrice, durationUnitLabel, type SubscriptionPlanPublic } from "@/types";
import {
  CreditCard, Plus, MoreHorizontal, Pencil, Trash2, Star, Plus as PlusIcon,
  X, Check,
} from "lucide-react";

interface PlansResponse { plans: SubscriptionPlanPublic[] }

export function AdminPlans() {
  const { t } = useI18n();
  const query = useAppStore((s) => s.query);
  const { data, loading, error, refetch } = useApiFetch<PlansResponse>("/api/admin/plans");
  const [addOpen, setAddOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<SubscriptionPlanPublic | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<SubscriptionPlanPublic | null>(null);

  // Auto-open Add dialog when query.action=new — React 19 "store previous value" pattern
  const [lastAction, setLastAction] = useState<string | undefined>(undefined);
  if (query.action !== lastAction) {
    setLastAction(query.action);
    if (query.action === "new") setAddOpen(true);
  }

  async function toggleActive(plan: SubscriptionPlanPublic) {
    try {
      await apiPost(`/api/admin/plans/${plan.id}/activate`, { isActive: !plan.isActive }, { method: "PATCH" });
      toast({
        title: plan.isActive ? t("common.cancel") : t("common.active"),
        description: plan.name,
      });
      refetch();
    } catch { /* toast */ }
  }

  const plans = data?.plans || [];

  return (
    <div className="space-y-4">
      <Card className="border-border bg-gradient-to-br from-card via-card to-soft-sage/40 p-5 shadow-sm">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="font-heading text-lg font-semibold text-foreground">{t("common.subscriptionPlans")}</h2>
            <p className="text-sm text-muted-foreground mt-0.5">{t("common.subscriptionPlans")}</p>
          </div>
          <Button className="h-9 gap-2" onClick={() => setAddOpen(true)}>
            <Plus className="h-4 w-4" /> {t("dashboard.createPlan")}
          </Button>
        </div>
      </Card>

      <Card className="border-border bg-card p-0 shadow-sm overflow-hidden">
        {loading ? (
          <div className="space-y-2 p-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-14 w-full" />
            ))}
          </div>
        ) : error ? (
          <EmptyState className="m-4" icon={<CreditCard className="h-5 w-5" />} title={t("common.error")} description={error} />
        ) : plans.length === 0 ? (
          <EmptyState
            className="m-4"
            icon={<CreditCard className="h-5 w-5" />}
            title={t("common.subscriptionPlans")}
            description={t("common.subscriptionPlans")}
            action={<Button onClick={() => setAddOpen(true)} className="gap-2"><Plus className="h-4 w-4" /> {t("dashboard.createPlan")}</Button>}
          />
        ) : (
          <div className="overflow-x-auto scrollbar-thin">
<Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{t("table.plan")}</TableHead>
                <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{t("common.price")}</TableHead>
                <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{t("common.duration")}</TableHead>
                <TableHead className="hidden text-center text-xs font-semibold uppercase tracking-wider text-muted-foreground md:table-cell">{t("common.features")}</TableHead>
                <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{t("common.status")}</TableHead>
                <TableHead className="hidden text-xs font-semibold uppercase tracking-wider text-muted-foreground md:table-cell">{t("common.date")}</TableHead>
                <TableHead className="text-right text-xs font-semibold uppercase tracking-wider text-muted-foreground">{t("table.actions")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {plans.map((p) => (
                <TableRow key={p.id} className="hover:bg-muted/40">
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-foreground">{p.name}</p>
                      {p.isPopular && (
                        <Badge className="bg-accent text-accent-foreground gap-1">
                          <Star className="h-3 w-3 fill-current" /> {t("common.popularPlan")}
                        </Badge>
                      )}
                    </div>
                    {p.description && (
                      <p className="text-xs text-muted-foreground line-clamp-1 max-w-[260px] mt-0.5">{p.description}</p>
                    )}
                  </TableCell>
                  <TableCell>
                    <span className="font-heading font-semibold text-foreground">
                      {formatPrice(p.price, p.currency)}
                    </span>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {p.duration} {durationUnitLabel(p.durationUnit).toLowerCase()}
                  </TableCell>
                  <TableCell className="hidden text-center text-sm text-foreground md:table-cell">
                    <Badge variant="outline" className="bg-muted/40 text-muted-foreground">{p.features.length}</Badge>
                  </TableCell>
                  <TableCell>
                    {p.isActive ? (
                      <Badge className="bg-success/15 text-success">{t("common.active")}</Badge>
                    ) : (
                      <Badge variant="outline" className="text-muted-foreground">{t("common.expired")}</Badge>
                    )}
                  </TableCell>
                  <TableCell className="hidden text-sm text-muted-foreground md:table-cell">
                    {formatDate(p.createdAt)}
                  </TableCell>
                  <TableCell className="text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" aria-label={`Actions for ${p.name}`} className="text-muted-foreground hover:text-foreground hover:bg-muted">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-48">
                        <DropdownMenuItem onClick={() => { setEditTarget(p); setAddOpen(true); }} className="gap-2">
                          <Pencil className="h-4 w-4 text-muted-foreground" /> {t("common.edit")}
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => toggleActive(p)} className="gap-2">
                          {p.isActive ? t("common.cancel") : t("common.active")}
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem variant="destructive" onClick={() => setDeleteTarget(p)} className="gap-2">
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
        )}
      </Card>

      <PlanFormDialog
        open={addOpen}
        onOpenChange={setAddOpen}
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
                  await apiPost(`/api/admin/plans/${deleteTarget.id}`, null, { method: "DELETE" });
                  toast({ title: t("common.success"), description: deleteTarget.name });
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

interface PlanFormValues {
  name: string;
  description: string;
  price: string;
  currency: string;
  duration: string;
  durationUnit: "DAYS" | "WEEKS" | "MONTHS" | "YEARS";
  features: string[];
  benefits: string[];
  isActive: boolean;
  isPopular: boolean;
}

const EMPTY_VALUES: PlanFormValues = {
  name: "",
  description: "",
  price: "0",
  currency: "OMR",
  duration: "1",
  durationUnit: "MONTHS",
  features: [""],
  benefits: [""],
  isActive: true,
  isPopular: false,
};

function PlanFormDialog({
  open, onOpenChange, target, onSaved,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  target: SubscriptionPlanPublic | null;
  onSaved: () => void;
}) {
  const { t } = useI18n();
  const [values, setValues] = useState<PlanFormValues>(EMPTY_VALUES);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (target) {
      setValues({
        name: target.name,
        description: target.description || "",
        price: String(target.price),
        currency: target.currency,
        duration: String(target.duration),
        durationUnit: target.durationUnit,
        features: target.features.length ? target.features : [""],
        benefits: target.benefits.length ? target.benefits : [""],
        isActive: target.isActive,
        isPopular: target.isPopular,
      });
    } else if (open) {
      setValues(EMPTY_VALUES);
    }
  }, [target, open]);

  function setFeature(i: number, val: string) {
    setValues((v) => {
      const next = [...v.features];
      next[i] = val;
      return { ...v, features: next };
    });
  }
  function addFeature() {
    setValues((v) => ({ ...v, features: [...v.features, ""] }));
  }
  function removeFeature(i: number) {
    setValues((v) => ({ ...v, features: v.features.filter((_, idx) => idx !== i) }));
  }
  function setBenefit(i: number, val: string) {
    setValues((v) => {
      const next = [...v.benefits];
      next[i] = val;
      return { ...v, benefits: next };
    });
  }
  function addBenefit() {
    setValues((v) => ({ ...v, benefits: [...v.benefits, ""] }));
  }
  function removeBenefit(i: number) {
    setValues((v) => ({ ...v, benefits: v.benefits.filter((_, idx) => idx !== i) }));
  }

  async function submit() {
    if (!values.name.trim()) {
      toast({ title: t("common.name") + " " + t("common.required"), variant: "destructive" });
      return;
    }
    const priceNum = parseFloat(values.price);
    if (Number.isNaN(priceNum) || priceNum < 0) {
      toast({ title: t("common.price"), variant: "destructive" });
      return;
    }
    const durationNum = parseInt(values.duration, 10);
    if (Number.isNaN(durationNum) || durationNum < 1) {
      toast({ title: t("common.duration"), variant: "destructive" });
      return;
    }

    const cleanedFeatures = values.features.map((f) => f.trim()).filter(Boolean);
    const cleanedBenefits = values.benefits.map((b) => b.trim()).filter(Boolean);

    setSaving(true);
    try {
      const payload = {
        name: values.name.trim(),
        description: values.description.trim() || null,
        price: priceNum,
        currency: values.currency,
        duration: durationNum,
        durationUnit: values.durationUnit,
        features: cleanedFeatures,
        benefits: cleanedBenefits,
        isActive: values.isActive,
        isPopular: values.isPopular,
      };
      if (target) {
        await apiPost(`/api/admin/plans/${target.id}`, payload, { method: "PUT" });
        toast({ title: t("common.success") });
      } else {
        await apiPost("/api/admin/plans", payload);
        toast({ title: t("common.success") });
      }
      onSaved();
    } catch { /* toast */ } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="animate-scale-in w-[95vw] max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-heading text-lg font-semibold">{target ? t("common.edit") : t("dashboard.createPlan")}</DialogTitle>
          <DialogDescription>{t("dashboard.createPlan")}</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 max-h-[65vh] overflow-y-auto pr-1 scrollbar-thin">
          {/* Info section */}
          <div className="space-y-3">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{t("subscription.planName")}</p>
            <div className="space-y-1.5">
              <Label htmlFor="p-name" className="text-xs font-medium text-muted-foreground">{t("subscription.planName")}</Label>
              <Input id="p-name" value={values.name} onChange={(e) => setValues({ ...values, name: e.target.value })} placeholder={t("subscription.planName")} className="h-9 rounded-lg" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="p-desc" className="text-xs font-medium text-muted-foreground">{t("common.description")} ({t("common.optional")})</Label>
              <Textarea id="p-desc" value={values.description} onChange={(e) => setValues({ ...values, description: e.target.value })} rows={2} className="rounded-lg" />
            </div>
          </div>
          <Separator />
          {/* Pricing & Duration section */}
          <div className="space-y-3">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{t("common.price")} & {t("common.duration")}</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="p-price" className="text-xs font-medium text-muted-foreground">{t("common.price")}</Label>
                <Input id="p-price" type="number" min="0" step="0.01" value={values.price} onChange={(e) => setValues({ ...values, price: e.target.value })} className="h-9 rounded-lg" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="p-cur" className="text-xs font-medium text-muted-foreground">{t("common.currency")}</Label>
                <Input id="p-cur" value={values.currency} onChange={(e) => setValues({ ...values, currency: e.target.value })} maxLength={5} className="h-9 rounded-lg" />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="p-dur" className="text-xs font-medium text-muted-foreground">{t("common.duration")}</Label>
                <Input id="p-dur" type="number" min="1" value={values.duration} onChange={(e) => setValues({ ...values, duration: e.target.value })} className="h-9 rounded-lg" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-muted-foreground">{t("common.duration")}</Label>
                <Select value={values.durationUnit} onValueChange={(v) => setValues({ ...values, durationUnit: v as "DAYS" | "WEEKS" | "MONTHS" | "YEARS" })}>
                  <SelectTrigger className="w-full h-9 rounded-lg">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="DAYS">{t("common.duration")}</SelectItem>
                    <SelectItem value="WEEKS">{t("common.duration")}</SelectItem>
                    <SelectItem value="MONTHS">{t("common.duration")}</SelectItem>
                    <SelectItem value="YEARS">{t("common.duration")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <Separator />
          {/* Features list */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{t("common.features")}</p>
              <Button variant="ghost" size="sm" className="h-7 gap-1 text-accent" onClick={addFeature}>
                <PlusIcon className="h-3 w-3" /> {t("common.add")}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground -mt-1">{t("common.features")}</p>
            <div className="space-y-2">
              {values.features.map((f, i) => (
                <div key={i} className="flex items-center gap-2 rounded-md border border-border bg-background p-1.5 pl-2.5 transition-colors focus-within:border-accent/30">
                  <Check className="h-3.5 w-3.5 text-accent shrink-0" />
                  <Input
                    value={f}
                    onChange={(e) => setFeature(i, e.target.value)}
                    placeholder={t("common.features")}
                    className="h-8 rounded-md border-0 focus-visible:ring-0"
                  />
                  <Button variant="ghost" size="icon" aria-label={t("common.delete")} onClick={() => removeFeature(i)} className="h-7 w-7 text-muted-foreground hover:text-destructive">
                    <X className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ))}
              {values.features.length === 0 && (
                <p className="text-xs text-muted-foreground">{t("common.noData")}</p>
              )}
            </div>
          </div>
          {/* Benefits list */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{t("common.benefits")}</p>
              <Button variant="ghost" size="sm" className="h-7 gap-1 text-accent" onClick={addBenefit}>
                <PlusIcon className="h-3 w-3" /> {t("common.add")}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground -mt-1">{t("common.benefits")}</p>
            <div className="space-y-2">
              {values.benefits.map((b, i) => (
                <div key={i} className="flex items-center gap-2 rounded-md border border-border bg-background p-1.5 pl-2.5 transition-colors focus-within:border-accent/30">
                  <Star className="h-3.5 w-3.5 text-accent shrink-0" />
                  <Input
                    value={b}
                    onChange={(e) => setBenefit(i, e.target.value)}
                    placeholder={t("common.benefits")}
                    className="h-8 rounded-md border-0 focus-visible:ring-0"
                  />
                  <Button variant="ghost" size="icon" aria-label={t("common.delete")} onClick={() => removeBenefit(i)} className="h-7 w-7 text-muted-foreground hover:text-destructive">
                    <X className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ))}
              {values.benefits.length === 0 && (
                <p className="text-xs text-muted-foreground">{t("common.noData")}</p>
              )}
            </div>
          </div>
          <Separator />
          {/* Status toggles */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="flex items-center justify-between rounded-lg border border-border p-3">
              <Label htmlFor="p-active" className="text-sm font-medium">{t("common.active")}</Label>
              <Switch id="p-active" checked={values.isActive} onCheckedChange={(v) => setValues({ ...values, isActive: v })} />
            </div>
            <div className="flex items-center justify-between rounded-lg border border-border p-3">
              <Label htmlFor="p-popular" className="text-sm font-medium">{t("common.popularPlan")}</Label>
              <Switch id="p-popular" checked={values.isPopular} onCheckedChange={(v) => setValues({ ...values, isPopular: v })} />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" className="h-9" onClick={() => onOpenChange(false)}>{t("common.cancel")}</Button>
          <Button disabled={saving} className="h-9" onClick={submit}>
            {saving ? t("common.saving") : target ? t("profile.saveChanges") : t("dashboard.createPlan")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
