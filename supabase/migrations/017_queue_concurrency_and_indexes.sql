-- 017: Queue concurrency + performance indexes
-- Atomic join / call-next via SECURITY DEFINER RPCs (service_role only).
-- Does NOT drop legacy objects (queue_entries, phone_otp, razorpay column).

-- Hot-path index for waiting / called queue queries
create index if not exists tokens_clinic_id_status_idx
  on public.tokens (clinic_id, status);

create index if not exists tokens_clinic_id_status_position_idx
  on public.tokens (clinic_id, status, queue_position);

-- ---------------------------------------------------------------------------
-- Atomic join: advisory lock per clinic prevents duplicate token numbers
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

-- ---------------------------------------------------------------------------
-- Atomic call-next: lock clinic, complete current, call earliest waiting
-- ---------------------------------------------------------------------------
create or replace function public.call_next_patient_atomic(
  p_clinic_id uuid
)
returns public.tokens
language plpgsql
security definer
set search_path = public
as $$
declare
  v_current_id uuid;
  v_next public.tokens;
begin
  if p_clinic_id is null then
    raise exception 'clinic_id is required';
  end if;

  perform pg_advisory_xact_lock(hashtext('call_next:' || p_clinic_id::text));

  select id
    into v_current_id
  from public.tokens
  where clinic_id = p_clinic_id
    and status = 'called'
  order by created_at desc
  limit 1
  for update skip locked;

  if v_current_id is not null then
    update public.tokens
       set status = 'completed',
           completed_at = now()
     where id = v_current_id;
  end if;

  select *
    into v_next
  from public.tokens
  where clinic_id = p_clinic_id
    and status = 'waiting'
  order by queue_position asc
  limit 1
  for update skip locked;

  if v_next.id is null then
    raise exception 'NO_WAITING_PATIENTS';
  end if;

  update public.tokens
     set status = 'called'
   where id = v_next.id
  returning * into v_next;

  update public.clinics
     set current_token = v_next.token_number
   where id = p_clinic_id;

  return v_next;
end;
$$;

revoke all on function public.call_next_patient_atomic(uuid) from public;
revoke all on function public.call_next_patient_atomic(uuid) from anon, authenticated;
grant execute on function public.call_next_patient_atomic(uuid) to service_role;
