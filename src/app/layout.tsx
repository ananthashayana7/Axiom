import type { Metadata, Viewport } from "next";

import { auth } from "@/auth";
import { Header } from "@/components/layout/header";
import { Sidebar } from "@/components/layout/sidebar";
import { CommandPalette } from "@/components/layout/command-palette";
import { CurrencyProvider } from "@/components/currency-provider";
import { InactivityTracker } from "@/components/shared/inactivity-tracker";
import { PageTransition } from "@/components/shared/page-transition";
import { SessionProvider } from "@/components/shared/session-provider";
import { ThemeProvider } from "@/components/theme-provider";
import { Toaster } from "sonner";

import "./globals.css";

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
  const currentYear = new Date().getFullYear();

  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className="min-h-[100dvh] overflow-hidden bg-background text-foreground antialiased"
        suppressHydrationWarning
      >
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <SessionProvider session={session}>
            <CurrencyProvider>
              {session ? (
                <div className="flex min-h-[100dvh] max-h-[100dvh] w-full overflow-hidden">
                  <Sidebar className="hidden h-full shrink-0 lg:flex" />
                  <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
                    <Header />
                    <main className="flex-1 min-h-0 overflow-auto">
                      <PageTransition>{children}</PageTransition>
                    </main>
                    <footer className="border-t border-border/60 bg-background/95 px-4 py-3 text-center text-xs text-muted-foreground backdrop-blur lg:px-8">
                      Axiom Platform • Operational date system: {currentYear}
                    </footer>
                    <CommandPalette />
                  </div>
                  <InactivityTracker />
                </div>
              ) : (
                <div className="flex min-h-[100dvh] w-full min-w-0 flex-1 flex-col overflow-hidden">
                  <main className="flex-1 overflow-auto">{children}</main>
                  <footer className="border-t border-border/60 bg-background/95 px-4 py-3 text-center text-xs text-muted-foreground backdrop-blur">
                    Axiom Platform • Operational date system: {currentYear}
                  </footer>
                </div>
              )}
              <Toaster position="top-right" richColors />
            </CurrencyProvider>
          </SessionProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
