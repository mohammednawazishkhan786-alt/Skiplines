import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Script from "next/script";
import { CanonicalHostRedirect } from "@/components/canonical-host-redirect";
import { SiteFooter } from "@/components/site-footer";
import { CANONICAL_PRODUCTION_SITE_URL } from "@/lib/env";
import "./globals.css";

const GA_MEASUREMENT_ID = "G-VC5Z65ZBFV";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const siteTitle = "Skiplines — Skip the Wait";
const siteDescription =
  "Digital OPD queue management for clinics and doctors in India. Patients join by QR, doctors call the next patient with one tap.";

export const metadata: Metadata = {
  metadataBase: new URL(CANONICAL_PRODUCTION_SITE_URL),
  title: {
    default: siteTitle,
    template: "%s · Skiplines",
  },
  description: siteDescription,
  applicationName: "Skiplines",
  openGraph: {
    type: "website",
    locale: "en_IN",
    url: CANONICAL_PRODUCTION_SITE_URL,
    siteName: "Skiplines",
    title: siteTitle,
    description: siteDescription,
  },
  twitter: {
    card: "summary",
    title: siteTitle,
    description: siteDescription,
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <Script
          src={`https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`}
          strategy="afterInteractive"
        />
        <Script id="google-analytics" strategy="afterInteractive">
          {`
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            gtag('js', new Date());
            gtag('config', '${GA_MEASUREMENT_ID}');
          `}
        </Script>
        <CanonicalHostRedirect />
        <div className="flex-1">{children}</div>
        <SiteFooter />
      </body>
    </html>
  );
}
