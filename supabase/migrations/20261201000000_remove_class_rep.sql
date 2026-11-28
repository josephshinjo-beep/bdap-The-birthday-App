-- bdap: retire the class rep role.
--
-- Class reps could start expense splits (for a moderator to approve) and record who
-- paid. Those powers now belong to moderators and co-moderators only, and any class
-- rep becomes a member. Postgres can't drop an enum value, so 'class_rep' stays in
-- member_role but nothing can assign it any more. Safe to run more than once.

update public.memberships set role = 'member' where role = 'class_rep';

-- Splits, payments and the UPI picker were "admins and class reps": now admins only.
create or replace function public.is_room_rep(p_room uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from memberships
    where room_id = p_room and user_id = auth.uid() and status = 'approved'
      and role in ('moderator', 'co_moderator')
  );
$$;

create or replace function public.set_member_role(p_room uuid, p_user uuid, p_role public.member_role)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_room_moderator(p_room) then raise exception 'not_allowed'; end if;
  if p_role = 'moderator' then raise exception 'use_transfer'; end if;
  if p_role = 'class_rep' then raise exception 'invalid_input'; end if;
  if p_user = auth.uid() then raise exception 'cannot_change_self'; end if;
  update memberships set role = p_role
   where room_id = p_room and user_id = p_user and status = 'approved' and role <> 'moderator';
  if not found then raise exception 'member_not_found'; end if;
end;
$$;
