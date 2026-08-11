import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-b from-teal-50 to-white px-6 text-center">
      <p className="text-sm font-medium uppercase tracking-wide text-teal-600">
        404
      </p>
      <h1 className="mt-2 text-3xl font-bold text-teal-950">Page not found</h1>
      <p className="mt-3 max-w-md text-teal-800/80">
        The page you are looking for does not exist or may have moved.
      </p>
      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <Link
          href="/"
          className="rounded-full bg-teal-700 px-6 py-3 font-semibold text-white hover:bg-teal-600"
        >
          Go Home
        </Link>
        <Link
          href="/login"
          className="rounded-full border border-teal-200 px-6 py-3 font-semibold text-teal-800 hover:bg-teal-50"
        >
          Doctor Login
        </Link>
      </div>
    </div>
  );
}
