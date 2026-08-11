-- Enforce permanent unique clinic_id (clinics.id) at the database level.

create unique index if not exists clinics_clinic_id_unique_idx
  on public.clinics (id);

comment on index public.clinics_clinic_id_unique_idx is
  'Guarantees each clinic_id (clinics.id) is globally unique for patient QR URLs.';

create or replace function public.prevent_clinic_id_change()
returns trigger
language plpgsql
as $$
begin
  if old.id is distinct from new.id then
    raise exception 'clinic_id cannot be changed once assigned';
  end if;
  return new;
end;
$$;

drop trigger if exists clinics_prevent_id_change on public.clinics;

create trigger clinics_prevent_id_change
  before update on public.clinics
  for each row
  execute function public.prevent_clinic_id_change();
