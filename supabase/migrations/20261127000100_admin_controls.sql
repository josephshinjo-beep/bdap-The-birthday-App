-- bdap: admin controls.
--   * Admins decide per birthday: celebrate (secret reminders + UPI) or just wish.
--     Nothing about a celebration goes to members until an admin approves it.
--   * Custom reminder times per room (India time).
--   * A "happy birthday" from the room to the birthday person on the day.
--   * Admins can delete the room (moderator) and UPI IDs.
-- Run AFTER 20261127000000_notification_kinds.sql.

-- ---------------------------------------------------------------------------
-- 1. Schema
-- ---------------------------------------------------------------------------
create type public.celebration_decision as enum ('pending', 'celebrate', 'wish_only');

alter table public.celebrations
  add column decision    public.celebration_decision not null default 'pending',
  add column decided_by  uuid references public.profiles (id) on delete set null,
  add column decided_at  timestamptz;

alter table public.rooms
  add column remind_week_before_at time not null default '18:00',
  add column remind_day_before_at  time not null default '18:00',
  add column remind_on_day_at      time not null default '07:30',
  add column send_birthday_wish    boolean not null default true,
  add column auto_celebrate        boolean not null default false;

-- Admins may edit the new settings (column-level, like the others).
grant update (remind_week_before_at, remind_day_before_at, remind_on_day_at, send_birthday_wish, auto_celebrate)
  on public.rooms to authenticated;

-- ---------------------------------------------------------------------------
-- 2. Visibility: members only see approved celebrations; admins see all
--    (still never their own birthday).
-- ---------------------------------------------------------------------------
drop policy if exists celebrations_select on public.celebrations;
create policy celebrations_select on public.celebrations for select using (
  public.is_room_member(room_id)
  and birthday_user_id <> auth.uid()
  and (decision = 'celebrate' or public.is_room_admin(room_id))
);

-- ---------------------------------------------------------------------------
-- 3. Admin actions
-- ---------------------------------------------------------------------------
create or replace function public.set_celebration_decision(p_celebration uuid, p_decision public.celebration_decision)
returns void language plpgsql security definer set search_path = public as $$
declare v_cel celebrations%rowtype;
begin
  select * into v_cel from celebrations where id = p_celebration;
  if not found or v_cel.birthday_user_id = auth.uid() or not public.is_room_admin(v_cel.room_id) then
    raise exception 'not_allowed';
  end if;
  update celebrations
     set decision = p_decision,
         decided_by = case when p_decision = 'pending' then null else auth.uid() end,
         decided_at = case when p_decision = 'pending' then null else now() end
   where id = p_celebration;
end;
$$;

