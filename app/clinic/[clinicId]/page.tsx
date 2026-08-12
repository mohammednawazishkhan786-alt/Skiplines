import { notFound } from "next/navigation";
import { ClinicBooking } from "@/app/clinic/[clinicId]/clinic-booking";
import { getPublicClinicOrThrow } from "@/lib/clinic-access";

type ClinicPageProps = {
  params: Promise<{ clinicId: string }>;
};

export default async function ClinicPage({ params }: ClinicPageProps) {
  const { clinicId } = await params;
  const { clinic } = await getPublicClinicOrThrow(clinicId);

  if (!clinic) {
    notFound();
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-b from-teal-50 to-white px-6">
      <ClinicBooking
        clinicId={clinic.id}
        clinicName={clinic.clinic_name}
        doctorName={clinic.doctor_name}
      />
    </div>
  );
}
