import type { Metadata } from "next";
import Link from "next/link";
import { SiteHeader } from "@/components/site-header";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description:
    "How Skiplines collects, uses, and protects clinic and patient data, including WhatsApp integration.",
  alternates: { canonical: "/privacy" },
};

const LAST_UPDATED = "August 9, 2026";

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-teal-50 to-white">
      <SiteHeader />
      <main className="mx-auto max-w-3xl px-6 py-12">
        <h1 className="text-3xl font-bold tracking-tight text-teal-950">
          Privacy Policy
        </h1>
        <p className="mt-2 text-sm text-teal-800/70">
          Last updated: {LAST_UPDATED}
        </p>

        <div className="mt-8 space-y-8 text-sm leading-7 text-teal-900/90">
          <section>
            <h2 className="text-lg font-semibold text-teal-950">1. Introduction</h2>
            <p className="mt-2">
              Skiplines (&quot;we&quot;, &quot;us&quot;, or &quot;our&quot;) provides
              digital queue management software for clinics and doctors in India.
              This Privacy Policy explains how we collect, use, store, and share
              information when you use our website at{" "}
              <a
                href="https://www.skiplines.in"
                className="font-medium text-teal-700 underline hover:text-teal-600"
              >
                www.skiplines.in
              </a>{" "}
              and related services (collectively, the &quot;Service&quot;).
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-teal-950">
              2. Information We Collect
            </h2>
            <p className="mt-2">We collect the following categories of data:</p>
            <ul className="mt-3 list-disc space-y-2 pl-5">
              <li>
                <strong>Clinic account data:</strong> doctor name, clinic name,
                email address, phone number, consultation fee, clinic hours, and
                optional Google review link provided during registration.
              </li>
              <li>
                <strong>Queue and patient data:</strong> token numbers, queue
                position, status (waiting, called, completed), optional patient
                name and phone number, late flags, and estimated
                call times.
              </li>
              <li>
                <strong>WhatsApp messaging data:</strong> when patients or
                clinics interact with Skiplines via WhatsApp, we receive and
                process message content, sender phone numbers, timestamps, and
                message delivery status through the Meta WhatsApp Business
                Cloud API.
              </li>
              <li>
                <strong>Notification logs:</strong> records of WhatsApp messages
                sent by the Service, including recipient phone number, message
                type, and delivery status.
              </li>
              <li>
                <strong>Technical data:</strong> IP address, browser type, and
                usage logs collected automatically when you access our website.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-teal-950">
              3. WhatsApp Integration
            </h2>
            <p className="mt-2">
              Skiplines uses the WhatsApp Business Platform (Meta) to power our
              AI receptionist and automated queue notifications. When you message
              our WhatsApp number or scan a clinic standee QR code:
            </p>
            <ul className="mt-3 list-disc space-y-2 pl-5">
              <li>
                Your WhatsApp phone number and message content are transmitted to
                our servers via Meta&apos;s webhook infrastructure.
              </li>
              <li>
                Messages may be processed by OpenAI&apos;s language models to
                generate automated replies about queue status, clinic hours, and
                consultation fees.
              </li>
              <li>
                We send outbound WhatsApp messages for queue confirmations,
                turn notifications, late-arrival updates, and post-visit review
                requests on behalf of participating clinics.
              </li>
              <li>
                We do not sell your WhatsApp data. Message handling is governed
                by Meta&apos;s WhatsApp Business Terms and this policy.
              </li>
            </ul>
            <p className="mt-3">
              By messaging Skiplines on WhatsApp, you consent to this processing.
              You may stop receiving messages at any time by replying STOP or by
              requesting data deletion (see our{" "}
              <Link
                href="/data-deletion"
                className="font-medium text-teal-700 underline hover:text-teal-600"
              >
                Data Deletion Instructions
              </Link>
              ).
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-teal-950">
              4. How We Use Your Information
            </h2>
            <ul className="mt-2 list-disc space-y-2 pl-5">
              <li>Manage clinic queues and display live wait times.</li>
              <li>
                Send WhatsApp notifications related to queue status and clinic
                services.
              </li>
              <li>
                Provide AI-assisted responses to patient inquiries via WhatsApp.
              </li>
              <li>Process subscription billing for clinic accounts.</li>
              <li>Improve, secure, and maintain the Service.</li>
              <li>Comply with applicable legal obligations.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-teal-950">
              5. Payment Information
            </h2>
            <p className="mt-2">
              Clinic subscription payments (₹999/month) are processed through{" "}
              <strong>Cashfree Payments</strong>, our authorised payment gateway.
              When you subscribe:
            </p>
            <ul className="mt-3 list-disc space-y-2 pl-5">
              <li>
                Payment details (card, UPI, net banking) are entered directly on
                Cashfree&apos;s secure checkout page — Skiplines does not store
                full card numbers, CVV, or UPI PINs.
              </li>
              <li>
                We receive only transaction metadata: order ID, payment status,
                amount, and billing email for subscription management.
              </li>
              <li>
                Cashfree is PCI-DSS compliant. Their handling of payment data is
                governed by{" "}
                <a
                  href="https://www.cashfree.com/privacypolicy/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-medium text-teal-700 underline hover:text-teal-600"
                >
                  Cashfree&apos;s Privacy Policy
                </a>
                .
              </li>
              <li>
                Refunds, where applicable, are processed back to the original
                payment method via Cashfree within 5–7 working days. See our{" "}
                <Link
                  href="/refund-policy"
                  className="font-medium text-teal-700 underline hover:text-teal-600"
                >
                  Refund &amp; Cancellation Policy
                </Link>
                .
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-teal-950">
              6. Patient Privacy
            </h2>
            <p className="mt-2">
              Patient data collected through the queue (phone number, optional
              name, token status) is used solely for queue management and
              WhatsApp notifications on behalf of the clinic. We do not use
              patient health records or clinical data. Clinics are data
              controllers for their patients; Skiplines processes data as a
              service provider. Patients may request deletion via our{" "}
              <Link
                href="/data-deletion"
                className="font-medium text-teal-700 underline hover:text-teal-600"
              >
                Data Deletion Instructions
              </Link>
              .
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-teal-950">
              7. Data Storage and Security
            </h2>
            <p className="mt-2">
              Data is stored in Supabase (PostgreSQL) hosted in the
              Asia-Pacific (Mumbai) region. Our application is hosted on Vercel.
              We use industry-standard security measures including encrypted
              connections (HTTPS/TLS) and access controls. No method of
              transmission or storage is 100% secure; we cannot guarantee absolute
              security.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-teal-950">
              8. Data Sharing
            </h2>
            <p className="mt-2">We share data only with service providers necessary to operate Skiplines:</p>
            <ul className="mt-3 list-disc space-y-2 pl-5">
              <li>
                <strong>Meta (WhatsApp):</strong> to send and receive WhatsApp
                messages.
              </li>
              <li>
                <strong>OpenAI:</strong> to generate AI receptionist responses
                (message content is sent for processing).
              </li>
              <li>
                <strong>Supabase:</strong> database hosting and authentication.
              </li>
              <li>
                <strong>Vercel:</strong> application hosting and infrastructure.
              </li>
              <li>
                <strong>Cashfree:</strong> subscription payment processing (clinic
                billing data only).
              </li>
            </ul>
            <p className="mt-3">
              We do not sell personal data to third parties. We may disclose
              information if required by law or to protect the rights and safety
              of Skiplines, our users, or others.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-teal-950">
              9. Data Retention
            </h2>
            <p className="mt-2">
              Clinic account data is retained for the duration of the
              subscription or trial period. Queue and patient token data is
              retained for operational purposes and deleted upon request or when
              no longer needed. Notification logs are retained for up to 90 days
              for delivery auditing, unless a longer period is required by law.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-teal-950">10. Your Rights</h2>
            <p className="mt-2">
              Under applicable Indian data protection laws, you may have the
              right to access, correct, or delete your personal data. To exercise
              these rights, please see our{" "}
              <Link
                href="/data-deletion"
                className="font-medium text-teal-700 underline hover:text-teal-600"
              >
                Data Deletion Instructions
              </Link>{" "}
              or contact us at{" "}
              <a
                href="mailto:getskiplines@gmail.com"
                className="font-medium text-teal-700 underline hover:text-teal-600"
              >
                getskiplines@gmail.com
              </a>{" "}
              or via our{" "}
              <Link
                href="/contact"
                className="font-medium text-teal-700 underline hover:text-teal-600"
              >
                Contact Us
              </Link>{" "}
              page.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-teal-950">
              11. Children&apos;s Privacy
            </h2>
            <p className="mt-2">
              Skiplines is intended for use by clinics and adult patients. We do
              not knowingly collect personal data from children under 18 without
              parental consent.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-teal-950">
              12. Changes to This Policy
            </h2>
            <p className="mt-2">
              We may update this Privacy Policy from time to time. We will post
              the revised policy on this page with an updated &quot;Last
              updated&quot; date. Continued use of the Service after changes
              constitutes acceptance of the updated policy.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-teal-950">13. Contact Us</h2>
            <p className="mt-2">
              For privacy-related questions or concerns, contact us at{" "}
              <a
                href="mailto:getskiplines@gmail.com"
                className="font-medium text-teal-700 underline hover:text-teal-600"
              >
                getskiplines@gmail.com
              </a>{" "}
              or visit our{" "}
              <Link
                href="/contact"
                className="font-medium text-teal-700 underline hover:text-teal-600"
              >
                Contact Us
              </Link>{" "}
              page.
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
