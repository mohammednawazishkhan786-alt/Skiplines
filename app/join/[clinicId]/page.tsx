import { notFound } from "next/navigation";
import { JoinForm } from "@/app/join/[clinicId]/join-form";
import { getPublicClinicOrThrow } from "@/lib/clinic-access";

type JoinPageProps = {
  params: Promise<{ clinicId: string }>;
};

export default async function JoinPage({ params }: JoinPageProps) {
  const { clinicId } = await params;
  const { clinic } = await getPublicClinicOrThrow(clinicId);

  if (!clinic) {
    notFound();
  }

  return <JoinForm clinicId={clinic.id} />;
}
