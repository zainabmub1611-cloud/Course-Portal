"use client";

import { useAppStore } from "@/stores/app-store";
import { PublicNavbar } from "./public-navbar";
import { PublicFooter } from "./public-footer";
import { HomePage } from "./home-page";
import { CoursesPage } from "./courses-page";
import { PlansPage } from "./plans-page";
import { AboutPage } from "./about-page";
import { LoginPage } from "./login-page";
import { UniversityProfilePage } from "./university-profile-page";
import { NotFoundPage } from "./not-found-page";
import { FullPageLoader } from "@/components/shared/full-page-loader";
import { useEffect } from "react";

/**
 * Reserved sub-route names used by the authenticated University Dashboard
 * (e.g. /#/university/overview, /#/university/courses). When an
 * unauthenticated visitor lands on any of these we redirect them home —
 * they are not allowed to view the protected dashboard surfaces.
 *
 * Anything else under /#/university/<something> is treated as a public
 * university ID and rendered via <UniversityProfilePage />.
 */
const UNIVERSITY_DASHBOARD_SECTIONS = new Set([
  "overview",
  "courses",
  "materials",
  "assignments",
  "submissions",
  "certificates",
  "settings",
  "revenue",
]);

export function PublicSite() {
  const segments = useAppStore((s) => s.segments);
  const navigate = useAppStore((s) => s.navigate);

  const first = segments[0] || "";
  const second = segments[1] || "";

  // Is this a /#/university/<dashboard-section> URL that should be guarded?
  const isProtectedUniversityRoute =
    first === "university" &&
    (!second || UNIVERSITY_DASHBOARD_SECTIONS.has(second));

  // If someone lands on /admin or /student while not authenticated (or while
  // auth is still resolving), don't show "Page not found". Instead:
  //  - If we know the user is null, redirect to home immediately.
  //  - If auth is still loading, show the full-page loader.
  // The page.tsx effect also handles this, but doing it here prevents the
  // NotFoundPage flash that happens between authLoading flipping to false
  // and the redirect effect running.
  useEffect(() => {
    if (
      first === "admin" ||
      first === "student" ||
      isProtectedUniversityRoute
    ) {
      // user is null here (otherwise the dashboard would render)
      navigate([""]);
    }
  }, [first, isProtectedUniversityRoute, navigate]);

  if (first === "admin" || first === "student" || isProtectedUniversityRoute) {
    // Show loader while the redirect above takes effect
    return <FullPageLoader />;
  }

  // Auth pages get the unified animated Sign In / Sign Up panel (no navbar/footer)
  if (first === "login") {
    return <LoginPage initialMode="signin" />;
  }
  if (first === "register") {
    return <LoginPage initialMode="signup" />;
  }

  // University public profile — /#/university/:id
  // Renders only when <id> is NOT one of the reserved dashboard section names
  // (those are guarded above).
  if (first === "university" && second && !UNIVERSITY_DASHBOARD_SECTIONS.has(second)) {
    return (
      <div className="min-h-screen flex flex-col bg-background overflow-x-hidden">
        <PublicNavbar />
        <main className="flex-1 overflow-x-hidden">
          <UniversityProfilePage universityId={second} />
        </main>
        <PublicFooter />
      </div>
    );
  }

  let page: React.ReactNode;
  switch (first) {
    case "":
    case "home":
      page = <HomePage />;
      break;
    case "courses":
      page = <CoursesPage />;
      break;
    case "plans":
      page = <PlansPage />;
      break;
    case "about":
      page = <AboutPage />;
      break;
    default:
      page = <NotFoundPage onHome={() => navigate([""])} />;
  }

  return (
    <div className="min-h-screen flex flex-col bg-background overflow-x-hidden">
      <PublicNavbar />
      <main className="flex-1 overflow-x-hidden">{page}</main>
      <PublicFooter />
    </div>
  );
}
