-- bdap: admins can fix a member's birthday in their room, and start a birthday by hand.
--
-- People sometimes enter a fake date of birth, and it's locked once saved. An admin
-- (moderator or co-moderator) can now set the right month and day for that person
-- in their own room only: the profile and other rooms are untouched. An admin can
-- also start someone's birthday celebration today, whatever date they entered.
-- Admins can't do either for themselves, the same rule as deciding celebrations.
-- Safe to run more than once.

-- ---------------------------------------------------------------------------
-- 1. Room-only birthday (month and day; the year is always 2000 so 29 Feb works)
-- ---------------------------------------------------------------------------
alter table public.memberships
  add column if not exists room_dob        date check (room_dob is null or extract(year from room_dob) = 2000),
  add column if not exists room_dob_set_by uuid references public.profiles (id) on delete set null,
  add column if not exists room_dob_set_at timestamptz;

-- ---------------------------------------------------------------------------
-- 2. Everything that works out birthdays now prefers the room date
-- ---------------------------------------------------------------------------
drop function if exists public.room_members(uuid);
create function public.room_members(p_room uuid)
returns table (
  user_id uuid, full_name text, username text, avatar_url text,
  birth_month integer, birth_day integer, birthday_edited boolean,
  role public.member_role, status public.member_status, requested_at timestamptz
)
language sql stable security definer set search_path = public as $$
  select p.id, p.full_name, p.username, p.avatar_url,
         extract(month from coalesce(m.room_dob, p.dob))::int, extract(day from coalesce(m.room_dob, p.dob))::int, m.room_dob is not null,
         m.role, m.status, m.requested_at
  from memberships m join profiles p on p.id = m.user_id
  where m.room_id = p_room
    and public.is_room_member(p_room)
    and (m.status = 'approved' or public.is_room_admin(p_room))
  order by m.status, p.full_name;
$$;
revoke execute on function public.room_members(uuid) from public, anon;
grant execute on function public.room_members(uuid) to authenticated;

