import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, QrCode, Stethoscope } from "lucide-react";
import { JsonLd } from "@/components/json-ld";
import { SiteHeader } from "@/components/site-header";
import { CANONICAL_PRODUCTION_SITE_URL } from "@/lib/env";

export const metadata: Metadata = {
  title: "Skiplines — Skip the Wait",
  description: "Digital queue management for clinics and doctors.",
};

const softwareJsonLd = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: "Skiplines",
  applicationCategory: "BusinessApplication",
  operatingSystem: "Web",
  url: CANONICAL_PRODUCTION_SITE_URL,
  description:
    "Digital OPD queue management for clinics and doctors in India.",
  offers: {
    "@type": "Offer",
    price: "999",
    priceCurrency: "INR",
    description: "Monthly clinic subscription after 7-day free trial",
  },
};

export default function Home() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-teal-50 to-white">
      <JsonLd data={softwareJsonLd} />
      <SiteHeader />
      <main className="mx-auto flex max-w-5xl flex-col items-center px-6 py-20 text-center">
        <div className="inline-flex items-center gap-2 rounded-full border border-teal-200 bg-white px-4 py-2 text-sm font-medium text-teal-800">
          <Stethoscope className="h-4 w-4" />
          Queue management for modern clinics
        </div>
        <h1 className="mt-8 max-w-3xl text-5xl font-bold tracking-tight text-teal-950 sm:text-6xl">
          Skip the wait. Serve patients faster.
        </h1>
        <p className="mt-6 max-w-2xl text-lg leading-8 text-teal-800/80">
          Register your clinic, print a QR standee, and let patients join the
          queue from their phone. Call the next patient with one tap.
        </p>
        <div className="mt-10 flex flex-col gap-4 sm:flex-row">
          <Link
            href="/register"
            className="inline-flex items-center justify-center gap-2 rounded-full bg-teal-700 px-8 py-4 font-semibold text-white hover:bg-teal-600"
          >
            Register Your Clinic
            <ArrowRight className="h-4 w-4" />
          </Link>
          <Link
            href="/dashboard"
            className="inline-flex items-center justify-center gap-2 rounded-full border border-teal-200 bg-white px-8 py-4 font-semibold text-teal-800 hover:bg-teal-50"
          >
            Open Dashboard
          </Link>
        </div>

        <div className="mt-20 grid w-full gap-6 text-left sm:grid-cols-3">
          <Feature
            title="Doctor Registration"
            description="Capture clinic details and average consultation time in minutes."
          />
          <Feature
            title="QR Standee PDF"
            description="Auto-generate a printable standee patients can scan to join the queue."
            icon={<QrCode className="h-5 w-5 text-teal-700" />}
          />
          <Feature
            title="Live Dashboard"
            description="See who's waiting and call the next patient instantly."
          />
        </div>
      </main>
    </div>
  );
}

function Feature({
  title,
  description,
  icon,
}: {
  title: string;
  description: string;
  icon?: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-teal-200 bg-white p-6 shadow-sm">
      {icon ? <div className="mb-3">{icon}</div> : null}
      <h2 className="text-lg font-semibold text-teal-950">{title}</h2>
      <p className="mt-2 text-sm leading-6 text-teal-800/80">{description}</p>
    </div>
  );
}
