import type { Metadata, Viewport } from "next";
import { Geist } from "next/font/google";

import { auth } from "@/auth";
import { Header } from "@/components/layout/header";
import { Sidebar } from "@/components/layout/sidebar";
import { CommandPalette } from "@/components/layout/command-palette";
import { CurrencyProvider } from "@/components/currency-provider";
import { InactivityTracker } from "@/components/shared/inactivity-tracker";
import { PageTransition } from "@/components/shared/page-transition";
import { SessionProvider } from "@/components/shared/session-provider";
import { VersionShield } from "@/components/shared/version-shield";
import { ThemeProvider } from "@/components/theme-provider";
import { getRuntimeVersionSnapshot } from "@/lib/build-info";
import { Toaster } from "sonner";
import { getPlatformSettingsForLayout } from "@/app/actions/settings";

import "./globals.css";

const geistSans = Geist({
  subsets: ["latin"],
  variable: "--font-geist-sans",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Axiom Platform",
  description: "Advanced procurement intelligence platform.",
  manifest: "/manifest.json",
};

export const viewport: Viewport = {
  themeColor: "#10634a",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const session = await auth();
  const settings = await getPlatformSettingsForLayout();
  const runtimeVersion = getRuntimeVersionSnapshot();

  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} min-h-[100dvh] overflow-hidden bg-background text-foreground antialiased`}
        suppressHydrationWarning
      >
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <SessionProvider session={session}>
            <CurrencyProvider initialSettings={settings}>
              {session ? (
                <div className="flex h-[100dvh] w-full overflow-hidden">
                  <Sidebar className="hidden h-[100dvh] shrink-0 self-stretch lg:flex" />
                  <div className="flex h-[100dvh] min-w-0 flex-1 flex-col overflow-hidden">
                    <Header />
                    <main className="min-h-0 flex-1 overflow-auto">
                      <PageTransition>{children}</PageTransition>
                    </main>
                    <CommandPalette />
                  </div>
                  <InactivityTracker />
                </div>
              ) : (
                <div className="flex h-[100dvh] w-full min-w-0 flex-1 flex-col overflow-hidden">
                  <main className="flex-1 overflow-auto">{children}</main>
                </div>
              )}
              <VersionShield
                initialVersion={runtimeVersion.version}
                initialLabel={runtimeVersion.label}
              />
              <Toaster position="top-right" richColors />
            </CurrencyProvider>
          </SessionProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
