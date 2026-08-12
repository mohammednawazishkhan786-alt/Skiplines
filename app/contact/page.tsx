import type { Metadata } from "next";
import { Mail, MapPin, Phone, Stethoscope } from "lucide-react";
import { LegalPageLayout } from "@/components/legal-page";

export const metadata: Metadata = {
  title: "Contact Us",
  description:
    "Contact Skiplines customer support for OPD token and queue management help.",
  alternates: { canonical: "/contact" },
};

const LAST_UPDATED = "August 9, 2026";

export default function ContactPage() {
  return (
    <LegalPageLayout
      title="Contact Us"
      description="Reach Skiplines support for clinic onboarding, billing, and technical help."
      lastUpdated={LAST_UPDATED}
    >
      <section>
        <h2 className="text-lg font-semibold text-teal-950">Business Details</h2>
        <div className="mt-4 rounded-2xl border border-teal-200 bg-white p-6 shadow-sm">
          <div className="flex items-center gap-2 font-semibold text-teal-950">
            <Stethoscope className="h-5 w-5 text-teal-700" />
            Skiplines
          </div>
          <p className="mt-2 text-teal-800/80">
            OPD Token &amp; Queue Management Platform
          </p>
          <p className="mt-1 text-sm text-teal-700/80">
            Operating name: <strong>Skiplines</strong>
          </p>
          <p className="mt-1 text-sm text-teal-700/80">
            Website:{" "}
            <a
              href="https://www.skiplines.in"
              className="font-medium text-teal-700 underline hover:text-teal-600"
            >
              www.skiplines.in
            </a>
          </p>
        </div>
      </section>

      <section>
        <h2 className="text-lg font-semibold text-teal-950">Customer Support</h2>
        <ul className="mt-4 space-y-4">
          <li className="flex items-start gap-3">
            <Mail className="mt-0.5 h-5 w-5 shrink-0 text-teal-700" />
            <div>
              <p className="font-medium text-teal-950">Email</p>
              <a
                href="mailto:getskiplines@gmail.com"
                className="text-teal-800 hover:text-teal-600 hover:underline"
              >
                getskiplines@gmail.com
              </a>
              <p className="mt-1 text-teal-800/70">
                For clinic registration, billing, refunds, and technical support.
              </p>
            </div>
          </li>
          <li className="flex items-start gap-3">
            <Phone className="mt-0.5 h-5 w-5 shrink-0 text-teal-700" />
            <div>
              <p className="font-medium text-teal-950">Phone</p>
              <a
                href="tel:+917037219290"
                className="text-teal-800 hover:text-teal-600 hover:underline"
              >
                +91 70372 19290
              </a>
              <p className="mt-1 text-teal-800/70">
                Monday–Saturday, 9:00 AM – 6:00 PM IST
              </p>
            </div>
          </li>
          <li className="flex items-start gap-3">
            <MapPin className="mt-0.5 h-5 w-5 shrink-0 text-teal-700" />
            <div>
              <p className="font-medium text-teal-950">Service Area</p>
              <p className="text-teal-800/80">India (online platform)</p>
            </div>
          </li>
        </ul>
      </section>

      <section>
        <h2 className="text-lg font-semibold text-teal-950">What We Can Help With</h2>
        <ul className="mt-3 list-disc space-y-2 pl-5">
          <li>Clinic registration and dashboard setup</li>
          <li>WhatsApp queue token and standee QR issues</li>
          <li>Subscription billing and Cashfree payment queries</li>
          <li>Refund and cancellation requests</li>
          <li>Privacy and data deletion requests</li>
        </ul>
      </section>

      <section>
        <h2 className="text-lg font-semibold text-teal-950">Response Time</h2>
        <p className="mt-2">
          We aim to respond to all support emails within{" "}
          <strong>1–2 business days</strong>. Urgent billing or payment issues
          are prioritised. For refund requests, please see our{" "}
          <a
            href="/refund-policy"
            className="font-medium text-teal-700 underline hover:text-teal-600"
          >
            Refund &amp; Cancellation Policy
          </a>
          .
        </p>
      </section>
    </LegalPageLayout>
  );
}
