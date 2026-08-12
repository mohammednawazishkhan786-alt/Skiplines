import type { Metadata } from "next";
import Link from "next/link";
import { SiteHeader } from "@/components/site-header";

export const metadata: Metadata = {
  title: "Data Deletion Instructions",
  description:
    "How to request deletion of your personal data from Skiplines, including WhatsApp and queue data.",
};

const LAST_UPDATED = "August 9, 2026";

export default function DataDeletionPage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-teal-50 to-white">
      <SiteHeader />
      <main className="mx-auto max-w-3xl px-6 py-12">
        <h1 className="text-3xl font-bold tracking-tight text-teal-950">
          Data Deletion Instructions
        </h1>
        <p className="mt-2 text-sm text-teal-800/70">
          Last updated: {LAST_UPDATED}
        </p>

        <div className="mt-8 space-y-8 text-sm leading-7 text-teal-900/90">
          <section>
            <h2 className="text-lg font-semibold text-teal-950">Overview</h2>
            <p className="mt-2">
              Skiplines respects your right to control your personal data. This
              page explains how patients and clinic operators can request
              deletion of data collected through our website, queue system, and
              WhatsApp integration.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-teal-950">
              What Data We Store
            </h2>
            <p className="mt-2">
              Depending on how you interact with Skiplines, we may hold:
            </p>
            <ul className="mt-3 list-disc space-y-2 pl-5">
              <li>
                <strong>Patient data:</strong> WhatsApp phone number, optional
                name, queue token details, message history processed through our
                WhatsApp webhook, and notification logs.
              </li>
              <li>
                <strong>Clinic data:</strong> doctor name, clinic name, email,
                phone number, consultation settings, subscription information,
                and associated queue records.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-teal-950">
              For Patients — Delete Your Data
            </h2>
            <p className="mt-2">
              If you joined a clinic queue via WhatsApp or our live tracker and
              want your data removed, follow these steps:
            </p>
            <ol className="mt-3 list-decimal space-y-3 pl-5">
              <li>
                Send an email to{" "}
                <a
                  href="mailto:privacy@skiplines.in"
                  className="font-medium text-teal-700 underline hover:text-teal-600"
                >
                  privacy@skiplines.in
                </a>{" "}
                with the subject line: <strong>Data Deletion Request</strong>.
              </li>
              <li>
                Include your WhatsApp phone number (with country code, e.g.
                +91XXXXXXXXXX) and the clinic name you visited, if known.
              </li>
              <li>
                Briefly describe what data you want deleted (e.g. queue token,
                message history, notification logs).
              </li>
            </ol>
            <p className="mt-3">
              Alternatively, you may send a WhatsApp message to the Skiplines
              business number with the text <strong>DELETE MY DATA</strong> from
              the phone number you wish to remove. We will verify your identity
              using that number before processing the request.
            </p>
            <p className="mt-3">
              Replying <strong>STOP</strong> to any Skiplines WhatsApp message
              will opt you out of future automated notifications but does not
              automatically delete stored data. Please submit a formal deletion
              request using the steps above.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-teal-950">
              For Clinics — Delete Your Account
            </h2>
            <p className="mt-2">
              Registered clinic operators may request full account and data
              deletion by emailing{" "}
              <a
                href="mailto:privacy@skiplines.in"
                className="font-medium text-teal-700 underline hover:text-teal-600"
              >
                privacy@skiplines.in
              </a>{" "}
              from the email address used during registration. Include your
              clinic name and registered phone number for verification.
            </p>
            <p className="mt-3">
              Account deletion will remove your clinic profile, all associated
              queue tokens, patient records linked to your clinic, and
              notification logs. This action is irreversible.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-teal-950">
              What Happens After Your Request
            </h2>
            <ul className="mt-2 list-disc space-y-2 pl-5">
              <li>
                We will acknowledge your request within <strong>3 business days</strong>.
              </li>
              <li>
                Verified deletion requests are completed within{" "}
                <strong>30 days</strong>.
              </li>
              <li>
                We will delete your data from our Supabase database, including
                queue tokens and notification logs associated with your phone
                number or clinic account.
              </li>
              <li>
                Data held by third-party processors (Meta/WhatsApp, OpenAI) is
                subject to their respective retention policies. We will request
                deletion where technically feasible.
              </li>
              <li>
                We may retain minimal records if required by law (e.g. billing
                records for clinic subscriptions).
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-teal-950">
              WhatsApp-Specific Notes
            </h2>
            <p className="mt-2">
              Skiplines receives WhatsApp messages through Meta&apos;s Business
              Cloud API. When you request deletion:
            </p>
            <ul className="mt-3 list-disc space-y-2 pl-5">
              <li>
                We delete your phone number, message content, and queue records
                stored in our systems.
              </li>
              <li>
                We stop sending you automated WhatsApp notifications from
                Skiplines.
              </li>
              <li>
                Message data processed by Meta or OpenAI during AI receptionist
                interactions may be retained by those providers according to
                their own policies. Refer to{" "}
                <a
                  href="https://www.whatsapp.com/legal/privacy-policy"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-medium text-teal-700 underline hover:text-teal-600"
                >
                  WhatsApp&apos;s Privacy Policy
                </a>{" "}
                for more information.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-teal-950">Contact</h2>
            <p className="mt-2">
              For questions about data deletion or to check the status of a
              pending request, email{" "}
              <a
                href="mailto:privacy@skiplines.in"
                className="font-medium text-teal-700 underline hover:text-teal-600"
              >
                privacy@skiplines.in
              </a>
              .
            </p>
            <p className="mt-3">
              See also our{" "}
              <Link
                href="/privacy"
                className="font-medium text-teal-700 underline hover:text-teal-600"
              >
                Privacy Policy
              </Link>{" "}
              for full details on how we collect and use data.
            </p>
          </section>
        </div>

        <p className="mt-10 text-sm text-teal-800/70">
          <Link href="/" className="font-medium text-teal-700 hover:text-teal-600">
            ← Back to home
          </Link>
        </p>
      </main>
    </div>
  );
}
