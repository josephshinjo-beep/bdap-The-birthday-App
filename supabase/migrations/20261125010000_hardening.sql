-- bdap: hardening and small additions on top of the init migration.

-- ---------------------------------------------------------------------------
-- 1. Column-level write limits
-- ---------------------------------------------------------------------------
-- Admins may edit room settings, but never the code (regenerate_room_code) or owner.
revoke update on public.rooms from anon, authenticated;
grant update (name, amount_mode, amount, payers_per_upi,
              remind_week_before, remind_day_before, remind_on_day)
  on public.rooms to authenticated;

-- Users may only mark their own notifications read.
revoke update on public.notifications from anon, authenticated;
grant update (read_at) on public.notifications to authenticated;

-- Profiles: avatar and names are editable, the id is not.
revoke update on public.profiles from anon, authenticated;
grant update (full_name, username, dob, avatar_url) on public.profiles to authenticated;

-- Birthdays must be in the past and realistic.
alter table public.profiles
  add constraint profiles_dob_past check (dob <= current_date);

-- UPI accounts: an owner must be a member of the room (or null).
create or replace function public.check_upi_owner()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.owner_user_id is not null and not exists (
    select 1 from memberships where room_id = new.room_id and user_id = new.owner_user_id and status = 'approved'
  ) then
    raise exception 'invalid_input: UPI owner must be an approved member of the room';
  end if;
  return new;
end;
$$;
create trigger room_upi_owner_check before insert or update of owner_user_id on public.room_upi_accounts
  for each row execute function public.check_upi_owner();

-- ---------------------------------------------------------------------------
-- 2. Function privileges: nothing is callable without signing in
-- ---------------------------------------------------------------------------
revoke execute on all functions in schema public from public, anon;
grant execute on all functions in schema public to authenticated, service_role;
revoke execute on function public.prepare_reminders(date, public.notification_kind) from authenticated;
revoke execute on function public.generate_room_code() from authenticated;
alter default privileges in schema public revoke execute on functions from public, anon;

-- ---------------------------------------------------------------------------
-- 3. Celebrations exist as soon as someone looks at the room
-- ---------------------------------------------------------------------------
-- The cron job creates celebrations daily; this lets a room page create the
-- next week's celebrations right away (e.g. a room made today for a birthday
-- tomorrow). Returns nothing, so it reveals nothing.
create or replace function public.ensure_room_celebrations(p_room uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v_today date := (now() at time zone 'Asia/Kolkata')::date;
begin
  if not public.is_room_member(p_room) then raise exception 'not_allowed'; end if;
  insert into celebrations (room_id, birthday_user_id, celebration_date, status)
  select m.room_id, m.user_id, public.next_birthday(p.dob, v_today),
         case when public.next_birthday(p.dob, v_today) = v_today then 'live'::celebration_status else 'upcoming' end
  from memberships m join profiles p on p.id = m.user_id
  where m.room_id = p_room and m.status = 'approved'
    and public.next_birthday(p.dob, v_today) <= v_today + 7
  on conflict do nothing;
  update celebrations set status = 'live' where room_id = p_room and celebration_date = v_today and status = 'upcoming';
  update celebrations set status = 'done' where room_id = p_room and celebration_date < v_today and status <> 'done';
end;
$$;
grant execute on function public.ensure_room_celebrations(uuid) to authenticated;

-- mark_paid: in fixed-amount rooms the amount is the room's, not the payer's.
create or replace function public.mark_paid(p_celebration uuid, p_paid boolean, p_amount integer default null)
returns void language plpgsql security definer set search_path = public as $$
declare v_cel celebrations%rowtype; v_mode amount_mode;
begin
  select * into v_cel from celebrations where id = p_celebration;
  if not found or v_cel.birthday_user_id = auth.uid() or not public.is_room_member(v_cel.room_id) then
    raise exception 'not_found';
  end if;
  select amount_mode into v_mode from rooms where id = v_cel.room_id;
  if v_mode = 'fixed' then p_amount := null; end if;
  if p_amount is not null and (p_amount < 1 or p_amount > 100000) then raise exception 'invalid_input'; end if;
  insert into contributions (celebration_id, user_id, amount, marked_paid_at)
  values (p_celebration, auth.uid(), p_amount, case when p_paid then now() end)
  on conflict on constraint contributions_pkey do update
    set marked_paid_at = case when p_paid then coalesce(contributions.marked_paid_at, now()) end,
        amount = coalesce(excluded.amount, contributions.amount);
end;
$$;

-- ---------------------------------------------------------------------------
-- 4. Storage for uploaded UPI QR images
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('upi-qr', 'upi-qr', true, 2097152, array['image/png', 'image/jpeg', 'image/webp'])
on conflict (id) do nothing;

-- Uploads go into a folder named after the uploader's user id.
create policy upi_qr_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'upi-qr' and (storage.foldername(name))[1] = auth.uid()::text);
create policy upi_qr_delete on storage.objects for delete to authenticated
  using (bucket_id = 'upi-qr' and (storage.foldername(name))[1] = auth.uid()::text);
