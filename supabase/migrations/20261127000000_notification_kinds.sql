-- bdap: new notification kinds for the admin approval flow.
-- Kept in its own file: Postgres can't use a new enum value in the same
-- transaction that adds it, and the next migration uses these.

alter type public.notification_kind add value if not exists 'decision_needed';
alter type public.notification_kind add value if not exists 'wish_reminder';
alter type public.notification_kind add value if not exists 'birthday_wish';
