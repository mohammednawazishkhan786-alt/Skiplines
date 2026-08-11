import Link from "next/link";
import { Stethoscope } from "lucide-react";

const LEGAL_LINKS = [
  { href: "/terms", label: "Terms & Conditions" },
  { href: "/privacy", label: "Privacy Policy" },
  { href: "/refund-policy", label: "Refund & Cancellation Policy" },
  { href: "/contact", label: "Contact Us" },
  { href: "/data-deletion", label: "Data Deletion" },
] as const;

export function SiteFooter() {
  return (
    <footer className="mt-auto border-t border-teal-100 bg-white">
      <div className="mx-auto max-w-5xl px-6 py-10">
        <div className="flex flex-col gap-8 sm:flex-row sm:justify-between">
          <div>
            <Link
              href="/"
              className="flex items-center gap-2 font-semibold text-teal-800"
            >
              <Stethoscope className="h-5 w-5" />
              Skiplines
            </Link>
            <p className="mt-2 max-w-sm text-sm text-teal-800/70">
              OPD Token &amp; Queue Management platform for clinics and doctors
              across India.
            </p>
          </div>

          <div>
            <h2 className="text-sm font-semibold uppercase tracking-wide text-teal-950">
              Legal &amp; Policies
            </h2>
            <ul className="mt-3 space-y-2 text-sm">
              {LEGAL_LINKS.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="text-teal-800 hover:text-teal-600 hover:underline"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h2 className="text-sm font-semibold uppercase tracking-wide text-teal-950">
              Support
            </h2>
            <ul className="mt-3 space-y-2 text-sm text-teal-800/80">
              <li>
                <a
                  href="mailto:getskiplines@gmail.com"
                  className="hover:text-teal-600 hover:underline"
                >
                  getskiplines@gmail.com
                </a>
              </li>
              <li>
                <a
                  href="tel:+917037219290"
                  className="hover:text-teal-600 hover:underline"
                >
                  +91 70372 19290
                </a>
              </li>
            </ul>
          </div>
        </div>

        <p className="mt-8 border-t border-teal-100 pt-6 text-center text-xs text-teal-700/70">
          © {new Date().getFullYear()} Skiplines. All rights reserved.
        </p>
      </div>
    </footer>
  );
}
