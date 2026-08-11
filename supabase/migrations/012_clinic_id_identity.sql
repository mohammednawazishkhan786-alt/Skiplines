-- Document permanent unique clinic identity used by patient QR URLs.
-- clinics.id is already the primary key (uuid, default gen_random_uuid()).

comment on column public.clinics.id is
  'Permanent globally unique clinic identifier. Assigned once by the database at registration. Used in patient QR URLs as /clinic/{id}. Never derived from personal data.';
