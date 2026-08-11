import { ClinicBooking } from "@/app/clinic/[clinicId]/clinic-booking";
import { getPublicClinicOrThrow } from "@/lib/clinic-access";

type ClinicPageProps = {
  params: Promise<{ clinicId: string }>;
};

export default async function ClinicPage({ params }: ClinicPageProps) {
  const { clinicId } = await params;
  const { clinic, error } = await getPublicClinicOrThrow(clinicId);

  if (!clinic) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-b from-teal-50 to-white px-6">
        <div className="w-full max-w-md rounded-3xl border border-red-200 bg-red-50 p-8 text-center text-red-700 shadow-sm">
          {error ?? "Clinic not found."}
        </div>
      </div>
    );
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
