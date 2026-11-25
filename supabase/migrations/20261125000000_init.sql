-- bdap: initial schema
-- Principles:
--   * Every cross-user read goes through a SECURITY DEFINER function that checks
--     membership, so we never expose another student's full date of birth.
--   * A celebration is never visible to its birthday person (RLS + function checks).
--   * Writes that change other people's rows (approve, roles, codes) are RPCs only.

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- Types
-- ---------------------------------------------------------------------------
create type public.member_role   as enum ('moderator', 'co_moderator', 'member');
create type public.member_status as enum ('pending', 'approved', 'declined');
create type public.amount_mode   as enum ('fixed', 'suggested', 'any');
create type public.celebration_status as enum ('upcoming', 'live', 'done');
create type public.notification_kind as enum (
  'week_before', 'day_before', 'on_day',
  'join_request', 'join_approved', 'join_declined', 'upi_full'
);

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------
create table public.profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  full_name   text not null check (char_length(btrim(full_name)) between 1 and 80),
  username    text not null unique check (username ~ '^[a-z0-9._]{3,24}$'),
  dob         date not null check (dob > date '1900-01-01'),
  avatar_url  text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table public.rooms (
  id                  uuid primary key default gen_random_uuid(),
  name                text not null check (char_length(btrim(name)) between 1 and 80),
  code                text not null unique check (code ~ '^[A-Z0-9]{6}$'),
  amount_mode         public.amount_mode not null default 'suggested',
  amount              integer check (amount is null or amount between 1 and 100000),
  payers_per_upi      integer not null default 20 check (payers_per_upi between 1 and 1000),
  remind_week_before  boolean not null default false,
  remind_day_before   boolean not null default true,
  remind_on_day       boolean not null default true,
  created_by          uuid not null references public.profiles (id),
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create table public.memberships (
  room_id       uuid not null references public.rooms (id) on delete cascade,
  user_id       uuid not null references public.profiles (id) on delete cascade,
  role          public.member_role not null default 'member',
  status        public.member_status not null default 'pending',
  requested_at  timestamptz not null default now(),
  decided_at    timestamptz,
  decided_by    uuid references public.profiles (id),
  primary key (room_id, user_id)
);
create index memberships_user_idx on public.memberships (user_id);

create table public.room_upi_accounts (
  id             uuid primary key default gen_random_uuid(),
  room_id        uuid not null references public.rooms (id) on delete cascade,
  upi_id         text not null check (upi_id ~ '^[A-Za-z0-9._-]{2,256}@[A-Za-z]{2,64}$'),
  payee_name     text not null check (char_length(btrim(payee_name)) between 1 and 80),
  owner_user_id  uuid references public.profiles (id) on delete set null,
  qr_image_url   text,
  sort_order     integer not null default 0,
  active         boolean not null default true,
  created_at     timestamptz not null default now(),
  unique (room_id, upi_id)
);

create table public.celebrations (
  id                uuid primary key default gen_random_uuid(),
  room_id           uuid not null references public.rooms (id) on delete cascade,
  birthday_user_id  uuid not null references public.profiles (id) on delete cascade,
  celebration_date  date not null,
  status            public.celebration_status not null default 'upcoming',
  created_at        timestamptz not null default now(),
  unique (room_id, birthday_user_id, celebration_date)
);
create index celebrations_room_idx on public.celebrations (room_id, celebration_date);

create table public.contributions (
  celebration_id  uuid not null references public.celebrations (id) on delete cascade,
  user_id         uuid not null references public.profiles (id) on delete cascade,
  upi_account_id  uuid references public.room_upi_accounts (id) on delete set null,
  amount          integer check (amount is null or amount between 1 and 100000),
  assigned_at     timestamptz not null default now(),
  marked_paid_at  timestamptz,
  primary key (celebration_id, user_id)
);

create table public.notifications (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references public.profiles (id) on delete cascade,
  room_id         uuid references public.rooms (id) on delete cascade,
  celebration_id  uuid references public.celebrations (id) on delete cascade,
  kind            public.notification_kind not null,
  title           text not null,
  body            text not null,
  url             text not null default '/',
  created_at      timestamptz not null default now(),
  read_at         timestamptz,
  pushed_at       timestamptz
);
create index notifications_user_idx on public.notifications (user_id, created_at desc);
-- Reminders are idempotent: one per person, celebration and kind.
create unique index notifications_reminder_once
  on public.notifications (user_id, celebration_id, kind)
  where celebration_id is not null;

create table public.push_subscriptions (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles (id) on delete cascade,
  endpoint    text not null unique,
  p256dh      text not null,
  auth        text not null,
  user_agent  text,
  created_at  timestamptz not null default now()
);
create index push_subscriptions_user_idx on public.push_subscriptions (user_id);

-- ---------------------------------------------------------------------------
-- Helpers (SECURITY DEFINER so policies can use them without recursion)
-- ---------------------------------------------------------------------------
create or replace function public.is_room_member(p_room uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from memberships
    where room_id = p_room and user_id = auth.uid() and status = 'approved'
  );
$$;

create or replace function public.is_room_admin(p_room uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from memberships
    where room_id = p_room and user_id = auth.uid() and status = 'approved'
      and role in ('moderator', 'co_moderator')
  );
$$;

create or replace function public.is_room_moderator(p_room uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from memberships
    where room_id = p_room and user_id = auth.uid() and status = 'approved'
      and role = 'moderator'
  );
$$;

-- Birthday for a given year; 29 Feb is celebrated on 28 Feb in non-leap years.
create or replace function public.birthday_in_year(p_dob date, p_year integer)
returns date language sql immutable as $$
  select case
    when extract(month from p_dob) = 2 and extract(day from p_dob) = 29
         and not ((p_year % 4 = 0 and p_year % 100 <> 0) or p_year % 400 = 0)
      then make_date(p_year, 2, 28)
    else make_date(p_year, extract(month from p_dob)::int, extract(day from p_dob)::int)
  end;
$$;

create or replace function public.next_birthday(p_dob date, p_from date)
returns date language sql immutable as $$
  select case
    when public.birthday_in_year(p_dob, extract(year from p_from)::int) >= p_from
      then public.birthday_in_year(p_dob, extract(year from p_from)::int)
    else public.birthday_in_year(p_dob, extract(year from p_from)::int + 1)
  end;
$$;

create or replace function public.generate_room_code()
returns text language plpgsql volatile as $$
declare
  alphabet constant text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  candidate text;
begin
  loop
    candidate := '';
    for i in 1..6 loop
      candidate := candidate || substr(alphabet, 1 + floor(random() * length(alphabet))::int, 1);
    end loop;
    exit when not exists (select 1 from rooms where code = candidate);
  end loop;
  return candidate;
end;
$$;

create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at := now(); return new; end;
$$;
create trigger profiles_touch before update on public.profiles
  for each row execute function public.touch_updated_at();
create trigger rooms_touch before update on public.rooms
  for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------------------
-- Row level security
-- ---------------------------------------------------------------------------
alter table public.profiles           enable row level security;
alter table public.rooms              enable row level security;
alter table public.memberships        enable row level security;
alter table public.room_upi_accounts  enable row level security;
alter table public.celebrations       enable row level security;
alter table public.contributions      enable row level security;
alter table public.notifications      enable row level security;
alter table public.push_subscriptions enable row level security;

-- profiles: you read and write only your own row. Others come via room_members().
create policy profiles_self_select on public.profiles for select using (id = auth.uid());
create policy profiles_self_insert on public.profiles for insert with check (id = auth.uid());
create policy profiles_self_update on public.profiles for update using (id = auth.uid()) with check (id = auth.uid());

-- rooms: visible to anyone with a membership row (pending users see the name on the waiting screen).
create policy rooms_select on public.rooms for select using (
  exists (select 1 from public.memberships m where m.room_id = rooms.id and m.user_id = auth.uid())
);
create policy rooms_admin_update on public.rooms for update
  using (public.is_room_admin(id)) with check (public.is_room_admin(id));
-- Inserts happen through create_room(); code changes through regenerate_room_code().

-- memberships: your own rows; admins see everything in their room.
create policy memberships_select on public.memberships for select using (
  user_id = auth.uid() or public.is_room_admin(room_id)
);
create policy memberships_leave on public.memberships for delete using (
  user_id = auth.uid() and role <> 'moderator'
);

-- UPI accounts: admins manage them. Members get theirs through open_surprise().
create policy upi_admin_all on public.room_upi_accounts for all
  using (public.is_room_admin(room_id)) with check (public.is_room_admin(room_id));

-- celebrations: members of the room, never the birthday person.
create policy celebrations_select on public.celebrations for select using (
  public.is_room_member(room_id) and birthday_user_id <> auth.uid()
);

-- contributions: your own row only. Totals via celebration_pool(), names via celebration_payers().
create policy contributions_self_select on public.contributions for select using (user_id = auth.uid());

-- notifications: your own.
create policy notifications_self_select on public.notifications for select using (user_id = auth.uid());
create policy notifications_self_update on public.notifications for update
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- push subscriptions: your own.
create policy push_self_all on public.push_subscriptions for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- RPCs: rooms and membership
-- ---------------------------------------------------------------------------
create or replace function public.username_available(p_username text)
returns boolean language sql stable security definer set search_path = public as $$
  select not exists (
    select 1 from profiles where username = lower(p_username) and id <> coalesce(auth.uid(), '00000000-0000-0000-0000-000000000000')
  );
$$;

-- Preview a room by code before joining. Reveals only the room name, size and moderator's first name.
create or replace function public.preview_room(p_code text)
returns table (room_id uuid, name text, member_count integer, moderator_name text, my_status public.member_status)
language sql stable security definer set search_path = public as $$
  select r.id, r.name,
    (select count(*)::int from memberships m where m.room_id = r.id and m.status = 'approved'),
    (select split_part(p.full_name, ' ', 1) from memberships m join profiles p on p.id = m.user_id
       where m.room_id = r.id and m.role = 'moderator' limit 1),
    (select m.status from memberships m where m.room_id = r.id and m.user_id = auth.uid())
  from rooms r
  where r.code = upper(btrim(p_code)) and auth.uid() is not null;
$$;

create or replace function public.request_join(p_code text)
returns table (room_id uuid, status public.member_status)
language plpgsql security definer set search_path = public as $$
declare
  v_room rooms%rowtype;
  v_existing memberships%rowtype;
  v_name text;
begin
  if auth.uid() is null then raise exception 'not_signed_in'; end if;
  if not exists (select 1 from profiles where id = auth.uid()) then raise exception 'profile_missing'; end if;

  select * into v_room from rooms where code = upper(btrim(p_code));
  if not found then raise exception 'room_not_found'; end if;

  select * into v_existing from memberships m where m.room_id = v_room.id and m.user_id = auth.uid();
  if found and v_existing.status <> 'declined' then
    return query select v_room.id, v_existing.status; return;
  end if;

  insert into memberships (room_id, user_id, role, status, requested_at)
  values (v_room.id, auth.uid(), 'member', 'pending', now())
  on conflict on constraint memberships_pkey
    do update set status = 'pending', requested_at = now(), decided_at = null, decided_by = null;

  select full_name into v_name from profiles where id = auth.uid();
  insert into notifications (user_id, room_id, kind, title, body, url)
  select m.user_id, v_room.id, 'join_request', 'New join request',
         v_name || ' wants to join ' || v_room.name, '/rooms/' || v_room.id || '/manage'
  from memberships m
  where m.room_id = v_room.id and m.status = 'approved' and m.role in ('moderator', 'co_moderator');

  return query select v_room.id, 'pending'::public.member_status;
end;
$$;

create or replace function public.create_room(
  p_name text,
  p_amount_mode public.amount_mode default 'suggested',
  p_amount integer default 50,
  p_payers_per_upi integer default 20,
  p_remind_week_before boolean default false,
  p_remind_day_before boolean default true,
  p_remind_on_day boolean default true,
  p_upi_accounts jsonb default '[]'::jsonb  -- [{upi_id, payee_name, owner_user_id?, qr_image_url?}]
)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_id uuid;
  v_acc jsonb;
  v_i int := 0;
begin
  if auth.uid() is null then raise exception 'not_signed_in'; end if;
  if not exists (select 1 from profiles where id = auth.uid()) then raise exception 'profile_missing'; end if;

  insert into rooms (name, code, amount_mode, amount, payers_per_upi,
                     remind_week_before, remind_day_before, remind_on_day, created_by)
  values (btrim(p_name), generate_room_code(), p_amount_mode,
          case when p_amount_mode = 'any' then null else p_amount end,
          p_payers_per_upi, p_remind_week_before, p_remind_day_before, p_remind_on_day, auth.uid())
  returning id into v_id;

  insert into memberships (room_id, user_id, role, status, decided_at, decided_by)
  values (v_id, auth.uid(), 'moderator', 'approved', now(), auth.uid());

  for v_acc in select * from jsonb_array_elements(coalesce(p_upi_accounts, '[]'::jsonb)) loop
    insert into room_upi_accounts (room_id, upi_id, payee_name, owner_user_id, qr_image_url, sort_order)
    values (v_id, btrim(v_acc->>'upi_id'), btrim(v_acc->>'payee_name'),
            coalesce(nullif(v_acc->>'owner_user_id', '')::uuid, auth.uid()),
            nullif(v_acc->>'qr_image_url', ''), v_i);
    v_i := v_i + 1;
  end loop;

  return v_id;
end;
$$;

create or replace function public.regenerate_room_code(p_room uuid)
returns text language plpgsql security definer set search_path = public as $$
declare v_code text;
begin
  if not public.is_room_admin(p_room) then raise exception 'not_allowed'; end if;
  v_code := generate_room_code();
  update rooms set code = v_code where id = p_room;
  return v_code;
end;
$$;

create or replace function public.decide_request(p_room uuid, p_user uuid, p_approve boolean)
returns void language plpgsql security definer set search_path = public as $$
declare v_room_name text;
begin
  if not public.is_room_admin(p_room) then raise exception 'not_allowed'; end if;
  update memberships
     set status = case when p_approve then 'approved'::member_status else 'declined'::member_status end,
         decided_at = now(), decided_by = auth.uid()
   where room_id = p_room and user_id = p_user and status = 'pending';
  if not found then raise exception 'request_not_found'; end if;

  select name into v_room_name from rooms where id = p_room;
  insert into notifications (user_id, room_id, kind, title, body, url)
  values (p_user, p_room,
          case when p_approve then 'join_approved'::notification_kind else 'join_declined'::notification_kind end,
          case when p_approve then 'You''re in!' else 'Join request declined' end,
          case when p_approve then 'Welcome to ' || v_room_name else 'Your request to join ' || v_room_name || ' was declined.' end,
          case when p_approve then '/rooms/' || p_room else '/join' end);
end;
$$;

-- Only the moderator can promote/demote co-moderators.
create or replace function public.set_member_role(p_room uuid, p_user uuid, p_role public.member_role)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_room_moderator(p_room) then raise exception 'not_allowed'; end if;
  if p_role = 'moderator' then raise exception 'use_transfer'; end if;
  if p_user = auth.uid() then raise exception 'cannot_change_self'; end if;
  update memberships set role = p_role
   where room_id = p_room and user_id = p_user and status = 'approved' and role <> 'moderator';
  if not found then raise exception 'member_not_found'; end if;
end;
$$;

create or replace function public.remove_member(p_room uuid, p_user uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_room_admin(p_room) then raise exception 'not_allowed'; end if;
  delete from memberships where room_id = p_room and user_id = p_user and role <> 'moderator'
    and (role = 'member' or public.is_room_moderator(p_room));
end;
$$;

-- Members of a room. Birth month/day only, never the year. Admins also see pending requests.
create or replace function public.room_members(p_room uuid)
returns table (
  user_id uuid, full_name text, username text, avatar_url text,
  birth_month integer, birth_day integer,
  role public.member_role, status public.member_status, requested_at timestamptz
)
language sql stable security definer set search_path = public as $$
  select p.id, p.full_name, p.username, p.avatar_url,
         extract(month from p.dob)::int, extract(day from p.dob)::int,
         m.role, m.status, m.requested_at
  from memberships m join profiles p on p.id = m.user_id
  where m.room_id = p_room
    and public.is_room_member(p_room)
    and (m.status = 'approved' or public.is_room_admin(p_room))
  order by m.status, p.full_name;
$$;

-- ---------------------------------------------------------------------------
-- RPCs: celebrations, UPI rotation, pool
-- ---------------------------------------------------------------------------

-- Assign (or return the already-assigned) UPI account for the caller.
-- Rule: skip accounts owned by the birthday person; fill accounts in sort order
-- until each reaches payers_per_upi; when all are full use the least-filled one.
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
  if not found or v_cel.birthday_user_id = auth.uid() or not public.is_room_member(v_cel.room_id) then
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
declare v_cel celebrations%rowtype;
begin
  select * into v_cel from celebrations where id = p_celebration;
  if not found or v_cel.birthday_user_id = auth.uid() or not public.is_room_member(v_cel.room_id) then
    raise exception 'not_found';
  end if;
  insert into contributions (celebration_id, user_id, amount, marked_paid_at)
  values (p_celebration, auth.uid(), p_amount, case when p_paid then now() end)
  on conflict on constraint contributions_pkey do update
    set marked_paid_at = case when p_paid then coalesce(contributions.marked_paid_at, now()) end,
        amount = coalesce(excluded.amount, contributions.amount);
end;
$$;

-- Pool totals for any member (not the birthday person).
create or replace function public.celebration_pool(p_celebration uuid)
returns table (paid_count integer, eligible_count integer, total_amount integer)
language plpgsql stable security definer set search_path = public as $$
declare v_cel celebrations%rowtype; v_room rooms%rowtype;
begin
  select * into v_cel from celebrations where id = p_celebration;
  if not found or v_cel.birthday_user_id = auth.uid() or not public.is_room_member(v_cel.room_id) then
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

-- Who paid: moderators and co-moderators only (and never the birthday person).
create or replace function public.celebration_payers(p_celebration uuid)
returns table (user_id uuid, full_name text, username text, upi_id text, amount integer, marked_paid_at timestamptz)
language plpgsql stable security definer set search_path = public as $$
declare v_cel celebrations%rowtype;
begin
  select * into v_cel from celebrations where id = p_celebration;
  if not found or v_cel.birthday_user_id = auth.uid() or not public.is_room_admin(v_cel.room_id) then
    raise exception 'not_found';
  end if;
  return query
  select p.id, p.full_name, p.username, a.upi_id, c.amount, c.marked_paid_at
  from memberships m
  join profiles p on p.id = m.user_id
  left join contributions c on c.celebration_id = p_celebration and c.user_id = m.user_id
  left join room_upi_accounts a on a.id = c.upi_account_id
  where m.room_id = v_cel.room_id and m.status = 'approved' and m.user_id <> v_cel.birthday_user_id
  order by c.marked_paid_at nulls last, p.full_name;
end;
$$;

-- ---------------------------------------------------------------------------
-- Scheduled reminders (called by the cron route with the service role key)
-- ---------------------------------------------------------------------------

-- Creates celebrations for the next 7 days, updates statuses, and inserts reminder
-- notifications for p_kind. Returns only notifications created by this call, so
-- running it twice never sends a reminder twice.
create or replace function public.prepare_reminders(p_today date, p_kind public.notification_kind)
returns table (notification_id uuid, user_id uuid, title text, body text, url text)
language plpgsql security definer set search_path = public as $$
declare v_offset int;
begin
  if p_kind not in ('week_before', 'day_before', 'on_day') then raise exception 'bad_kind'; end if;
  v_offset := case p_kind when 'week_before' then 7 when 'day_before' then 1 else 0 end;

  insert into celebrations (room_id, birthday_user_id, celebration_date)
  select m.room_id, m.user_id, public.next_birthday(p.dob, p_today)
  from memberships m join profiles p on p.id = m.user_id
  where m.status = 'approved'
    and public.next_birthday(p.dob, p_today) <= p_today + 7
  on conflict do nothing;

  update celebrations set status = 'live' where celebration_date = p_today and status = 'upcoming';
  update celebrations set status = 'done' where celebration_date < p_today and status <> 'done';

  return query
  with due as (
    select c.id as celebration_id, c.room_id, r.name as room_name, bp.full_name as bday_name,
           split_part(bp.full_name, ' ', 1) as bday_first
    from celebrations c
    join rooms r on r.id = c.room_id
    join profiles bp on bp.id = c.birthday_user_id
    join memberships bm on bm.room_id = c.room_id and bm.user_id = c.birthday_user_id and bm.status = 'approved'
    where c.celebration_date = p_today + v_offset
      and case p_kind when 'week_before' then r.remind_week_before
                      when 'day_before'  then r.remind_day_before
                      else r.remind_on_day end
  ), ins as (
    insert into notifications (user_id, room_id, celebration_id, kind, title, body, url)
    select m.user_id, d.room_id, d.celebration_id, p_kind,
      case p_kind
        when 'week_before' then d.bday_first || '''s birthday is in a week'
        when 'day_before'  then 'Psst. ' || d.bday_first || '''s birthday is tomorrow'
        else 'Today is ' || d.bday_first || '''s birthday!' end,
      case p_kind
        when 'week_before' then 'Start planning in ' || d.room_name || '. Don''t tell ' || d.bday_first || '.'
        when 'day_before'  then 'A gift is waiting for you to unwrap. Don''t tell ' || d.bday_first || '.'
        else 'Chip in and wish ' || d.bday_first || ' before class.' end,
      '/rooms/' || d.room_id || '/surprise/' || d.celebration_id
    from due d
    join memberships m on m.room_id = d.room_id and m.status = 'approved'
    join celebrations c on c.id = d.celebration_id
    where m.user_id <> c.birthday_user_id
    on conflict do nothing
    returning id, notifications.user_id, notifications.title, notifications.body, notifications.url
  )
  select ins.id, ins.user_id, ins.title, ins.body, ins.url from ins;
end;
$$;

-- prepare_reminders is for the service role only.
revoke execute on function public.prepare_reminders(date, public.notification_kind) from public, anon, authenticated;

-- Realtime: let the waiting screen hear its approval and the bell hear new notifications.
alter publication supabase_realtime add table public.memberships;
alter publication supabase_realtime add table public.notifications;