create or replace function public.delete_room(p_room uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_room_moderator(p_room) then raise exception 'not_allowed'; end if;
  delete from rooms where id = p_room;
end;
$$;

-- Celebrations for the next 30 days, so admins can decide early.
create or replace function public.ensure_room_celebrations(p_room uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v_today date := (now() at time zone 'Asia/Kolkata')::date;
begin
  if not public.is_room_member(p_room) then raise exception 'not_allowed'; end if;
  insert into celebrations (room_id, birthday_user_id, celebration_date, status, decision)
  select m.room_id, m.user_id, public.next_birthday(p.dob, v_today),
         case when public.next_birthday(p.dob, v_today) = v_today then 'live'::celebration_status else 'upcoming' end,
         case when r.auto_celebrate then 'celebrate'::celebration_decision else 'pending' end
  from memberships m
  join profiles p on p.id = m.user_id
  join rooms r on r.id = m.room_id
  where m.room_id = p_room and m.status = 'approved'
    and public.next_birthday(p.dob, v_today) <= v_today + 30
  on conflict do nothing;
  update celebrations set status = 'live' where room_id = p_room and celebration_date = v_today and status = 'upcoming';
  update celebrations set status = 'done' where room_id = p_room and celebration_date < v_today and status <> 'done';
end;
$$;

-- ---------------------------------------------------------------------------
-- 4. The surprise, pool and payments only exist for approved celebrations
-- ---------------------------------------------------------------------------
create or replace function public.open_surprise(p_celebration uuid)
returns table (
  celebration_id uuid, room_id uuid, birthday_name text, celebration_date date,
  upi_account_id uuid, upi_id text, payee_name text, qr_image_url text,
  amount_mode public.amount_mode, amount integer, all_upi_full boolean,
  my_paid_at timestamptz, my_amount integer
)
language plpgsql security definer set search_path = public as $$
declare
  v_cel celebrations%rowtype;
  v_room rooms%rowtype;
  v_contrib contributions%rowtype;
  v_acc_id uuid;
  v_full boolean := false;
begin
  select * into v_cel from celebrations where id = p_celebration;
  if not found or v_cel.birthday_user_id = auth.uid() or not public.is_room_member(v_cel.room_id)
     or v_cel.decision <> 'celebrate' then
    raise exception 'not_found';
  end if;
  select * into v_room from rooms where id = v_cel.room_id;

  select * into v_contrib from contributions c where c.celebration_id = p_celebration and c.user_id = auth.uid();
  if found and v_contrib.upi_account_id is not null
     and exists (select 1 from room_upi_accounts a where a.id = v_contrib.upi_account_id and a.active) then
    v_acc_id := v_contrib.upi_account_id;
  else
    perform pg_advisory_xact_lock(hashtext(p_celebration::text));
    select a.id, (coalesce(cnt.n, 0) >= v_room.payers_per_upi)
      into v_acc_id, v_full
    from room_upi_accounts a
    left join lateral (
      select count(*) as n from contributions c
      where c.celebration_id = p_celebration and c.upi_account_id = a.id
    ) cnt on true
    where a.room_id = v_cel.room_id and a.active
      and a.owner_user_id is distinct from v_cel.birthday_user_id
    order by (coalesce(cnt.n, 0) >= v_room.payers_per_upi),
             case when coalesce(cnt.n, 0) >= v_room.payers_per_upi then cnt.n else 0 end,
             a.sort_order, a.created_at
    limit 1;

    insert into contributions (celebration_id, user_id, upi_account_id)
    values (p_celebration, auth.uid(), v_acc_id)
    on conflict on constraint contributions_pkey do update set upi_account_id = excluded.upi_account_id
    returning * into v_contrib;

    if v_full then
      insert into notifications (user_id, room_id, celebration_id, kind, title, body, url)
      select m.user_id, v_room.id, p_celebration, 'upi_full', 'All UPI IDs are full',
             'Every UPI ID in ' || v_room.name || ' has reached ' || v_room.payers_per_upi || ' payers. Add another one.',
             '/rooms/' || v_room.id || '/manage/edit'
      from memberships m
      where m.room_id = v_room.id and m.status = 'approved' and m.role in ('moderator', 'co_moderator')
        and m.user_id <> v_cel.birthday_user_id
      on conflict do nothing;
    end if;
  end if;

  return query
  select v_cel.id, v_cel.room_id, p.full_name, v_cel.celebration_date,
         a.id, a.upi_id, a.payee_name, a.qr_image_url,
         v_room.amount_mode, v_room.amount, v_full,
         v_contrib.marked_paid_at, v_contrib.amount
  from profiles p
  left join room_upi_accounts a on a.id = v_acc_id
  where p.id = v_cel.birthday_user_id;
end;
$$;

create or replace function public.mark_paid(p_celebration uuid, p_paid boolean, p_amount integer default null)
returns void language plpgsql security definer set search_path = public as $$
declare v_cel celebrations%rowtype; v_mode amount_mode;
begin
  select * into v_cel from celebrations where id = p_celebration;
  if not found or v_cel.birthday_user_id = auth.uid() or not public.is_room_member(v_cel.room_id)
     or v_cel.decision <> 'celebrate' then
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

create or replace function public.celebration_pool(p_celebration uuid)
returns table (paid_count integer, eligible_count integer, total_amount integer)
language plpgsql stable security definer set search_path = public as $$
declare v_cel celebrations%rowtype; v_room rooms%rowtype;
begin
  select * into v_cel from celebrations where id = p_celebration;
  if not found or v_cel.birthday_user_id = auth.uid() or not public.is_room_member(v_cel.room_id)
     or (v_cel.decision <> 'celebrate' and not public.is_room_admin(v_cel.room_id)) then
    raise exception 'not_found';
  end if;
  select * into v_room from rooms where id = v_cel.room_id;
  return query
  select
    (select count(*)::int from contributions c where c.celebration_id = p_celebration and c.marked_paid_at is not null),
    (select count(*)::int from memberships m where m.room_id = v_cel.room_id and m.status = 'approved'
        and m.user_id <> v_cel.birthday_user_id),
    (select coalesce(sum(coalesce(c.amount, v_room.amount, 0)), 0)::int from contributions c
        where c.celebration_id = p_celebration and c.marked_paid_at is not null);
end;
$$;

-- ---------------------------------------------------------------------------
-- 5. The reminder job (runs every 15 minutes; mirrors src/lib/reminders.ts)
-- ---------------------------------------------------------------------------
-- Creates the next 30 days of celebrations, moves statuses along, and inserts
-- every notification that is due by now. Returns only rows created by this
-- call, so running it often never sends anything twice.
create or replace function public.prepare_due_reminders(p_now timestamptz default now())
returns table (notification_id uuid, user_id uuid, title text, body text, url text)
language plpgsql security definer set search_path = public as $$
declare
  v_today date := (p_now at time zone 'Asia/Kolkata')::date;
  v_time  time := (p_now at time zone 'Asia/Kolkata')::time;
begin
  insert into celebrations (room_id, birthday_user_id, celebration_date, status, decision)
  select m.room_id, m.user_id, public.next_birthday(p.dob, v_today),
         case when public.next_birthday(p.dob, v_today) = v_today then 'live'::celebration_status else 'upcoming' end,
         case when r.auto_celebrate then 'celebrate'::celebration_decision else 'pending' end
  from memberships m
  join profiles p on p.id = m.user_id
  join rooms r on r.id = m.room_id
  where m.status = 'approved' and public.next_birthday(p.dob, v_today) <= v_today + 30
  on conflict do nothing;

  update celebrations set status = 'live' where celebration_date = v_today and status = 'upcoming';
  update celebrations set status = 'done' where celebration_date < v_today and status <> 'done';

  return query
  with c as (
    select cel.id as cel_id, cel.room_id, cel.birthday_user_id as bday_id, cel.decision,
           cel.celebration_date - v_today as days,
           r.name as room_name, r.remind_week_before, r.remind_day_before, r.remind_on_day,
           r.remind_week_before_at, r.remind_day_before_at, r.remind_on_day_at, r.send_birthday_wish,
           split_part(bp.full_name, ' ', 1) as first
    from celebrations cel
    join rooms r on r.id = cel.room_id
    join profiles bp on bp.id = cel.birthday_user_id
    join memberships bm on bm.room_id = cel.room_id and bm.user_id = cel.birthday_user_id and bm.status = 'approved'
    where cel.celebration_date between v_today and v_today + 30
  ),
  member_kinds as (
    select c.*, k.kind
    from c
    cross join lateral (values
      (case when c.decision = 'celebrate' and c.days = 7 and c.remind_week_before and v_time >= c.remind_week_before_at then 'week_before' end),
      (case when c.decision = 'celebrate' and c.days = 1 and c.remind_day_before and v_time >= c.remind_day_before_at then 'day_before' end),
      (case when c.decision = 'celebrate' and c.days = 0 and c.remind_on_day and v_time >= c.remind_on_day_at then 'on_day' end),
      (case when c.decision <> 'celebrate' and c.days = 0 and c.remind_on_day and v_time >= c.remind_on_day_at then 'wish_reminder' end)
    ) as k(kind)
    where k.kind is not null
  ),
  due as (
    -- reminders to members (never the birthday person)
    select m.user_id, mk.room_id, mk.cel_id, mk.kind::notification_kind as kind,
      case mk.kind
        when 'week_before'   then mk.first || '''s birthday is in a week'
        when 'day_before'    then 'Psst. ' || mk.first || '''s birthday is tomorrow'
        when 'on_day'        then 'Today is ' || mk.first || '''s birthday!'
        else 'It''s ' || mk.first || '''s birthday today 🎂' end as title,
      case mk.kind
        when 'week_before'   then 'Start planning in ' || mk.room_name || '. Don''t tell ' || mk.first || '.'
        when 'day_before'    then 'A gift is waiting for you to unwrap. Don''t tell ' || mk.first || '.'
        when 'on_day'        then 'Chip in and wish ' || mk.first || ' before class.'
        else 'Send ' || mk.first || ' a wish. No collection this time.' end as body,
      case when mk.kind = 'wish_reminder' then '/rooms/' || mk.room_id
           else '/rooms/' || mk.room_id || '/surprise/' || mk.cel_id end as url
    from member_kinds mk
    join memberships m on m.room_id = mk.room_id and m.status = 'approved' and m.user_id <> mk.bday_id

    union all
    -- a happy birthday to the birthday person
    select c.bday_id, c.room_id, c.cel_id, 'birthday_wish'::notification_kind,
           'Happy birthday, ' || c.first || '! 🎉',
           'Everyone in ' || c.room_name || ' is wishing you a wonderful day.',
           '/rooms/' || c.room_id
    from c
    where c.days = 0 and c.send_birthday_wish and v_time >= c.remind_on_day_at

    union all
    -- ask the admins to decide (once per birthday)
    select m.user_id, c.room_id, c.cel_id, 'decision_needed'::notification_kind,
           'Celebrate ' || c.first || '''s birthday?',
           'Choose "Celebrate" or "Just wish" in ' || c.room_name || '. Nothing goes out until you decide.',
           '/rooms/' || c.room_id || '/manage?tab=birthdays'
    from c
    join memberships m on m.room_id = c.room_id and m.status = 'approved'
      and m.role in ('moderator', 'co_moderator') and m.user_id <> c.bday_id
    where c.decision = 'pending'
  ),
  ins as (
    insert into notifications (user_id, room_id, celebration_id, kind, title, body, url)
    select d.user_id, d.room_id, d.cel_id, d.kind, d.title, d.body, d.url from due d
    on conflict do nothing
    returning notifications.id, notifications.user_id, notifications.title, notifications.body, notifications.url
  )
  select ins.id, ins.user_id, ins.title, ins.body, ins.url from ins;
end;
$$;

revoke execute on function public.prepare_due_reminders(timestamptz) from public, anon, authenticated;
grant execute on function public.prepare_due_reminders(timestamptz) to service_role;
grant execute on function public.set_celebration_decision(uuid, public.celebration_decision) to authenticated;
grant execute on function public.delete_room(uuid) to authenticated;
