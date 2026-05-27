import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";
import "./globals.css";

import { AuthNav } from "@/components/auth/auth-nav";
import { BrandLogo } from "@/components/brand-logo";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"]
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"]
});

export const metadata: Metadata = {
  title: "WallPack AI",
  description:
    "Create Etsy-ready printable wall-art packs with ratios, mockups, listing copy, and buyer instructions.",
  icons: {
    icon: [
      { url: "/brand/wallpack-mark.svg", type: "image/svg+xml" },
      { url: "/brand/wallpack-icon-32.png", sizes: "32x32", type: "image/png" },
      {
        url: "/brand/wallpack-icon-192.png",
        sizes: "192x192",
        type: "image/png"
      }
    ],
    apple: [
      {
        url: "/brand/apple-touch-icon.png",
        sizes: "180x180",
        type: "image/png"
      }
    ],
    shortcut: ["/favicon.ico"]
  }
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable}`}
      data-scroll-behavior="smooth"
      suppressHydrationWarning
    >
      <body className="font-sans antialiased">
        <header className="sticky top-0 z-50 border-b bg-background/90 backdrop-blur">
          <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
            <Link
              href="/"
              aria-label="WallPack AI home"
              className="flex min-w-0 items-center"
            >
              <BrandLogo size="sm" decorative />
            </Link>
            <nav className="hidden items-center gap-6 text-sm text-muted-foreground md:flex">
              <Link
                href="/pricing"
                className="transition hover:text-foreground"
              >
                Pricing
              </Link>
              <Link
                href="/help/print-sizes"
                className="transition hover:text-foreground"
              >
                Print sizes
              </Link>
              <Link href="/app" className="transition hover:text-foreground">
                Dashboard
              </Link>
            </nav>
            <AuthNav />
          </div>
        </header>
        {children}
      </body>
    </html>
  );
}
