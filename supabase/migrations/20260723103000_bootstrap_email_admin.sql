-- Guarantees the requested admin account exists for the studio panel.
-- Set app.bootstrap_admin_password before running this migration to choose
-- the initial password. The deployed database was updated separately.
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

DO $$
DECLARE
  admin_user_id uuid;
  admin_password text := COALESCE(
    NULLIF(current_setting('app.bootstrap_admin_password', true), ''),
    encode(gen_random_bytes(24), 'hex')
  );
BEGIN
  SELECT id INTO admin_user_id
  FROM auth.users
  WHERE email = 'emailadmin@studio.app'
  LIMIT 1;

  IF admin_user_id IS NULL THEN
    admin_user_id := gen_random_uuid();

    INSERT INTO auth.users (
      id,
      instance_id,
      aud,
      role,
      email,
      encrypted_password,
      email_confirmed_at,
      created_at,
      updated_at,
      raw_app_meta_data,
      raw_user_meta_data,
      is_super_admin,
      confirmation_token,
      email_change,
      email_change_token_new,
      recovery_token
    )
    VALUES (
      admin_user_id,
      '00000000-0000-0000-0000-000000000000',
      'authenticated',
      'authenticated',
      'emailadmin@studio.app',
      extensions.crypt(admin_password, extensions.gen_salt('bf')),
      now(),
      now(),
      now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      '{}'::jsonb,
      false,
      '',
      '',
      '',
      ''
    );
  ELSE
    UPDATE auth.users
    SET
      encrypted_password = extensions.crypt(admin_password, extensions.gen_salt('bf')),
      email_confirmed_at = COALESCE(email_confirmed_at, now()),
      updated_at = now()
    WHERE id = admin_user_id;
  END IF;

  INSERT INTO public.user_roles (user_id, role)
  VALUES (admin_user_id, 'admin')
  ON CONFLICT (user_id, role) DO NOTHING;

  INSERT INTO auth.identities (
    id,
    user_id,
    identity_data,
    provider,
    provider_id,
    last_sign_in_at,
    created_at,
    updated_at
  )
  VALUES (
    admin_user_id,
    admin_user_id,
    jsonb_build_object(
      'sub', admin_user_id::text,
      'email', 'emailadmin@studio.app',
      'email_verified', true,
      'phone_verified', false
    ),
    'email',
    'emailadmin@studio.app',
    now(),
    now(),
    now()
  )
  ON CONFLICT (provider, provider_id) DO UPDATE
  SET
    user_id = EXCLUDED.user_id,
    identity_data = EXCLUDED.identity_data,
    updated_at = now();
END $$;
