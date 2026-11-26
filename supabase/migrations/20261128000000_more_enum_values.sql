-- bdap: new role and notification kinds. Kept separate because Postgres
-- can't use a new enum value in the same transaction that adds it.

alter type public.member_role add value if not exists 'class_rep';

alter type public.notification_kind add value if not exists 'expense_request';
alter type public.notification_kind add value if not exists 'expense_approved';
alter type public.notification_kind add value if not exists 'poll_open';
alter type public.notification_kind add value if not exists 'wall_ready';
