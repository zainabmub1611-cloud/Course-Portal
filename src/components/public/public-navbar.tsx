"use client";

import { useState, useEffect } from "react";
import { Menu, X, LogIn, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { LanguageSwitcher } from "@/components/shared/language-switcher";
import { BrandLogo } from "@/components/shared/brand-logo";
import { useAppStore } from "@/stores/app-store";
import { useI18n } from "@/lib/i18n/store";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  { labelKey: "nav.home", segments: [""] },
  { labelKey: "nav.courses", segments: ["courses"] },
  { labelKey: "nav.learningPlans", segments: ["plans"] },
  { labelKey: "nav.about", segments: ["about"] },
];

export function PublicNavbar() {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const navigate = useAppStore((s) => s.navigate);
  const segments = useAppStore((s) => s.segments);
  const current = segments[0] || "";

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className={cn(
        "sticky top-0 z-40 w-full transition-all duration-200 bg-card border-b border-border",
        scrolled && "shadow-sm"
      )}
    >
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-3 sm:px-4 md:px-6 lg:px-8 gap-3">
        <BrandLogo onClick={() => navigate([""])} />

        <nav className="hidden md:flex items-center gap-6">
          {NAV_ITEMS.map((item) => {
            const active = current === item.segments[0];
            return (
              <button
                key={item.labelKey}
                onClick={() => navigate(item.segments)}
                className={cn(
                  "relative py-2 text-sm whitespace-nowrap shrink-0 transition-colors duration-150",
                  active
                    ? "text-primary font-semibold"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                {t(item.labelKey as any)}
                {active && (
                  <span className="absolute inset-x-0 -bottom-[1px] h-0.5 rounded-full bg-primary" />
                )}
              </button>
            );
          })}
          <a
            href="mailto:hello@courselearn.dev"
            className="relative py-2 text-sm whitespace-nowrap shrink-0 text-muted-foreground transition-colors duration-150 hover:text-foreground"
          >
            {t("nav.contact")}
          </a>
        </nav>

        <div className="hidden md:flex items-center gap-2.5 shrink-0">
          <LanguageSwitcher />
          <Button
            variant="ghost"
            onClick={() => navigate(["login"])}
            className="gap-2 h-9 px-3.5 text-foreground hover:bg-soft-sage/60 whitespace-nowrap shrink-0"
          >
            <LogIn className="h-4 w-4" />
            {t("common.login")}
          </Button>
          <Button
            onClick={() => navigate(["register"])}
            className="gap-2 h-9 px-4 bg-primary text-primary-foreground hover:bg-primary/90 whitespace-nowrap shrink-0"
          >
            {t("common.getStarted")}
            <ArrowRight className="h-4 w-4 rtl-mirror" />
          </Button>
        </div>

        <div className="flex items-center gap-1.5 md:hidden shrink-0">
          <LanguageSwitcher />
          <button
            className="inline-flex h-11 w-11 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-soft-sage hover:text-foreground"
            onClick={() => setOpen((v) => !v)}
            aria-label={t("footer.toggleMenu")}
            aria-expanded={open}
          >
            {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      <div
        className={cn(
          "md:hidden overflow-hidden border-t border-border bg-card transition-all duration-200 ease-out",
          open ? "max-h-[520px] opacity-100" : "max-h-0 opacity-0 border-transparent"
        )}
      >
        <div className="flex flex-col gap-1 px-4 py-4">
          {NAV_ITEMS.map((item) => {
            const active = current === item.segments[0];
            return (
              <button
                key={item.labelKey}
                onClick={() => {
                  navigate(item.segments);
                  setOpen(false);
                }}
                className={cn(
                  "min-h-[44px] rounded-lg px-3.5 py-2.5 text-start text-sm transition-all duration-200",
                  active
                    ? "text-primary font-semibold bg-soft-sage"
                    : "text-muted-foreground hover:text-foreground hover:bg-soft-sage/60"
                )}
              >
                {t(item.labelKey as any)}
              </button>
            );
          })}
          <a
            href="mailto:hello@courselearn.dev"
            className="min-h-[44px] flex items-center rounded-lg px-3.5 py-2.5 text-start text-sm text-muted-foreground transition-all duration-200 hover:text-foreground hover:bg-soft-sage/60"
            onClick={() => setOpen(false)}
          >
            {t("nav.contact")}
          </a>
          <div className="mt-3 grid grid-cols-2 gap-2.5 border-t border-border pt-4">
            <Button
              variant="outline"
              onClick={() => { navigate(["login"]); setOpen(false); }}
              className="gap-2 h-11 border-border bg-card"
            >
              <LogIn className="h-4 w-4" /> {t("common.login")}
            </Button>
            <Button
              onClick={() => { navigate(["register"]); setOpen(false); }}
              className="gap-2 h-11 bg-primary text-primary-foreground"
            >
              {t("common.getStarted")}
              <ArrowRight className="h-4 w-4 rtl-mirror" />
            </Button>
          </div>
        </div>
      </div>
    </header>
  );
}
