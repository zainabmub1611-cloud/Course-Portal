"use client";

import { useEffect } from "react";
import { useAppStore } from "@/stores/app-store";
import { PublicSite } from "@/components/public/public-site";
import { AdminDashboard } from "@/components/admin/admin-dashboard";
import { StudentDashboard } from "@/components/student/student-dashboard";
import { UniversityDashboard } from "@/components/university/university-dashboard";
import { FullPageLoader } from "@/components/shared/full-page-loader";

export default function Home() {
  const user = useAppStore((s) => s.user);
  const authLoading = useAppStore((s) => s.authLoading);
  const branding = useAppStore((s) => s.branding);
  const refreshUser = useAppStore((s) => s.refreshUser);
  const refreshBranding = useAppStore((s) => s.refreshBranding);
  const setHashFromWindow = useAppStore((s) => s.setHashFromWindow);

  // Initial auth + branding + hash setup
  useEffect(() => {
    refreshUser();
    refreshBranding();
    setHashFromWindow();
    const onHash = () => setHashFromWindow();
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, [refreshUser, refreshBranding, setHashFromWindow]);

  // Sync browser document title & favicon whenever app branding changes
  useEffect(() => {
    if (typeof document === "undefined") return;
    const appName = branding.appName || "CourseLearn";
    document.title = `${appName} — Professional Online Training Platform`;
    const iconHref = branding.logoUrl || "/logo.svg";
    let customLink = document.querySelector(
      'link[data-branding-favicon="true"]'
    ) as HTMLLinkElement | null;
    if (!customLink) {
      customLink = document.createElement("link");
      customLink.rel = "icon";
      customLink.setAttribute("data-branding-favicon", "true");
      document.head.appendChild(customLink);
    }
    if (customLink.getAttribute("href") !== iconHref) {
      customLink.href = iconHref;
    }
  }, [branding.appName, branding.logoUrl]);

  // Auto-initialize the platform (creates default admin/plans if empty)
  useEffect(() => {
    fetch("/api/public/init", { cache: "no-store" }).catch(() => {});
  }, []);

  // Whenever user logs in/out, force the route to a sensible default
  useEffect(() => {
    if (authLoading) return;
    const hash = window.location.hash.replace(/^#/, "");
    if (user?.role === "ADMIN") {
      if (!hash.startsWith("/admin")) {
        window.location.hash = "/admin";
      }
    } else if (user?.role === "UNIVERSITY" || user?.role === "INSTRUCTOR") {
      if (!hash.startsWith("/university")) {
        window.location.hash = "/university";
      }
    } else if (user?.role === "STUDENT") {
      if (
        hash.startsWith("/admin") ||
        hash.startsWith("/university") ||
        hash.startsWith("/login") ||
        hash.startsWith("/register")
      ) {
        window.location.hash = "/student";
      }
    } else {
      // Not logged in — redirect away from protected areas
      if (
        hash.startsWith("/admin") ||
        hash.startsWith("/student") ||
        hash.startsWith("/university")
      ) {
        window.location.hash = "/";
      }
    }
  }, [user, authLoading]);

  if (authLoading) {
    return <FullPageLoader key="loader" />;
  }

  if (user?.role === "ADMIN") {
    return <AdminDashboard key="admin" />;
  }

  if (user?.role === "UNIVERSITY" || user?.role === "INSTRUCTOR") {
    return <UniversityDashboard key="university" />;
  }

  if (user?.role === "STUDENT") {
    return <StudentDashboard key="student" />;
  }

  return <PublicSite key="public" />;
}
