"use client";

import { Button } from "@/components/ui/button";
import { Compass, ArrowRight, Home } from "lucide-react";
import { useI18n } from "@/lib/i18n/store";

export function NotFoundPage({ onHome }: { onHome: () => void }) {
  const { t } = useI18n();
  return (
    <div className="relative min-h-[70vh] overflow-hidden bg-soft-sage/30">
      <div
        className="pointer-events-none absolute inset-0 -z-10 opacity-90"
        style={{
          background:
            "radial-gradient(circle at 30% 30%, rgba(120,151,134,0.16), transparent 50%), radial-gradient(circle at 70% 70%, rgba(52,79,66,0.06), transparent 50%)",
        }}
      />
      <div className="mx-auto flex max-w-xl flex-col items-center justify-center px-4 py-20 text-center">
        <div className="relative mb-6">
          <span className="font-heading text-[120px] font-bold leading-none tracking-tight text-soft-sage">
            404
          </span>
          <div className="absolute left-1/2 top-1/2 flex h-14 w-14 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-lg border border-border bg-card text-accent shadow-sm">
            <Compass className="h-7 w-7" />
          </div>
        </div>
        <h1 className="font-heading text-2xl font-semibold tracking-tight text-foreground md:text-[28px]">
          {t("notfound.pageNotFound")}
        </h1>
        <p className="mt-2 max-w-md text-sm text-muted-foreground">
          {t("notfound.desc")}
        </p>
        <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
          <Button
            onClick={onHome}
            className="h-10 gap-2 px-5 bg-primary text-primary-foreground hover:bg-primary/90"
          >
            <Home className="h-4 w-4" /> {t("auth.backToHome")}
          </Button>
          <Button
            variant="outline"
            onClick={onHome}
            className="h-10 gap-2 px-5 border-border bg-card hover:bg-soft-sage"
          >
            {t("notfound.browseCourses")}
            <ArrowRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
