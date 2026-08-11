import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { CanonicalHostRedirect } from "@/components/canonical-host-redirect";
import { SiteFooter } from "@/components/site-footer";
import { CANONICAL_PRODUCTION_SITE_URL } from "@/lib/env";
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
  metadataBase: new URL(CANONICAL_PRODUCTION_SITE_URL),
  title: "Skiplines",
  description: "Digital queue management for clinics and doctors.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <CanonicalHostRedirect />
        <div className="flex-1">{children}</div>
        <SiteFooter />
      </body>
    </html>
  );
}
