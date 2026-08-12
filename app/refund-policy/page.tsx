import type { Metadata } from "next";
import Link from "next/link";
import { LegalPageLayout } from "@/components/legal-page";

export const metadata: Metadata = {
  title: "Refund & Cancellation Policy",
  description:
    "Refund and cancellation terms for Skiplines OPD token and subscription services.",
};

const LAST_UPDATED = "August 9, 2026";

export default function RefundPolicyPage() {
  return (
    <LegalPageLayout
      title="Refund & Cancellation Policy"
      description="Cancellation rules for OPD tokens and subscription refunds processed via Cashfree."
      lastUpdated={LAST_UPDATED}
    >
      <section>
        <h2 className="text-lg font-semibold text-teal-950">1. Overview</h2>
        <p className="mt-2">
          This Refund &amp; Cancellation Policy applies to Skiplines, an OPD
          Token &amp; Queue Management platform. It covers clinic subscription
          payments and explains how OPD token cancellations are handled at
          participating clinics.
        </p>
      </section>

      <section>
        <h2 className="text-lg font-semibold text-teal-950">
          2. OPD Token Cancellation
        </h2>
        <p className="mt-2">
          OPD queue tokens issued through Skiplines are managed by the
          participating clinic, not by Skiplines directly. Token cancellation
          rules are as follows:
        </p>
        <ul className="mt-3 list-disc space-y-2 pl-5">
          <li>
            <strong>Before consultation:</strong> Patients may request token
            cancellation by contacting the clinic reception or via WhatsApp
            before their token is called. The clinic may remove the token from
            the active queue at its discretion.
          </li>
          <li>
            <strong>After token is called:</strong> Once a token status changes
            to &quot;called&quot; or &quot;completed&quot;, the token cannot be
            cancelled through Skiplines.
          </li>
          <li>
            <strong>No-show patients:</strong> Clinics may mark no-show patients
            as completed without refund of any consultation fee collected
            offline at the clinic.
          </li>
          <li>
            <strong>Emergency tokens:</strong> Emergency-priority tokens follow
            the same cancellation rules but may be expedited by the clinic.
          </li>
        </ul>
        <p className="mt-3">
          Skiplines does not charge patients for OPD tokens. Token cancellation
          does not involve payment refunds from Skiplines unless a separate
          clinic consultation fee was paid through our payment gateway (see
          Section 3).
        </p>
      </section>

      <section>
        <h2 className="text-lg font-semibold text-teal-950">
          3. Clinic Subscription Cancellation
        </h2>
        <p className="mt-2">
          Clinic operators may cancel their Skiplines subscription (₹999/month)
          at any time by emailing{" "}
          <a
            href="mailto:getskiplines@gmail.com"
            className="font-medium text-teal-700 underline hover:text-teal-600"
          >
            getskiplines@gmail.com
          </a>{" "}
          or contacting us via the{" "}
          <Link
            href="/contact"
            className="font-medium text-teal-700 underline hover:text-teal-600"
          >
            Contact Us
          </Link>{" "}
          page. Upon cancellation:
        </p>
        <ul className="mt-3 list-disc space-y-2 pl-5">
          <li>
            Your subscription will remain active until the end of the current
            billing period.
          </li>
          <li>
            No further charges will be applied after cancellation is confirmed.
          </li>
          <li>
            Dashboard and queue features will be disabled after the billing
            period ends.
          </li>
        </ul>
      </section>

      <section>
        <h2 className="text-lg font-semibold text-teal-950">4. Refund Eligibility</h2>
        <p className="mt-2">Refunds for clinic subscription payments may be issued when:</p>
        <ul className="mt-3 list-disc space-y-2 pl-5">
          <li>
            A duplicate payment was charged due to a technical error on our
            side.
          </li>
          <li>
            The Service was unavailable for more than 48 consecutive hours
            during your paid billing period and the issue was not resolved after
            you reported it to support.
          </li>
          <li>
            You cancel within 7 days of your first paid subscription charge
            (after the free trial) and have not materially used paid features.
          </li>
        </ul>
        <p className="mt-3">
          Refunds are <strong>not</strong> provided for partial months of
          service, change of mind after the refund window, or issues caused by
          third-party services (WhatsApp, internet connectivity, clinic
          hardware).
        </p>
      </section>

      <section>
        <h2 className="text-lg font-semibold text-teal-950">
          5. Refund Processing Timeline
        </h2>
        <p className="mt-2">
          Approved refunds are processed within{" "}
          <strong>5–7 working days</strong> to the original payment method used
          at checkout. Refunds are initiated through{" "}
          <strong>Cashfree Payments</strong>, our authorised payment gateway
          partner. Depending on your bank or card issuer, it may take an
          additional 3–5 working days for the amount to reflect in your
          account.
        </p>
        <p className="mt-3">
          You will receive an email confirmation at{" "}
          <a
            href="mailto:getskiplines@gmail.com"
            className="font-medium text-teal-700 underline hover:text-teal-600"
          >
            getskiplines@gmail.com
          </a>{" "}
          once a refund is initiated, including the refund reference number from
          Cashfree where applicable.
        </p>
      </section>

      <section>
        <h2 className="text-lg font-semibold text-teal-950">
          6. How to Request a Refund
        </h2>
        <ol className="mt-2 list-decimal space-y-2 pl-5">
          <li>
            Email{" "}
            <a
              href="mailto:getskiplines@gmail.com"
              className="font-medium text-teal-700 underline hover:text-teal-600"
            >
              getskiplines@gmail.com
            </a>{" "}
            with subject line: <strong>Refund Request</strong>.
          </li>
          <li>
            Include your clinic name, registered email, Cashfree order ID (if
            available), payment date, and reason for the refund request.
          </li>
          <li>
            Our support team will review your request and respond within 3
            business days.
          </li>
        </ol>
      </section>

      <section>
        <h2 className="text-lg font-semibold text-teal-950">7. Contact</h2>
        <p className="mt-2">
          For refund or cancellation queries, visit our{" "}
          <Link
            href="/contact"
            className="font-medium text-teal-700 underline hover:text-teal-600"
          >
            Contact Us
          </Link>{" "}
          page or call <strong>+91 70372 19290</strong>.
        </p>
      </section>
    </LegalPageLayout>
  );
}
