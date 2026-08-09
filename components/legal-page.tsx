import Link from "next/link";
import { SiteHeader } from "@/components/site-header";

type LegalPageLayoutProps = {
  title: string;
  description?: string;
  lastUpdated: string;
  children: React.ReactNode;
};

export function LegalPageLayout({
  title,
  description,
  lastUpdated,
  children,
}: LegalPageLayoutProps) {
  return (
    <div className="min-h-screen bg-gradient-to-b from-teal-50 to-white">
      <SiteHeader />
      <main className="mx-auto max-w-3xl px-6 py-12">
        <h1 className="text-3xl font-bold tracking-tight text-teal-950">
          {title}
        </h1>
        {description ? (
          <p className="mt-2 text-sm text-teal-800/80">{description}</p>
        ) : null}
        <p className="mt-2 text-sm text-teal-800/70">
          Last updated: {lastUpdated}
        </p>

        <div className="mt-8 space-y-8 text-sm leading-7 text-teal-900/90">
          {children}
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
