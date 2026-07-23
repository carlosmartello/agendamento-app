CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

DO $$
DECLARE
  admin_password text := current_setting('app.bootstrap_admin_password', true);
BEGIN
  IF admin_password IS NULL OR btrim(admin_password) = '' THEN
    RAISE NOTICE 'Skipping admin password update because app.bootstrap_admin_password is not set.';
    RETURN;
  END IF;

  UPDATE auth.users
  SET
    encrypted_password = extensions.crypt(admin_password, extensions.gen_salt('bf')),
    email_confirmed_at = COALESCE(email_confirmed_at, now()),
    updated_at = now()
  WHERE email = 'emailadmin@studio.app';
END $$;
