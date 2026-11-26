-- bdap: celebration plans, equal splits, cake votes, class reps and class
-- expenses, the birthday wall, and priority notifications.
-- Run AFTER 20261128000000_more_enum_values.sql.

-- ---------------------------------------------------------------------------
-- 0. Birth year must be before the current year (new and edited rows;
--    NOT VALID leaves any existing rows alone).
-- ---------------------------------------------------------------------------
alter table public.profiles
  add constraint profiles_dob_before_this_year
  check (extract(year from dob) < extract(year from current_date)) not valid;

-- ---------------------------------------------------------------------------
-- 1. Columns
-- ---------------------------------------------------------------------------
alter table public.celebrations
  add column purpose       text check (purpose is null or char_length(btrim(purpose)) between 1 and 120),
  add column total_expense integer check (total_expense is null or total_expense between 1 and 1000000),
  add column plan          text check (plan is null or char_length(btrim(plan)) between 1 and 500);

alter table public.contributions
  add column recorded_by uuid references public.profiles (id) on delete set null;

alter table public.notifications
  add column priority boolean not null default false;

-- ---------------------------------------------------------------------------
-- 2. Helpers
-- ---------------------------------------------------------------------------
-- Moderators, co-moderators and class reps.
create or replace function public.is_room_rep(p_room uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from memberships
    where room_id = p_room and user_id = auth.uid() and status = 'approved'
      and role in ('moderator', 'co_moderator', 'class_rep')
  );
$$;

-- Equal share of a celebration's total between everyone except the birthday person.
create or replace function public.celebration_split(p_celebration uuid)
returns integer language sql stable security definer set search_path = public as $$
  select case when c.total_expense is null then null
    else ceil(c.total_expense::numeric / greatest(1, (
      select count(*) from memberships m
      where m.room_id = c.room_id and m.status = 'approved' and m.user_id <> c.birthday_user_id
    )))::int end
  from celebrations c where c.id = p_celebration;
$$;

