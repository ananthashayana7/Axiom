import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Axiom Platform",
  description: "Advanced procurement intelligence platform.",
  manifest: "/manifest.json",
};

export const viewport: Viewport = {
  themeColor: "#0f172a",
};

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
        className={`${geistSans.variable} ${geistMono.variable} antialiased flex min-h-screen`}
        suppressHydrationWarning
      >
        <SessionProvider>
          {session ? (
            <>
              <Sidebar className="hidden lg:block sticky top-0 h-screen" />
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
      </body>
    </html>
  );
}
