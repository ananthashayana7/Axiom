import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Axiom Platform",
  description: "Advanced procurement intelligence platform.",
  manifest: "/manifest.json",
};

export const viewport: Viewport = {
  themeColor: "#0f172a",
};

import { ThemeProvider } from "@/components/theme-provider";
import { Sidebar } from "@/components/layout/sidebar";
import { Header } from "@/components/layout/header";
import { auth } from "@/auth";
import { Toaster } from "sonner";
import { CommandPalette } from "@/components/layout/command-palette";
import { SessionProvider } from "@/components/shared/session-provider";
import { InactivityTracker } from "@/components/shared/inactivity-tracker";

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const session = await auth();

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
          <SessionProvider>
            {session ? (
              <>
                <Sidebar className="hidden lg:block h-full shrink-0" />
                <div className="flex flex-col flex-1 overflow-hidden">
                  <Header />
                  <main className="flex-1 overflow-y-auto">
                    {children}
                  </main>
                  <CommandPalette />
                </div>
                <InactivityTracker />
              </>
            ) : (
              <main className="flex-1">
                {children}
              </main>
            )}
            <Toaster position="top-right" richColors />
          </SessionProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
