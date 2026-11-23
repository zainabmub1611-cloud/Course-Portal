import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireUniversity, handleAuthError, errorResponse } from "@/lib/auth";

/**
 * GET /api/university/revenue
 *
 * Returns revenue statistics for the logged-in university, derived from
 * Subscription records of students who have learning progress in this
 * university's courses.
 *
 * Output shape:
 *   {
 *     hasPaymentData: boolean,
 *     totalSales: number,            // count of paying subscriptions
 *     grossRevenue: number,          // sum of planPrice across paying subs
 *     paidEnrollments: number,       // (student, paid-course) progress pairs
 *     freeEnrollments: number,       // (student, free-course) progress pairs
 *     currency: string,
 *     courseRevenue: [
 *       { courseId, title, accessType, price, enrollments, grossSales }
 *     ],
 *     monthlyTrend: [ { month, revenue } ]   // last 6 months
 *   }
 *
 * When no payment data exists (no Subscription has touched a paid course
 * offered by this university), `hasPaymentData` is `false` and the numeric
 * fields are zeroed — the UI shows a "configure payments" placeholder.
 */
export async function GET() {
  try {
    const user = await requireUniversity();
    const universityId = user.universityId!;

    // ─── 1. Fetch the university's published courses ───
    const courses = await db.course.findMany({
      where: { universityId, isPublished: true },
      select: {
        id: true,
        title: true,
        accessType: true,
        createdAt: true,
      },
    });
    const courseIds = courses.map((c) => c.id);

    // No published courses → no revenue possible
    if (courseIds.length === 0) {
      return NextResponse.json(emptyRevenue());
    }

    // ─── 2. Find all students with progress in any of these courses ───
    const progressRows = await db.videoProgress.findMany({
      where: { video: { courseId: { in: courseIds } } },
      select: {
        studentId: true,
        video: { select: { courseId: true, course: { select: { accessType: true } } } },
        updatedAt: true,
      },
      distinct: ["studentId", "videoId"],
    });

    // Build: per student → set of courses they have progress in (and access type)
    const studentToCourses = new Map<string, Set<{ courseId: string; accessType: string }>>();
    for (const p of progressRows) {
      const entry = { courseId: p.video.courseId, accessType: p.video.course.accessType };
      const set = studentToCourses.get(p.studentId) ?? new Set();
      // Sets in JS use reference equality for objects; we dedupe manually below.
      set.add(entry);
      studentToCourses.set(p.studentId, set);
    }
    // Convert Sets of objects into arrays of unique courseIds per student.
    const studentCourseMap = new Map<string, Map<string, string>>(); // student -> (courseId -> accessType)
    for (const [studentId, set] of studentToCourses) {
      const inner = new Map<string, string>();
      for (const e of Array.from(set)) {
        inner.set(e.courseId, e.accessType);
      }
      studentCourseMap.set(studentId, inner);
    }

    const activeStudentIds = Array.from(studentCourseMap.keys());

    // ─── 3. Pull every subscription those students have ever held ───
    // We consider a subscription "revenue" for this university only if it
    // actually unlocks at least one of the university's PAID courses that
    // the student has made progress in.
    const subscriptions = activeStudentIds.length
      ? await db.subscription.findMany({
          where: { studentId: { in: activeStudentIds } },
          select: {
            id: true,
            studentId: true,
            planId: true,
            planPrice: true,
            planCurrency: true,
            startDate: true,
            status: true,
          },
          orderBy: { startDate: "desc" },
        })
      : [];

    // Map planId → set of courseIds covered (via CoursePlanAccess) — precomputed
    const planToCourses = new Map<string, Set<string>>();
    if (subscriptions.length) {
      const planIds = Array.from(new Set(subscriptions.map((s) => s.planId)));
      const accessRows = await db.coursePlanAccess.findMany({
        where: { planId: { in: planIds }, courseId: { in: courseIds } },
        select: { planId: true, courseId: true },
      });
      for (const r of accessRows) {
        const set = planToCourses.get(r.planId) ?? new Set<string>();
        set.add(r.courseId);
        planToCourses.set(r.planId, set);
      }
    }

    // ─── 4. Determine paying subscriptions: a subscription counts toward
    //         revenue if its plan unlocks ≥1 PAID university course the
    //         student has actually made progress in. ───
    const paidCourseIds = new Set(
      courses.filter((c) => c.accessType === "PAID").map((c) => c.id)
    );
    const freeCourseIds = new Set(
      courses.filter((c) => c.accessType === "FREE").map((c) => c.id)
    );

    // Collect the distinct paying subscription ids + their planPrices
    const payingSubIds = new Set<string>();
    // currency assumed to be uniform per university; default to first found
    let currency = "OMR";
    const grossRevenueByCurrency: Record<string, number> = {};

    for (const sub of subscriptions) {
      const studentCourses = studentCourseMap.get(sub.studentId);
      if (!studentCourses) continue;
      const planCourses = planToCourses.get(sub.planId);
      if (!planCourses || planCourses.size === 0) continue;
      // Does this plan cover a PAID course the student progressed in?
      let qualifies = false;
      for (const courseId of planCourses) {
        if (!paidCourseIds.has(courseId)) continue;
        if (studentCourses.has(courseId)) {
          qualifies = true;
          break;
        }
      }
      if (!qualifies) continue;
      payingSubIds.add(sub.id);
      currency = sub.planCurrency || currency;
      const prev = grossRevenueByCurrency[sub.planCurrency] ?? 0;
      grossRevenueByCurrency[sub.planCurrency] = prev + (sub.planPrice || 0);
    }

    const totalSales = payingSubIds.size;
    const grossRevenue = grossRevenueByCurrency[currency] ?? 0;

    // ─── 5. Paid / free enrollments ───
    //   paidEnrollments = number of (student, paid-course) progress pairs
    //   freeEnrollments = number of (student, free-course) progress pairs
    let paidEnrollments = 0;
    let freeEnrollments = 0;
    for (const [, courseMap] of studentCourseMap) {
      for (const [courseId, accessType] of courseMap) {
        if (accessType === "PAID") paidEnrollments++;
        else if (accessType === "FREE") freeEnrollments++;
      }
    }
    // unused set helpers (kept for clarity / future per-course enrichment)
    void paidCourseIds;
    void freeCourseIds;

    // ─── 6. Per-course revenue table ───
    // For each course:
    //   - enrollments = distinct students with progress in it
    //   - price = the planPrice of the first subscription that unlocks it
    //     (or 0 if free / no paying student yet)
    //   - grossSales = enrollments * price (only counts paying enrollments)
    // First, build per-course student counts.
    const perCourseStudents = new Map<string, Set<string>>();
    for (const [studentId, courseMap] of studentCourseMap) {
      for (const courseId of courseMap.keys()) {
        const set = perCourseStudents.get(courseId) ?? new Set<string>();
        set.add(studentId);
        perCourseStudents.set(courseId, set);
      }
    }
    // Build a courseId → representative planPrice map (use the first paying
    // subscription we find that covers the course).
    const courseToPrice = new Map<string, number>();
    for (const course of courses) {
      if (course.accessType !== "PAID") {
        courseToPrice.set(course.id, 0);
        continue;
      }
      // Find the first subscription (any student) whose plan covers this course.
      const found = subscriptions.find((s) => {
        const planCourses = planToCourses.get(s.planId);
        return planCourses?.has(course.id);
      });
      courseToPrice.set(course.id, found?.planPrice ?? 0);
    }

    const courseRevenue = courses
      .map((c) => {
        const students = perCourseStudents.get(c.id);
        const enrollments = students ? students.size : 0;
        const price = courseToPrice.get(c.id) ?? 0;
        const grossSales =
          c.accessType === "PAID" ? enrollments * price : 0;
        return {
          courseId: c.id,
          title: c.title,
          accessType: c.accessType as "FREE" | "PAID",
          price,
          enrollments,
          grossSales,
        };
      })
      .sort((a, b) => b.grossSales - a.grossSales);

    // ─── 7. Monthly trend (last 6 months) ───
    // Revenue is attributed by the subscription's startDate month.
    const monthlyBuckets: { month: string; revenue: number }[] = [];
    const now = new Date();
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const label = d.toLocaleDateString("en-US", {
        month: "short",
        year: "2-digit",
      });
      monthlyBuckets.push({ month: label, revenue: 0 });
    }
    const monthIndexByLabel = new Map(monthlyBuckets.map((b, i) => [b.month, i]));
    for (const sub of subscriptions) {
      if (!payingSubIds.has(sub.id)) continue;
      const d = new Date(sub.startDate);
      const label = d.toLocaleDateString("en-US", { month: "short", year: "2-digit" });
      const idx = monthIndexByLabel.get(label);
      if (idx === undefined) continue;
      monthlyBuckets[idx].revenue += sub.planPrice || 0;
    }

    const hasPaymentData = totalSales > 0 || paidEnrollments > 0;

    return NextResponse.json({
      hasPaymentData,
      totalSales,
      grossRevenue,
      paidEnrollments,
      freeEnrollments,
      currency,
      courseRevenue,
      monthlyTrend: monthlyBuckets,
    });
  } catch (e) {
    const authErr = await handleAuthError(e);
    if (authErr) return authErr;
    console.error("[university/revenue GET]", e);
    return errorResponse("Failed to load revenue statistics", 500);
  }
}

function emptyRevenue() {
  return {
    hasPaymentData: false,
    totalSales: 0,
    grossRevenue: 0,
    paidEnrollments: 0,
    freeEnrollments: 0,
    currency: "OMR",
    courseRevenue: [] as Array<{
      courseId: string;
      title: string;
      accessType: "FREE" | "PAID";
      price: number;
      enrollments: number;
      grossSales: number;
    }>,
    monthlyTrend: [] as Array<{ month: string; revenue: number }>,
  };
}
