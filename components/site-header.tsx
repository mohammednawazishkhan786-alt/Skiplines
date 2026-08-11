import Link from "next/link";
import { Stethoscope } from "lucide-react";

export function SiteHeader() {
  return (
    <header className="border-b border-teal-100 bg-white/90 backdrop-blur">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
        <Link href="/" className="flex items-center gap-2 font-semibold text-teal-800">
          <Stethoscope className="h-5 w-5" />
          Skiplines
        </Link>
        <nav className="flex items-center gap-4 text-sm font-medium text-teal-900">
          <Link href="/login" className="hover:text-teal-600">
            Sign In
          </Link>
          <Link href="/register" className="hover:text-teal-600">
            Register
          </Link>
          <Link
            href="/dashboard"
            className="rounded-full bg-teal-700 px-4 py-2 text-white hover:bg-teal-600"
          >
            Dashboard
          </Link>
        </nav>
      </div>
    </header>
  );
}
