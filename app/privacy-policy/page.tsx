import { redirect } from "next/navigation";

export const metadata = {
  title: "Privacy Policy",
  alternates: { canonical: "/privacy" },
};

export default function PrivacyPolicyAliasPage() {
  redirect("/privacy");
}
