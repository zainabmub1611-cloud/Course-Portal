"use client";

import { Mail, Phone, MapPin, GraduationCap } from "lucide-react";
import { BrandLogo } from "@/components/shared/brand-logo";
import { useAppStore } from "@/stores/app-store";
import { useI18n } from "@/lib/i18n/store";

export function PublicFooter() {
  const { t } = useI18n();
  const navigate = useAppStore((s) => s.navigate);
  const branding = useAppStore((s) => s.branding);

  return (
    <footer className="mt-auto bg-card border-t border-border">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-10 sm:py-14">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8 sm:gap-10">
          {/* Brand column */}
          <div className="space-y-4 lg:col-span-1">
            <BrandLogo onClick={() => navigate([""])} />
            <p className="text-sm leading-relaxed text-muted-foreground max-w-xs">
              {t("footer.platformDesc")}
            </p>
          </div>

          {/* Navigation */}
          <div className="space-y-4">
            <h4 className="font-heading text-sm font-semibold tracking-tight text-foreground">
              {t("footer.navigation")}
            </h4>
            <ul className="space-y-3 text-sm">
              {[
                { labelKey: "nav.home", segments: [""] },
                { labelKey: "nav.courses", segments: ["courses"] },
                { labelKey: "nav.learningPlans", segments: ["plans"] },
                { labelKey: "nav.about", segments: ["about"] },
                { labelKey: "common.login", segments: ["login"] },
              ].map((item) => (
                <li key={item.labelKey}>
                  <button
                    onClick={() => navigate(item.segments)}
                    className="text-muted-foreground transition-colors duration-200 hover:text-primary"
                  >
                    {t(item.labelKey as any)}
                  </button>
                </li>
              ))}
            </ul>
          </div>

          {/* Popular courses */}
          <div className="space-y-4">
            <h4 className="font-heading text-sm font-semibold tracking-tight text-foreground">
              {t("public.popularCourses")}
            </h4>
            <ul className="space-y-3 text-sm">
              {["Graphic Designing", "Digital Marketing", "Web Development", "Business Analytics"].map(
                (label) => (
                  <li key={label}>
                    <button
                      onClick={() => navigate(["courses"])}
                      className="text-muted-foreground transition-colors duration-200 hover:text-primary"
                    >
                      {label}
                    </button>
                  </li>
                )
              )}
            </ul>
          </div>

          {/* Contact */}
          <div className="space-y-4">
            <h4 className="font-heading text-sm font-semibold tracking-tight text-foreground">
              {t("footer.getInTouch")}
            </h4>
            <ul className="space-y-3 text-sm">
              <li className="flex items-start gap-3">
                <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-soft-sage text-accent">
                  <Mail className="h-3.5 w-3.5" />
                </span>
                <span className="text-muted-foreground">hello@courselearn.dev</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-soft-sage text-accent">
                  <Phone className="h-3.5 w-3.5" />
                </span>
                <span className="text-muted-foreground">+968 9000 0000</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-soft-sage text-accent">
                  <MapPin className="h-3.5 w-3.5" />
                </span>
                <span className="text-muted-foreground">Muscat, Sultanate of Oman</span>
              </li>
            </ul>
          </div>
        </div>

        {/* Copyright bar */}
        <div className="mt-12 flex flex-col items-center justify-between gap-3 border-t border-border pt-6 text-xs text-muted-foreground sm:flex-row">
          <p>© {new Date().getFullYear()} {branding.appName || "CourseLearn"}. {t("public.allRightsReserved")}.</p>
          <div className="flex items-center gap-1.5">
            <GraduationCap className="h-3.5 w-3.5 text-accent" />
            <span>{t("footer.professionalTraining")}</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
