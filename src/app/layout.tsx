import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Axiom Platform",
  description: "Advanced procurement intelligence platform.",
  manifest: "/manifest.json",
};

export const viewport: Viewport = {
  themeColor: "#10634a",
};

import { ThemeProvider } from "@/components/theme-provider";
import { Sidebar } from "@/components/layout/sidebar";
import { Header } from "@/components/layout/header";
import { auth } from "@/auth";
import { Toaster } from "sonner";
import { CommandPalette } from "@/components/layout/command-palette";
import { SessionProvider } from "@/components/shared/session-provider";
import { InactivityTracker } from "@/components/shared/inactivity-tracker";
import { CurrencyProvider } from "@/components/currency-provider";
import { PageTransition } from "@/components/shared/page-transition";

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
        className="antialiased flex h-[100dvh] overflow-hidden"
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
              <>
                <Sidebar className="hidden lg:block h-full shrink-0" />
                <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
                  <Header />
                  <main className="flex-1 overflow-auto">
                    <PageTransition>
                      {children}
                    </PageTransition>
                  </main>
                  <footer className="border-t border-border/60 bg-background/95 px-4 py-3 text-center text-xs text-muted-foreground backdrop-blur lg:px-8">
                    Axiom Platform • Operational date system: {currentYear}
                  </footer>
                  <CommandPalette />
                </div>
                <InactivityTracker />
              </>
            ) : (
              <div className="flex flex-1 min-w-0 flex-col overflow-hidden">
                <main className="flex-1 overflow-auto">
                  {children}
                </main>
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
