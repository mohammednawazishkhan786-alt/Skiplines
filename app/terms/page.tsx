import type { Metadata } from "next";
import Link from "next/link";
import { LegalPageLayout } from "@/components/legal-page";

export const metadata: Metadata = {
  title: "Terms & Conditions",
  description:
    "Terms and conditions for using Skiplines OPD token and queue management platform.",
};

const LAST_UPDATED = "August 9, 2026";

export default function TermsPage() {
  return (
    <LegalPageLayout
      title="Terms & Conditions"
      description="Terms governing use of the Skiplines OPD Token & Queue Management platform."
      lastUpdated={LAST_UPDATED}
    >
      <section>
        <h2 className="text-lg font-semibold text-teal-950">1. Agreement</h2>
        <p className="mt-2">
          These Terms &amp; Conditions (&quot;Terms&quot;) govern your access to
          and use of Skiplines, an OPD token and queue management platform
          operated at{" "}
          <a
            href="https://www.skiplines.in"
            className="font-medium text-teal-700 underline hover:text-teal-600"
          >
            www.skiplines.in
          </a>{" "}
          (&quot;Skiplines&quot;, &quot;we&quot;, &quot;us&quot;, or
          &quot;our&quot;). By registering a clinic, using the dashboard, or
          accessing any part of the Service, you agree to these Terms.
        </p>
      </section>

      <section>
        <h2 className="text-lg font-semibold text-teal-950">2. Service Description</h2>
        <p className="mt-2">
          Skiplines provides digital queue management for outpatient departments
          (OPD), including:
        </p>
        <ul className="mt-3 list-disc space-y-2 pl-5">
          <li>Clinic registration and configuration</li>
          <li>OPD token issuance via WhatsApp and web join links</li>
          <li>Live patient queue tracking and doctor dashboard</li>
          <li>Automated WhatsApp notifications for queue updates</li>
          <li>Subscription billing for clinic accounts (₹999/month)</li>
        </ul>
        <p className="mt-3">
          Skiplines is a queue management tool only. We do not provide medical
          advice, diagnosis, or treatment. Clinics remain solely responsible for
          patient care and clinical decisions.
        </p>
      </section>

      <section>
        <h2 className="text-lg font-semibold text-teal-950">3. Clinic Accounts</h2>
        <p className="mt-2">
          Clinic operators must provide accurate registration information
          (doctor name, clinic name, email, phone). You are responsible for
          maintaining the confidentiality of your clinic dashboard access and for
          all activity under your account. You must not share login credentials
          or misuse the platform for unlawful purposes.
        </p>
      </section>

      <section>
        <h2 className="text-lg font-semibold text-teal-950">4. OPD Tokens &amp; Patients</h2>
        <ul className="mt-2 list-disc space-y-2 pl-5">
          <li>
            OPD tokens issued through Skiplines represent queue position only
            and do not guarantee a specific consultation time.
          </li>
          <li>
            Patients join the queue voluntarily by scanning a clinic QR code or
            messaging via WhatsApp.
          </li>
          <li>
            Clinics may call patients in queue order, including emergency
            priority overrides, at their discretion.
          </li>
          <li>
            Skiplines is not liable for delays, no-shows, or disputes between
            clinics and patients regarding wait times or consultations.
          </li>
        </ul>
      </section>

      <section>
        <h2 className="text-lg font-semibold text-teal-950">
          5. Subscription &amp; Payments
        </h2>
        <p className="mt-2">
          Clinic subscriptions are billed at ₹999 per month (plus applicable
          taxes) after a 7-day free trial. Payments are processed securely
          through Cashfree Payments. By subscribing, you authorise recurring
          charges as described at checkout. See our{" "}
          <Link
            href="/refund-policy"
            className="font-medium text-teal-700 underline hover:text-teal-600"
          >
            Refund &amp; Cancellation Policy
          </Link>{" "}
          for cancellation and refund terms.
        </p>
      </section>

      <section>
        <h2 className="text-lg font-semibold text-teal-950">6. Acceptable Use</h2>
        <p className="mt-2">You agree not to:</p>
        <ul className="mt-3 list-disc space-y-2 pl-5">
          <li>Use Skiplines for any unlawful, fraudulent, or abusive purpose</li>
          <li>Attempt to reverse-engineer, disrupt, or overload the Service</li>
          <li>Upload false patient or clinic information</li>
          <li>Resell or sublicense the Service without written consent</li>
        </ul>
      </section>

      <section>
        <h2 className="text-lg font-semibold text-teal-950">
          7. Intellectual Property
        </h2>
        <p className="mt-2">
          Skiplines, its logo, software, and content are owned by us or our
          licensors. You receive a limited, non-exclusive, non-transferable
          licence to use the Service for your clinic&apos;s internal queue
          management during an active subscription or trial.
        </p>
      </section>

      <section>
        <h2 className="text-lg font-semibold text-teal-950">
          8. Limitation of Liability
        </h2>
        <p className="mt-2">
          To the maximum extent permitted by law, Skiplines shall not be liable
          for indirect, incidental, special, or consequential damages arising
          from use of the Service, including loss of revenue, data, or goodwill.
          Our total liability for any claim shall not exceed the amount paid by
          you to Skiplines in the three months preceding the claim.
        </p>
      </section>

      <section>
        <h2 className="text-lg font-semibold text-teal-950">9. Termination</h2>
        <p className="mt-2">
          We may suspend or terminate your account for violation of these Terms
          or non-payment. You may cancel your subscription at any time as
          described in our Refund &amp; Cancellation Policy. Upon termination,
          your access to the dashboard and queue features will cease.
        </p>
      </section>

      <section>
        <h2 className="text-lg font-semibold text-teal-950">10. Governing Law</h2>
        <p className="mt-2">
          These Terms are governed by the laws of India. Any disputes shall be
          subject to the exclusive jurisdiction of courts in India.
        </p>
      </section>

      <section>
        <h2 className="text-lg font-semibold text-teal-950">11. Contact</h2>
        <p className="mt-2">
          For questions about these Terms, contact us via our{" "}
          <Link
            href="/contact"
            className="font-medium text-teal-700 underline hover:text-teal-600"
          >
            Contact Us
          </Link>{" "}
          page or email{" "}
          <a
            href="mailto:getskiplines@gmail.com"
            className="font-medium text-teal-700 underline hover:text-teal-600"
          >
            getskiplines@gmail.com
          </a>
          .
        </p>
      </section>
    </LegalPageLayout>
  );
}
