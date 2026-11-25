-- bdap: fix "invalid regular expression: invalid repetition count(s)".
--
-- Postgres regexes allow repetition counts up to 255, so the original UPI ID
-- check ({2,256}) failed whenever a UPI ID was saved (e.g. creating a room).
-- Same rule, written so Postgres accepts it: the length cap moves to
-- char_length().

alter table public.room_upi_accounts drop constraint if exists room_upi_accounts_upi_id_check;

alter table public.room_upi_accounts
  add constraint room_upi_accounts_upi_id_check
  check (
    upi_id ~ '^[A-Za-z0-9._-]{2,}@[A-Za-z]{2,64}$'
    and char_length(upi_id) <= 320
  );
