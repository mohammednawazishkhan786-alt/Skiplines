-- 019: One waiting token per normalized patient phone per clinic.
-- Production pre-check (2026-08-12): 2 waiting tokens, 0 normalized duplicate groups.
-- Does NOT modify or delete existing rows (including NULL-phone waiting tokens).

-- Abort if normalized duplicate waiting rows already exist (manual cleanup required first).
do $$
declare
  v_duplicate_groups integer;
begin
  select count(*)::integer
    into v_duplicate_groups
  from (
    select clinic_id, right(regexp_replace(patient_phone, '\D', '', 'g'), 10) as normalized_phone
    from public.tokens
    where status = 'waiting'
      and patient_phone is not null
      and btrim(patient_phone) <> ''
    group by clinic_id, right(regexp_replace(patient_phone, '\D', '', 'g'), 10)
    having count(*) > 1
  ) dups;

  if v_duplicate_groups > 0 then
    raise exception
      'Cannot create tokens_one_waiting_per_phone_per_clinic: % duplicate waiting phone group(s) exist. Clean up first.',
      v_duplicate_groups;
  end if;
end $$;

create unique index if not exists tokens_one_waiting_per_phone_per_clinic
  on public.tokens (clinic_id, patient_phone)
  where status = 'waiting' and patient_phone is not null;

-- ---------------------------------------------------------------------------
-- Atomic join: return existing waiting token for same phone when present
-- ---------------------------------------------------------------------------
create or replace function public.join_queue_atomic(
  p_clinic_id uuid,
  p_patient_name text,
  p_patient_phone text,
  p_is_emergency boolean default false,
  p_avg_time_per_patient integer default 10
)
returns public.tokens
language plpgsql
security definer
set search_path = public
as $$
declare
  v_next_token integer;
  v_queue_position integer;
  v_waiting_ahead integer;
  v_entry public.tokens;
  v_est timestamptz;
begin
  if p_clinic_id is null then
    raise exception 'clinic_id is required';
  end if;

  -- Serialize joins for this clinic across concurrent requests
  perform pg_advisory_xact_lock(hashtext(p_clinic_id::text));

  if p_patient_phone is not null and btrim(p_patient_phone) <> '' then
    select *
      into v_entry
    from public.tokens
    where clinic_id = p_clinic_id
      and patient_phone = p_patient_phone
      and status = 'waiting'
    order by created_at asc
    limit 1;

    if found then
      return v_entry;
    end if;
  end if;

  select coalesce(max(token_number), 0) + 1
    into v_next_token
  from public.tokens
  where clinic_id = p_clinic_id;

  if coalesce(p_is_emergency, false) then
    select coalesce(min(queue_position), 1)
      into v_queue_position
    from public.tokens
    where clinic_id = p_clinic_id
      and status = 'waiting';

    update public.tokens
       set queue_position = queue_position + 1
     where clinic_id = p_clinic_id
       and status = 'waiting';
  else
    select coalesce(max(queue_position), 0) + 1
      into v_queue_position
    from public.tokens
    where clinic_id = p_clinic_id
      and status = 'waiting';
  end if;

  select count(*)::integer
    into v_waiting_ahead
  from public.tokens
  where clinic_id = p_clinic_id
    and status = 'waiting';

  v_est := now() + (greatest(v_waiting_ahead, 0) * greatest(p_avg_time_per_patient, 1) || ' minutes')::interval;

  insert into public.tokens (
    clinic_id,
    token_number,
    queue_position,
    status,
    patient_phone,
    patient_name,
    is_emergency,
    estimated_call_at
  ) values (
    p_clinic_id,
    v_next_token,
    v_queue_position,
    'waiting',
    p_patient_phone,
    p_patient_name,
    coalesce(p_is_emergency, false),
    v_est
  )
  returning * into v_entry;

  return v_entry;
end;
$$;

revoke all on function public.join_queue_atomic(uuid, text, text, boolean, integer) from public;
revoke all on function public.join_queue_atomic(uuid, text, text, boolean, integer) from anon, authenticated;
grant execute on function public.join_queue_atomic(uuid, text, text, boolean, integer) to service_role;