-- Co-moderators may also remove class reps (not just members).
create or replace function public.remove_member(p_room uuid, p_user uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_room_admin(p_room) then raise exception 'not_allowed'; end if;
  delete from memberships where room_id = p_room and user_id = p_user and role <> 'moderator'
    and (role in ('member', 'class_rep') or public.is_room_moderator(p_room));
end;
$$;

-- ---------------------------------------------------------------------------
-- 3. Celebration plan: what for, total expense, the plan for the day
-- ---------------------------------------------------------------------------
create or replace function public.set_celebration_details(p_celebration uuid, p_purpose text, p_total integer, p_plan text)
returns void language plpgsql security definer set search_path = public as $$
declare v_cel celebrations%rowtype;
begin
  select * into v_cel from celebrations where id = p_celebration;
  if not found or v_cel.birthday_user_id = auth.uid() or not public.is_room_admin(v_cel.room_id) then
    raise exception 'not_allowed';
  end if;
  update celebrations
     set purpose = nullif(btrim(p_purpose), ''),
         total_expense = p_total,
         plan = nullif(btrim(p_plan), '')
   where id = p_celebration;
end;
$$;

drop function if exists public.open_surprise(uuid);
create function public.open_surprise(p_celebration uuid)
returns table (
  celebration_id uuid, room_id uuid, birthday_name text, celebration_date date,
  upi_account_id uuid, upi_id text, payee_name text, qr_image_url text,
  amount_mode public.amount_mode, amount integer, all_upi_full boolean,
  my_paid_at timestamptz, my_amount integer,
  purpose text, plan text, total_expense integer, split_amount integer
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
         v_contrib.marked_paid_at, v_contrib.amount,
         v_cel.purpose, v_cel.plan, v_cel.total_expense, public.celebration_split(v_cel.id)
  from profiles p
  left join room_upi_accounts a on a.id = v_acc_id
  where p.id = v_cel.birthday_user_id;
end;
$$;

-- Self-reported payment. With a total expense, nobody pays less than their share.
create or replace function public.mark_paid(p_celebration uuid, p_paid boolean, p_amount integer default null)
returns void language plpgsql security definer set search_path = public as $$
declare v_cel celebrations%rowtype; v_mode amount_mode; v_split integer;
begin
  select * into v_cel from celebrations where id = p_celebration;
  if not found or v_cel.birthday_user_id = auth.uid() or not public.is_room_member(v_cel.room_id)
     or v_cel.decision <> 'celebrate' then
    raise exception 'not_found';
  end if;
  select amount_mode into v_mode from rooms where id = v_cel.room_id;
  v_split := public.celebration_split(p_celebration);
  if v_split is not null then
    p_amount := coalesce(p_amount, v_split);
    if p_paid and p_amount < v_split then raise exception 'invalid_input: your share is at least %', v_split; end if;
  elsif v_mode = 'fixed' then
    p_amount := null;
  end if;
  if p_amount is not null and (p_amount < 1 or p_amount > 100000) then raise exception 'invalid_input'; end if;
  insert into contributions (celebration_id, user_id, amount, marked_paid_at)
  values (p_celebration, auth.uid(), p_amount, case when p_paid then now() end)
  on conflict on constraint contributions_pkey do update
    set marked_paid_at = case when p_paid then coalesce(contributions.marked_paid_at, now()) end,
        amount = coalesce(excluded.amount, contributions.amount),
        recorded_by = null;
end;
$$;

-- Who paid: admins and class reps (never the birthday person).
drop function if exists public.celebration_payers(uuid);
create function public.celebration_payers(p_celebration uuid)
returns table (user_id uuid, full_name text, username text, upi_id text, amount integer, marked_paid_at timestamptz, recorded_by uuid)
language plpgsql stable security definer set search_path = public as $$
declare v_cel celebrations%rowtype;
begin
  select * into v_cel from celebrations where id = p_celebration;
  if not found or v_cel.birthday_user_id = auth.uid() or not public.is_room_rep(v_cel.room_id) then
    raise exception 'not_found';
  end if;
  return query
  select p.id, p.full_name, p.username, a.upi_id, c.amount, c.marked_paid_at, c.recorded_by
  from memberships m
  join profiles p on p.id = m.user_id
  left join contributions c on c.celebration_id = p_celebration and c.user_id = m.user_id
  left join room_upi_accounts a on a.id = c.upi_account_id
  where m.room_id = v_cel.room_id and m.status = 'approved' and m.user_id <> v_cel.birthday_user_id
  order by c.marked_paid_at nulls last, p.full_name;
end;
$$;

-- Class reps and admins record a payment for someone (e.g. paid in cash).
create or replace function public.record_celebration_payment(p_celebration uuid, p_user uuid, p_paid boolean, p_amount integer default null)
returns void language plpgsql security definer set search_path = public as $$
declare v_cel celebrations%rowtype; v_split integer;
begin
  select * into v_cel from celebrations where id = p_celebration;
  if not found or v_cel.birthday_user_id = auth.uid() or v_cel.birthday_user_id = p_user
     or not public.is_room_rep(v_cel.room_id) or v_cel.decision <> 'celebrate' then
    raise exception 'not_allowed';
  end if;
  if not exists (select 1 from memberships where room_id = v_cel.room_id and user_id = p_user and status = 'approved') then
    raise exception 'not_found';
  end if;
  v_split := public.celebration_split(p_celebration);
  p_amount := coalesce(p_amount, v_split, (select amount from rooms where id = v_cel.room_id));
  if p_paid and v_split is not null and p_amount < v_split then raise exception 'invalid_input: at least %', v_split; end if;
  insert into contributions (celebration_id, user_id, amount, marked_paid_at, recorded_by)
  values (p_celebration, p_user, p_amount, case when p_paid then now() end, auth.uid())
  on conflict on constraint contributions_pkey do update
    set marked_paid_at = case when p_paid then coalesce(contributions.marked_paid_at, now()) end,
        amount = coalesce(excluded.amount, contributions.amount),
        recorded_by = auth.uid();
end;
$$;

-- ---------------------------------------------------------------------------
-- 4. Votes (e.g. cake flavour). Closing sets the celebration's total.
-- ---------------------------------------------------------------------------
create table public.polls (
  id                uuid primary key default gen_random_uuid(),
  room_id           uuid not null references public.rooms (id) on delete cascade,
  celebration_id    uuid references public.celebrations (id) on delete cascade,
  question          text not null check (char_length(btrim(question)) between 1 and 120),
  status            text not null default 'open' check (status in ('open', 'closed')),
  winner_option_id  uuid,
  created_by        uuid references public.profiles (id) on delete set null,
  created_at        timestamptz not null default now()
);
create unique index polls_one_per_celebration on public.polls (celebration_id) where celebration_id is not null;

create table public.poll_options (
  id          uuid primary key default gen_random_uuid(),
  poll_id     uuid not null references public.polls (id) on delete cascade,
  label       text not null check (char_length(btrim(label)) between 1 and 60),
  price       integer check (price is null or price between 1 and 1000000),
  sort_order  integer not null default 0
);

create table public.poll_votes (
  poll_id    uuid not null references public.polls (id) on delete cascade,
  user_id    uuid not null references public.profiles (id) on delete cascade,
  option_id  uuid not null references public.poll_options (id) on delete cascade,
  voted_at   timestamptz not null default now(),
  primary key (poll_id, user_id)
);

alter table public.polls enable row level security;
alter table public.poll_options enable row level security;
alter table public.poll_votes enable row level security;
-- No direct access: everything goes through the functions below.

-- Can the caller see this celebration's plan, vote and pool?
create or replace function public.can_view_celebration(p_celebration uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from celebrations c
    where c.id = p_celebration and c.birthday_user_id <> auth.uid()
      and public.is_room_member(c.room_id)
      and (c.decision = 'celebrate' or public.is_room_admin(c.room_id))
  );
$$;

create or replace function public.create_poll(p_celebration uuid, p_question text, p_options jsonb)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_cel celebrations%rowtype; v_poll uuid; v_opt jsonb; v_i int := 0;
begin
  select * into v_cel from celebrations where id = p_celebration;
  if not found or v_cel.birthday_user_id = auth.uid() or not public.is_room_admin(v_cel.room_id) then
    raise exception 'not_allowed';
  end if;
  if jsonb_array_length(coalesce(p_options, '[]'::jsonb)) not between 2 and 8 then raise exception 'invalid_input: 2 to 8 options'; end if;
  insert into polls (room_id, celebration_id, question, created_by)
  values (v_cel.room_id, p_celebration, btrim(p_question), auth.uid())
  returning id into v_poll;
  for v_opt in select * from jsonb_array_elements(p_options) loop
    insert into poll_options (poll_id, label, price, sort_order)
    values (v_poll, btrim(v_opt->>'label'), nullif(v_opt->>'price', '')::int, v_i);
    v_i := v_i + 1;
  end loop;
  if v_cel.decision = 'celebrate' then
    insert into notifications (user_id, room_id, celebration_id, kind, title, body, url)
    select m.user_id, v_cel.room_id, p_celebration, 'poll_open', 'Vote: ' || btrim(p_question),
           'Pick one before the vote closes. Don''t tell ' || split_part(bp.full_name, ' ', 1) || '.',
           '/rooms/' || v_cel.room_id || '/surprise/' || p_celebration
    from memberships m join profiles bp on bp.id = v_cel.birthday_user_id
    where m.room_id = v_cel.room_id and m.status = 'approved' and m.user_id <> v_cel.birthday_user_id
    on conflict do nothing;
  end if;
  return v_poll;
end;
$$;

-- One row per option, with vote counts and the caller's vote.
create or replace function public.poll_view(p_celebration uuid)
returns table (poll_id uuid, question text, status text, winner_option_id uuid,
               option_id uuid, label text, price integer, sort_order integer, votes integer, my_vote uuid)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.can_view_celebration(p_celebration) then raise exception 'not_found'; end if;
  return query
  select p.id, p.question, p.status, p.winner_option_id, o.id, o.label, o.price, o.sort_order,
         (select count(*)::int from poll_votes v where v.option_id = o.id),
         (select v.option_id from poll_votes v where v.poll_id = p.id and v.user_id = auth.uid())
  from polls p join poll_options o on o.poll_id = p.id
  where p.celebration_id = p_celebration
  order by o.sort_order;
end;
$$;

create or replace function public.vote_poll(p_poll uuid, p_option uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v_poll polls%rowtype;
begin
  select * into v_poll from polls where id = p_poll;
  if not found or v_poll.status <> 'open' or not public.can_view_celebration(v_poll.celebration_id) then
    raise exception 'not_allowed';
  end if;
  if not exists (select 1 from poll_options where id = p_option and poll_id = p_poll) then raise exception 'not_found'; end if;
  insert into poll_votes (poll_id, user_id, option_id) values (p_poll, auth.uid(), p_option)
  on conflict (poll_id, user_id) do update set option_id = excluded.option_id, voted_at = now();
end;
$$;

-- Most votes wins; ties go to the cheaper option, then list order (src/lib/split.ts pickWinner).
create or replace function public.close_poll(p_poll uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v_poll polls%rowtype; v_winner poll_options%rowtype;
begin
  select * into v_poll from polls where id = p_poll;
  if not found or not public.is_room_admin(v_poll.room_id)
     or exists (select 1 from celebrations c where c.id = v_poll.celebration_id and c.birthday_user_id = auth.uid()) then
    raise exception 'not_allowed';
  end if;
  select o.* into v_winner
  from poll_options o
  where o.poll_id = p_poll
  order by (select count(*) from poll_votes v where v.option_id = o.id) desc,
           coalesce(o.price, 2147483647), o.sort_order
  limit 1;
  update polls set status = 'closed', winner_option_id = v_winner.id where id = p_poll;
  if v_poll.celebration_id is not null and v_winner.price is not null then
    update celebrations
       set total_expense = v_winner.price,
           purpose = coalesce(purpose, v_winner.label)
     where id = v_poll.celebration_id;
  end if;
end;
$$;

create or replace function public.delete_poll(p_poll uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v_poll polls%rowtype;
begin
  select * into v_poll from polls where id = p_poll;
  if not found or not public.is_room_admin(v_poll.room_id) then raise exception 'not_allowed'; end if;
  delete from polls where id = p_poll;
end;
$$;

-- ---------------------------------------------------------------------------
-- 5. Class expenses (trips, printouts, gifts…) requested by class reps
-- ---------------------------------------------------------------------------
create table public.expenses (
  id              uuid primary key default gen_random_uuid(),
  room_id         uuid not null references public.rooms (id) on delete cascade,
  title           text not null check (char_length(btrim(title)) between 1 and 80),
  purpose         text check (purpose is null or char_length(purpose) <= 200),
  total_amount    integer not null check (total_amount between 1 and 1000000),
  split_amount    integer,
  upi_account_id  uuid references public.room_upi_accounts (id) on delete set null,
  due_date        date,
  status          text not null default 'requested' check (status in ('requested', 'approved', 'declined', 'closed')),
  created_by      uuid references public.profiles (id) on delete set null,
  decided_by      uuid references public.profiles (id) on delete set null,
  decided_at      timestamptz,
  created_at      timestamptz not null default now()
);
create index expenses_room_idx on public.expenses (room_id, created_at desc);

create table public.expense_payments (
  expense_id   uuid not null references public.expenses (id) on delete cascade,
  user_id      uuid not null references public.profiles (id) on delete cascade,
  amount       integer check (amount is null or amount between 1 and 1000000),
  paid_at      timestamptz,
  recorded_by  uuid references public.profiles (id) on delete set null,
  primary key (expense_id, user_id)
);

alter table public.expenses enable row level security;
alter table public.expense_payments enable row level security;

create or replace function public.room_member_count(p_room uuid)
returns integer language sql stable security definer set search_path = public as $$
  select count(*)::int from memberships where room_id = p_room and status = 'approved';
$$;

create or replace function public.approve_expense_internal(p_expense uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v_exp expenses%rowtype;
begin
  select * into v_exp from expenses where id = p_expense;
  update expenses
     set status = 'approved', decided_by = auth.uid(), decided_at = now(),
         split_amount = ceil(v_exp.total_amount::numeric / greatest(1, public.room_member_count(v_exp.room_id)))::int
   where id = p_expense;
  insert into notifications (user_id, room_id, kind, title, body, url, priority)
  select m.user_id, v_exp.room_id, 'expense_approved', 'New split: ' || v_exp.title,
         'Your share is ₹' || ceil(v_exp.total_amount::numeric / greatest(1, public.room_member_count(v_exp.room_id)))::int
           || coalesce(' · due ' || to_char(v_exp.due_date, 'DD Mon'), '') || '.',
         '/rooms/' || v_exp.room_id || '?tab=expenses', true
  from memberships m where m.room_id = v_exp.room_id and m.status = 'approved';
end;
$$;
revoke execute on function public.approve_expense_internal(uuid) from public, anon, authenticated;

-- Class reps request; admins' own requests are approved straight away.
create or replace function public.request_expense(p_room uuid, p_title text, p_purpose text, p_total integer, p_upi uuid, p_due date)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_id uuid; v_name text;
begin
  if not public.is_room_rep(p_room) then raise exception 'not_allowed'; end if;
  if p_upi is not null and not exists (select 1 from room_upi_accounts where id = p_upi and room_id = p_room and active) then
    raise exception 'invalid_input: choose one of the room''s UPI IDs';
  end if;
  insert into expenses (room_id, title, purpose, total_amount, upi_account_id, due_date, created_by)
  values (p_room, btrim(p_title), nullif(btrim(p_purpose), ''), p_total, p_upi, p_due, auth.uid())
  returning id into v_id;

  if public.is_room_admin(p_room) then
    perform public.approve_expense_internal(v_id);
  else
    select full_name into v_name from profiles where id = auth.uid();
    insert into notifications (user_id, room_id, kind, title, body, url)
    select m.user_id, p_room, 'expense_request', 'Split request: ' || btrim(p_title),
           v_name || ' wants to split ₹' || p_total || '. Approve it before the class sees it.',
           '/rooms/' || p_room || '/manage?tab=expenses'
    from memberships m
    where m.room_id = p_room and m.status = 'approved' and m.role in ('moderator', 'co_moderator');
  end if;
  return v_id;
end;
$$;

create or replace function public.decide_expense(p_expense uuid, p_approve boolean)
returns void language plpgsql security definer set search_path = public as $$
declare v_exp expenses%rowtype;
begin
  select * into v_exp from expenses where id = p_expense;
  if not found or not public.is_room_admin(v_exp.room_id) then raise exception 'not_allowed'; end if;
  if v_exp.status <> 'requested' then raise exception 'invalid_input: already decided'; end if;
  if p_approve then
    perform public.approve_expense_internal(p_expense);
  else
    update expenses set status = 'declined', decided_by = auth.uid(), decided_at = now() where id = p_expense;
  end if;
end;
$$;

-- Members see approved and closed expenses; reps and admins also see requests.
create or replace function public.room_expenses(p_room uuid)
returns table (
  id uuid, title text, purpose text, total_amount integer, split_amount integer,
  upi_account_id uuid, upi_id text, payee_name text, qr_image_url text,
  due_date date, status text, created_by uuid, created_by_name text,
  paid_count integer, eligible_count integer, collected integer,
  my_paid_at timestamptz, my_amount integer
)
language plpgsql stable security definer set search_path = public as $$
declare v_rep boolean := public.is_room_rep(p_room);
begin
  if not public.is_room_member(p_room) then raise exception 'not_allowed'; end if;
  return query
  select e.id, e.title, e.purpose, e.total_amount, e.split_amount,
         a.id, a.upi_id, a.payee_name, a.qr_image_url,
         e.due_date, e.status, e.created_by, cp.full_name,
         (select count(*)::int from expense_payments x where x.expense_id = e.id and x.paid_at is not null),
         public.room_member_count(p_room),
         (select coalesce(sum(coalesce(x.amount, e.split_amount, 0)), 0)::int from expense_payments x where x.expense_id = e.id and x.paid_at is not null),
         mine.paid_at, mine.amount
  from expenses e
  left join room_upi_accounts a on a.id = e.upi_account_id
  left join profiles cp on cp.id = e.created_by
  left join expense_payments mine on mine.expense_id = e.id and mine.user_id = auth.uid()
  where e.room_id = p_room
    and (e.status in ('approved', 'closed') or v_rep)
  order by (e.status = 'requested') desc, e.created_at desc;
end;
$$;

create or replace function public.mark_expense_paid(p_expense uuid, p_paid boolean, p_amount integer default null)
returns void language plpgsql security definer set search_path = public as $$
declare v_exp expenses%rowtype;
begin
  select * into v_exp from expenses where id = p_expense;
  if not found or v_exp.status <> 'approved' or not public.is_room_member(v_exp.room_id) then raise exception 'not_found'; end if;
  p_amount := coalesce(p_amount, v_exp.split_amount);
  if p_paid and p_amount < v_exp.split_amount then raise exception 'invalid_input: your share is at least %', v_exp.split_amount; end if;
  insert into expense_payments (expense_id, user_id, amount, paid_at)
  values (p_expense, auth.uid(), p_amount, case when p_paid then now() end)
  on conflict (expense_id, user_id) do update
    set paid_at = case when p_paid then coalesce(expense_payments.paid_at, now()) end,
        amount = excluded.amount, recorded_by = null;
end;
$$;

create or replace function public.expense_payers(p_expense uuid)
returns table (user_id uuid, full_name text, username text, amount integer, paid_at timestamptz, recorded_by uuid)
language plpgsql stable security definer set search_path = public as $$
declare v_exp expenses%rowtype;
begin
  select * into v_exp from expenses where id = p_expense;
  if not found or not public.is_room_rep(v_exp.room_id) then raise exception 'not_allowed'; end if;
  return query
  select p.id, p.full_name, p.username, x.amount, x.paid_at, x.recorded_by
  from memberships m
  join profiles p on p.id = m.user_id
  left join expense_payments x on x.expense_id = p_expense and x.user_id = m.user_id
  where m.room_id = v_exp.room_id and m.status = 'approved'
  order by x.paid_at nulls last, p.full_name;
end;
$$;

create or replace function public.record_expense_payment(p_expense uuid, p_user uuid, p_paid boolean, p_amount integer default null)
returns void language plpgsql security definer set search_path = public as $$
declare v_exp expenses%rowtype;
begin
  select * into v_exp from expenses where id = p_expense;
  if not found or v_exp.status <> 'approved' or not public.is_room_rep(v_exp.room_id) then raise exception 'not_allowed'; end if;
  if not exists (select 1 from memberships where room_id = v_exp.room_id and user_id = p_user and status = 'approved') then
    raise exception 'not_found';
  end if;
  p_amount := coalesce(p_amount, v_exp.split_amount);
  if p_paid and p_amount < v_exp.split_amount then raise exception 'invalid_input: at least %', v_exp.split_amount; end if;
  insert into expense_payments (expense_id, user_id, amount, paid_at, recorded_by)
  values (p_expense, p_user, p_amount, case when p_paid then now() end, auth.uid())
  on conflict (expense_id, user_id) do update
    set paid_at = case when p_paid then coalesce(expense_payments.paid_at, now()) end,
        amount = excluded.amount, recorded_by = auth.uid();
end;
$$;

-- Close (stop collecting) or delete. Reps can withdraw their own pending request.
create or replace function public.close_expense(p_expense uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v_exp expenses%rowtype;
begin
  select * into v_exp from expenses where id = p_expense;
  if not found or not public.is_room_admin(v_exp.room_id) then raise exception 'not_allowed'; end if;
  update expenses set status = 'closed' where id = p_expense;
end;
$$;

create or replace function public.delete_expense(p_expense uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v_exp expenses%rowtype;
begin
  select * into v_exp from expenses where id = p_expense;
  if not found or not (public.is_room_admin(v_exp.room_id)
                       or (v_exp.created_by = auth.uid() and v_exp.status = 'requested')) then
    raise exception 'not_allowed';
  end if;
  delete from expenses where id = p_expense;
end;
$$;

-- ---------------------------------------------------------------------------
-- 6. The birthday wall: notes classmates stick up; revealed on the day
-- ---------------------------------------------------------------------------
create table public.wishes (
  id              uuid primary key default gen_random_uuid(),
  celebration_id  uuid not null references public.celebrations (id) on delete cascade,
  author_id       uuid not null references public.profiles (id) on delete cascade,
  message         text not null check (char_length(btrim(message)) between 1 and 500),
  is_private      boolean not null default false,
  color           text not null default 'sun' check (color in ('sun', 'pink', 'mint', 'sky', 'white')),
  x               real not null default 50 check (x between 0 and 100),
  y               real not null default 50 check (y between 0 and 100),
  rotation        real not null default 0 check (rotation between -15 and 15),
  created_at      timestamptz not null default now()
);
create index wishes_celebration_idx on public.wishes (celebration_id, created_at);
alter table public.wishes enable row level security;

create or replace function public.today_ist()
returns date language sql stable as $$ select (now() at time zone 'Asia/Kolkata')::date; $$;

create or replace function public.add_wish(p_celebration uuid, p_message text, p_private boolean, p_color text)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_cel celebrations%rowtype; v_id uuid;
begin
  select * into v_cel from celebrations where id = p_celebration;
  -- Any birthday can get wishes (celebrated or wish only), never from the birthday person.
  if not found or v_cel.birthday_user_id = auth.uid() or not public.is_room_member(v_cel.room_id) then
    raise exception 'not_found';
  end if;
  if (select count(*) from wishes where celebration_id = p_celebration and author_id = auth.uid()) >= 5 then
    raise exception 'invalid_input: up to 5 notes each';
  end if;
  insert into wishes (celebration_id, author_id, message, is_private, color, x, y, rotation)
  values (p_celebration, auth.uid(), btrim(p_message), coalesce(p_private, false), coalesce(p_color, 'sun'),
          4 + random() * 70, 4 + random() * 72, -6 + random() * 12)
  returning id into v_id;
  return v_id;
end;
$$;

-- What the caller may know about a wall. The birthday person gets nothing before the day.
create or replace function public.wall_info(p_celebration uuid)
returns table (celebration_id uuid, room_id uuid, room_name text, birthday_name text, celebration_date date,
               revealed boolean, is_birthday_person boolean, plan text, wish_count integer)
language plpgsql stable security definer set search_path = public as $$
declare v_cel celebrations%rowtype; v_me boolean;
begin
  select * into v_cel from celebrations where id = p_celebration;
  if not found or not public.is_room_member(v_cel.room_id) then raise exception 'not_found'; end if;
  v_me := v_cel.birthday_user_id = auth.uid();
  if v_me and public.today_ist() < v_cel.celebration_date then raise exception 'not_found'; end if;
  return query
  select v_cel.id, v_cel.room_id, r.name, p.full_name, v_cel.celebration_date,
         public.today_ist() >= v_cel.celebration_date, v_me,
         case when v_me or v_cel.decision = 'celebrate' or public.is_room_admin(v_cel.room_id) then v_cel.plan end,
         (select count(*)::int from wishes w where w.celebration_id = v_cel.id)
  from rooms r, profiles p
  where r.id = v_cel.room_id and p.id = v_cel.birthday_user_id;
end;
$$;

-- Birthday person (from the day): every note. Classmates: public notes + their own private ones.
create or replace function public.wall_wishes(p_celebration uuid)
returns table (id uuid, author_id uuid, author_name text, message text, is_private boolean, color text,
               x real, y real, rotation real, created_at timestamptz)
language plpgsql stable security definer set search_path = public as $$
declare v_cel celebrations%rowtype; v_me boolean;
begin
  select * into v_cel from celebrations where celebrations.id = p_celebration;
  if not found or not public.is_room_member(v_cel.room_id) then raise exception 'not_found'; end if;
  v_me := v_cel.birthday_user_id = auth.uid();
  if v_me and public.today_ist() < v_cel.celebration_date then raise exception 'not_found'; end if;
  return query
  select w.id, w.author_id, p.full_name, w.message, w.is_private, w.color, w.x, w.y, w.rotation, w.created_at
  from wishes w join profiles p on p.id = w.author_id
  where w.celebration_id = p_celebration
    and (v_me or not w.is_private or w.author_id = auth.uid())
  order by w.created_at;
end;
$$;

-- Authors move their own notes; on the day the birthday person can arrange them all.
create or replace function public.move_wish(p_wish uuid, p_x real, p_y real)
returns void language plpgsql security definer set search_path = public as $$
declare v_w wishes%rowtype; v_cel celebrations%rowtype;
begin
  select * into v_w from wishes where id = p_wish;
  if not found then raise exception 'not_found'; end if;
  select * into v_cel from celebrations where id = v_w.celebration_id;
  if not (v_w.author_id = auth.uid()
          or (v_cel.birthday_user_id = auth.uid() and public.today_ist() >= v_cel.celebration_date)) then
    raise exception 'not_allowed';
  end if;
  update wishes set x = least(greatest(p_x, 0), 100), y = least(greatest(p_y, 0), 100) where id = p_wish;
end;
$$;

-- Authors delete their own; admins can remove anything inappropriate.
create or replace function public.delete_wish(p_wish uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v_w wishes%rowtype; v_cel celebrations%rowtype;
begin
  select * into v_w from wishes where id = p_wish;
  if not found then raise exception 'not_found'; end if;
  select * into v_cel from celebrations where id = v_w.celebration_id;
  if not (v_w.author_id = auth.uid()
          or (public.is_room_admin(v_cel.room_id) and v_cel.birthday_user_id <> auth.uid())) then
    raise exception 'not_allowed';
  end if;
  delete from wishes where id = p_wish;
end;
$$;

-- The caller's own revealed walls (birthday today or in the last 30 days).
create or replace function public.my_birthday_walls()
returns table (celebration_id uuid, room_id uuid, room_name text, celebration_date date, wish_count integer)
language sql stable security definer set search_path = public as $$
  select c.id, c.room_id, r.name, c.celebration_date,
         (select count(*)::int from wishes w where w.celebration_id = c.id)
  from celebrations c join rooms r on r.id = c.room_id
  where c.birthday_user_id = auth.uid()
    and c.celebration_date between public.today_ist() - 30 and public.today_ist()
  order by c.celebration_date desc;
$$;

-- ---------------------------------------------------------------------------
-- 7. Reminder job: priority flag, and the birthday wish opens the wall
-- ---------------------------------------------------------------------------
drop function if exists public.prepare_due_reminders(timestamptz);
create function public.prepare_due_reminders(p_now timestamptz default now())
returns table (notification_id uuid, user_id uuid, title text, body text, url text, priority boolean)
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

-- ---------------------------------------------------------------------------
-- 8. Privileges
-- ---------------------------------------------------------------------------
grant all on public.polls, public.poll_options, public.poll_votes,
             public.expenses, public.expense_payments, public.wishes to service_role;

revoke execute on function public.prepare_due_reminders(timestamptz) from public, anon, authenticated;
grant execute on function public.prepare_due_reminders(timestamptz) to service_role;

grant execute on function
  public.is_room_rep(uuid), public.celebration_split(uuid), public.set_celebration_details(uuid, text, integer, text),
  public.open_surprise(uuid), public.celebration_payers(uuid), public.record_celebration_payment(uuid, uuid, boolean, integer),
  public.can_view_celebration(uuid), public.create_poll(uuid, text, jsonb), public.poll_view(uuid),
  public.vote_poll(uuid, uuid), public.close_poll(uuid), public.delete_poll(uuid),
  public.room_member_count(uuid), public.request_expense(uuid, text, text, integer, uuid, date),
  public.decide_expense(uuid, boolean), public.room_expenses(uuid), public.mark_expense_paid(uuid, boolean, integer),
  public.expense_payers(uuid), public.record_expense_payment(uuid, uuid, boolean, integer),
  public.close_expense(uuid), public.delete_expense(uuid),
  public.today_ist(), public.add_wish(uuid, text, boolean, text), public.wall_info(uuid), public.wall_wishes(uuid),
  public.move_wish(uuid, real, real), public.delete_wish(uuid), public.my_birthday_walls()
to authenticated;

-- Class reps pick which UPI ID collects a split (they can't read the full UPI table).
create or replace function public.room_upi_choices(p_room uuid)
returns table (id uuid, upi_id text, payee_name text)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_room_rep(p_room) then raise exception 'not_allowed'; end if;
  return query
  select a.id, a.upi_id, a.payee_name from room_upi_accounts a
  where a.room_id = p_room and a.active order by a.sort_order;
end;
$$;
grant execute on function public.room_upi_choices(uuid) to authenticated;
