-- bdap: a date of birth can't be changed after it's saved.
-- Stops people moving their birthday around (for example to dodge or repeat a
-- celebration). The app owner can still fix a genuine mistake from the
-- Supabase SQL editor, where auth.uid() is null.

-- 1. Signed-in users lose the right to update the column at all.
revoke update (dob) on public.profiles from authenticated, anon;

-- 2. Belt and braces: reject any change made through the API, even if a
--    future migration grants the column again by accident.
create or replace function public.lock_profile_dob()
returns trigger language plpgsql set search_path = public as $$
begin
  if new.dob is distinct from old.dob and auth.uid() is not null then
    raise exception 'dob_locked: your date of birth can''t be changed after it''s saved';
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_dob_locked on public.profiles;
create trigger profiles_dob_locked before update of dob on public.profiles
  for each row execute function public.lock_profile_dob();
