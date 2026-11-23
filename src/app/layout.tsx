import type { Metadata } from "next";
import { Poppins, Manrope, JetBrains_Mono, Noto_Kufi_Arabic } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";
import { DirectionManager } from "@/components/shared/direction-manager";
import { getPlatformSettings } from "@/lib/platform-settings";

const poppins = Poppins({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
  weight: ["300", "400", "500", "600", "700"],
});

const manrope = Manrope({
  variable: "--font-manrope",
  subsets: ["latin"],
  display: "swap",
  weight: ["500", "600", "700", "800"],
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  display: "swap",
  weight: ["400", "500", "600"],
});

const notoKufiArabic = Noto_Kufi_Arabic({
  variable: "--font-arabic",
  subsets: ["arabic"],
  display: "swap",
  weight: ["400", "500", "600", "700"],
});

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const settings = await getPlatformSettings();
  const appName = settings.appName || "CourseLearn";
  const icon = settings.logoUrl || "/logo.svg";

  return {
    title: `${appName} — Professional Online Training Platform`,
    description: `${appName} is a professional online training platform offering structured courses, recorded video lessons, assignments and verifiable completion certificates.`,
    keywords: [
      "online training",
      "course platform",
      "e-learning",
      "LMS",
      "certificates",
      "professional training",
    ],
    authors: [{ name: appName }],
    icons: {
      icon,
    },
    openGraph: {
      title: appName,
      description:
        "Professional online training platform with structured courses, video lessons and verifiable certificates.",
      siteName: appName,
      type: "website",
    },
  };
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${poppins.variable} ${manrope.variable} ${jetbrainsMono.variable} ${notoKufiArabic.variable} font-sans antialiased bg-background text-foreground`}
        suppressHydrationWarning
      >
        <DirectionManager />
        {children}
        <Toaster />
      </body>
    </html>
  );
}
