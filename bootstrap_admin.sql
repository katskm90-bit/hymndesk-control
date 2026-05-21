-- ============================================================================
-- HymnDesk Control · Admin Bootstrap
-- ----------------------------------------------------------------------------
-- Run this ONCE, after you have:
--   1. Created your auth.users entry via the Supabase dashboard
--      (Authentication → Users → Add user → Send email = OFF, set password manually).
--   2. Confirmed that user (mark email_confirmed_at if needed).
--
-- This script:
--   • Looks up your auth user by email
--   • Inserts a matching public.users row with the Admin role
--   • Marks the row active and confirmed
-- ----------------------------------------------------------------------------
-- BEFORE RUNNING: change the email and full name below to YOURS.
-- ============================================================================

do $$
declare
  v_email      citext := 'kats.km90@gmail.com';   -- ← change to your email
  v_full_name  text   := 'Katleho Mokoena';        -- ← change to your name
  v_auth_id    uuid;
  v_admin_role uuid;
begin
  select id into v_auth_id from auth.users where email = v_email::text;
  if v_auth_id is null then
    raise exception 'No auth.users row found for %. Create the user in Authentication → Users first.', v_email;
  end if;

  select id into v_admin_role from public.roles where name = 'Admin';
  if v_admin_role is null then
    raise exception 'Admin role not found. Run the main schema first.';
  end if;

  insert into public.users (id, email, full_name, role_id, confirmed_status, is_active)
  values (v_auth_id, v_email, v_full_name, v_admin_role, 'Confirmed', true)
  on conflict (id) do update
    set email = excluded.email,
        full_name = excluded.full_name,
        role_id = excluded.role_id,
        confirmed_status = 'Confirmed',
        is_active = true;

  raise notice 'Admin bootstrap complete for %', v_email;
end $$;
