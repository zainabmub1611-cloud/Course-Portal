"use client";

import { useAppStore } from "@/stores/app-store";
import { AdminSidebar } from "./admin-sidebar";
import { AdminTopbar } from "./admin-topbar";
import { AdminOverview } from "./admin-overview";
import { AdminStudents } from "./admin-students";
import { AdminCourses } from "./admin-courses";
import { AdminCourseEditor } from "./admin-course-editor";
import { AdminMaterials } from "./admin-materials";
import { AdminAssignments } from "./admin-assignments";
import { AdminSubmissions } from "./admin-submissions";
import { AdminPlans } from "./admin-plans";
import { AdminCertificates } from "./admin-certificates";
import { AdminSettings } from "./admin-settings";
import { AdminUniversities } from "./admin-universities";
import { AdminUniversityDetail } from "./admin-university-detail";
import { cn } from "@/lib/utils";
import { useState } from "react";

export function AdminDashboard() {
  const segments = useAppStore((s) => s.segments);
  const navigate = useAppStore((s) => s.navigate);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const section = segments[1] || "overview";

  // If route is /admin/courses/:id → course editor
  // If route is /admin/universities/:id → university detail page
  let content: React.ReactNode;
  if (section === "courses" && segments[2]) {
    content = (
      <AdminCourseEditor
        courseId={segments[2]}
        onBack={() => navigate(["admin", "courses"])}
      />
    );
  } else if (section === "universities" && segments[2]) {
    content = (
      <AdminUniversityDetail
        universityId={segments[2]}
        onBack={() => navigate(["admin", "universities"])}
      />
    );
  } else {
    switch (section) {
      case "overview":
        content = <AdminOverview />;
        break;
      case "universities":
        content = <AdminUniversities />;
        break;
      case "students":
        content = <AdminStudents />;
        break;
      case "courses":
        content = <AdminCourses />;
        break;
      case "materials":
        content = <AdminMaterials />;
        break;
      case "assignments":
        content = <AdminAssignments />;
        break;
      case "submissions":
        content = <AdminSubmissions />;
        break;
      case "plans":
        content = <AdminPlans />;
        break;
      case "certificates":
        content = <AdminCertificates />;
        break;
      case "settings":
        content = <AdminSettings />;
        break;
      default:
        content = <AdminOverview />;
    }
  }

  return (
    <div className="min-h-screen bg-background overflow-x-hidden">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}
      <div
        data-open={sidebarOpen ? "true" : "false"}
        className={cn(
          "portal-drawer fixed inset-y-0 left-0 z-50 w-64 transform transition-transform lg:translate-x-0",
          sidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        )}
      >
        <AdminSidebar onNavigate={() => setSidebarOpen(false)} />
      </div>

      <div className="lg:pl-64">
        <AdminTopbar onToggleSidebar={() => setSidebarOpen((v) => !v)} />
        <main className="p-3 sm:p-4 md:p-6 lg:p-8 animate-page-in" key={section}>{content}</main>
      </div>
    </div>
  );
}