create or replace function public.ensure_room_celebrations(p_room uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v_today date := (now() at time zone 'Asia/Kolkata')::date;
begin
  if not public.is_room_member(p_room) then raise exception 'not_allowed'; end if;
  insert into celebrations (room_id, birthday_user_id, celebration_date, status, decision)
  select m.room_id, m.user_id, public.next_birthday(coalesce(m.room_dob, p.dob), v_today),
         case when public.next_birthday(coalesce(m.room_dob, p.dob), v_today) = v_today then 'live'::celebration_status else 'upcoming' end,
         case when r.auto_celebrate then 'celebrate'::celebration_decision else 'pending' end
  from memberships m
  join profiles p on p.id = m.user_id
  join rooms r on r.id = m.room_id
  where m.room_id = p_room and m.status = 'approved'
    and public.next_birthday(coalesce(m.room_dob, p.dob), v_today) <= v_today + 30
  on conflict do nothing;
  update celebrations set status = 'live' where room_id = p_room and celebration_date = v_today and status = 'upcoming';
  update celebrations set status = 'done' where room_id = p_room and celebration_date < v_today and status <> 'done';
end;
$$;

grant execute on function public.ensure_room_celebrations(uuid) to authenticated;

create or replace function public.prepare_due_reminders(p_now timestamptz default now())
returns table (notification_id uuid, user_id uuid, title text, body text, url text, priority boolean)
language plpgsql security definer set search_path = public as $$
declare
  v_today date := (p_now at time zone 'Asia/Kolkata')::date;
  v_time  time := (p_now at time zone 'Asia/Kolkata')::time;
begin
  insert into celebrations (room_id, birthday_user_id, celebration_date, status, decision)
  select m.room_id, m.user_id, public.next_birthday(coalesce(m.room_dob, p.dob), v_today),
         case when public.next_birthday(coalesce(m.room_dob, p.dob), v_today) = v_today then 'live'::celebration_status else 'upcoming' end,
         case when r.auto_celebrate then 'celebrate'::celebration_decision else 'pending' end
  from memberships m
  join profiles p on p.id = m.user_id
  join rooms r on r.id = m.room_id
  where m.status = 'approved' and public.next_birthday(coalesce(m.room_dob, p.dob), v_today) <= v_today + 30
  on conflict do nothing;

  update celebrations set status = 'live' where celebration_date = v_today and status = 'upcoming';
  update celebrations set status = 'done' where celebration_date < v_today and status <> 'done';

  return query
  with c as (
    select cel.id as cel_id, cel.room_id, cel.birthday_user_id as bday_id, cel.decision,
           cel.celebration_date - v_today as days,
           r.name as room_name, r.remind_week_before, r.remind_day_before, r.remind_on_day,
           r.remind_week_before_at, r.remind_day_before_at, r.remind_on_day_at, r.send_birthday_wish,
           split_part(bp.full_name, ' ', 1) as first,
           (select count(*) from wishes w where w.celebration_id = cel.id) as wish_count
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
        else 'Send ' || mk.first || ' a wish on their birthday wall.' end as body,
      case when mk.kind = 'wish_reminder' then '/rooms/' || mk.room_id || '/wall/' || mk.cel_id
           else '/rooms/' || mk.room_id || '/surprise/' || mk.cel_id end as url
    from member_kinds mk
    join memberships m on m.room_id = mk.room_id and m.status = 'approved' and m.user_id <> mk.bday_id

    union all
    select c.bday_id, c.room_id, c.cel_id, 'birthday_wish'::notification_kind,
           'Happy birthday, ' || c.first || '! 🎉',
           case when c.wish_count > 0
                then 'Your birthday wall has ' || c.wish_count || ' notes from ' || c.room_name || '. Go and read them!'
                else 'Everyone in ' || c.room_name || ' is wishing you a wonderful day.' end,
           '/rooms/' || c.room_id || '/wall/' || c.cel_id
    from c
    where c.days = 0 and c.send_birthday_wish and v_time >= c.remind_on_day_at

    union all
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
    insert into notifications (user_id, room_id, celebration_id, kind, title, body, url, priority)
    select d.user_id, d.room_id, d.cel_id, d.kind, d.title, d.body, d.url,
           d.kind in ('week_before', 'day_before', 'on_day', 'birthday_wish')
    from due d
    on conflict do nothing
    returning notifications.id, notifications.user_id, notifications.title, notifications.body,
              notifications.url, notifications.priority
  )
  select ins.id, ins.user_id, ins.title, ins.body, ins.url, ins.priority from ins;
end;
$$;

revoke execute on function public.prepare_due_reminders(timestamptz) from public, anon, authenticated;
grant execute on function public.prepare_due_reminders(timestamptz) to service_role;

-- ---------------------------------------------------------------------------
-- 3. Set or clear a member's birthday in this room
-- ---------------------------------------------------------------------------
-- Upcoming celebrations at the old date are fixed too: untouched ones are removed, and
-- ones already being planned (plan, money, poll or wishes) move to the new date with
-- everything attached. Reminders already sent for the old date are cleared so the
-- right date gets its own. A celebration that is live today is left alone.
create or replace function public.set_member_birthday(p_room uuid, p_user uuid, p_month int, p_day int)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_today date := (now() at time zone 'Asia/Kolkata')::date;
  v_dob   date;
  v_new   date;
begin
  if not public.is_room_admin(p_room) or p_user = auth.uid() then raise exception 'not_allowed'; end if;
  if not exists (select 1 from memberships where room_id = p_room and user_id = p_user and status = 'approved') then
    raise exception 'not_found';
  end if;
  if p_month is null or p_day is null then
    v_dob := null;
  else
    begin
      v_dob := make_date(2000, p_month, p_day);
    exception when others then
      raise exception 'invalid_input';
    end;
  end if;

  update memberships
     set room_dob = v_dob,
         room_dob_set_by = case when v_dob is null then null else auth.uid() end,
         room_dob_set_at = case when v_dob is null then null else now() end
   where room_id = p_room and user_id = p_user;

  select public.next_birthday(coalesce(m.room_dob, p.dob), v_today) into v_new
  from memberships m join profiles p on p.id = m.user_id
  where m.room_id = p_room and m.user_id = p_user;

  -- Clear reminders sent for upcoming celebrations at a different date.
  delete from notifications n
   using celebrations c
   where n.celebration_id = c.id
     and c.room_id = p_room and c.birthday_user_id = p_user
     and c.status = 'upcoming' and c.celebration_date > v_today and c.celebration_date <> v_new;

  -- Untouched upcoming celebrations at the wrong date: remove.
  delete from celebrations c
   where c.room_id = p_room and c.birthday_user_id = p_user
     and c.status = 'upcoming' and c.celebration_date > v_today and c.celebration_date <> v_new
     and c.purpose is null and c.total_expense is null and c.plan is null
     and not exists (select 1 from contributions x where x.celebration_id = c.id)
     and not exists (select 1 from polls x where x.celebration_id = c.id)
     and not exists (select 1 from wishes x where x.celebration_id = c.id);

  -- Ones already in progress: move to the new date (unless one is already there).
  update celebrations c
     set celebration_date = v_new,
         status = case when v_new = v_today then 'live'::celebration_status else 'upcoming' end
   where c.room_id = p_room and c.birthday_user_id = p_user
     and c.status = 'upcoming' and c.celebration_date > v_today and c.celebration_date <> v_new
     and not exists (
       select 1 from celebrations o
        where o.room_id = p_room and o.birthday_user_id = p_user and o.celebration_date = v_new
     );

  perform public.ensure_room_celebrations(p_room);
end;
$$;
revoke execute on function public.set_member_birthday(uuid, uuid, int, int) from public, anon;
grant execute on function public.set_member_birthday(uuid, uuid, int, int) to authenticated;

-- ---------------------------------------------------------------------------
-- 4. Start someone's birthday today (or on a chosen date up to a year ahead)
-- ---------------------------------------------------------------------------
-- Creates the celebration already approved ("celebrate"). Members get the on-day
-- reminder from the next reminder-job run (within 15 minutes, or at the room's
-- on-day reminder time if that's later today).
create or replace function public.start_birthday(p_room uuid, p_user uuid, p_date date default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_today date := (now() at time zone 'Asia/Kolkata')::date;
  v_date  date := coalesce(p_date, (now() at time zone 'Asia/Kolkata')::date);
  v_id    uuid;
begin
  if not public.is_room_admin(p_room) or p_user = auth.uid() then raise exception 'not_allowed'; end if;
  if not exists (select 1 from memberships where room_id = p_room and user_id = p_user and status = 'approved') then
    raise exception 'not_found';
  end if;
  if v_date < v_today or v_date > v_today + 365 then raise exception 'invalid_input'; end if;

  insert into celebrations (room_id, birthday_user_id, celebration_date, status, decision, decided_by, decided_at)
  values (p_room, p_user, v_date,
          case when v_date = v_today then 'live'::celebration_status else 'upcoming' end,
          'celebrate', auth.uid(), now())
  on conflict (room_id, birthday_user_id, celebration_date) do update
     set decision = 'celebrate', decided_by = excluded.decided_by, decided_at = excluded.decided_at,
         status = case when celebrations.status = 'done' then celebrations.status else excluded.status end
  returning id into v_id;
  return v_id;
end;
$$;
revoke execute on function public.start_birthday(uuid, uuid, date) from public, anon;
grant execute on function public.start_birthday(uuid, uuid, date) to authenticated;
