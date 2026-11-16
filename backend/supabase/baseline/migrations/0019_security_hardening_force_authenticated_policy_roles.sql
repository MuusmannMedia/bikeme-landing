-- Force legacy anon/public RLS policies to authenticated on core app tables.
-- Keeps existing USING/WITH CHECK expressions intact and only changes policy roles.

BEGIN;

DO $$
DECLARE
  policy_row RECORD;
BEGIN
  FOR policy_row IN
    SELECT schemaname, tablename, policyname
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = ANY (
        ARRAY[
          'participants',
          'profiles',
          'push_tokens',
          'ride_history',
          'ride_invites',
          'ride_planned_routes',
          'rides',
          'user_access'
        ]
      )
      AND ('anon' = ANY (roles) OR 'public' = ANY (roles))
  LOOP
    EXECUTE format(
      'ALTER POLICY %I ON %I.%I TO authenticated',
      policy_row.policyname,
      policy_row.schemaname,
      policy_row.tablename
    );
  END LOOP;
END
$$;

DO $$
DECLARE
  storage_policy_row RECORD;
BEGIN
  FOR storage_policy_row IN
    SELECT schemaname, tablename, policyname
    FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename = 'objects'
      AND ('anon' = ANY (roles) OR 'public' = ANY (roles))
  LOOP
    EXECUTE format(
      'ALTER POLICY %I ON %I.%I TO authenticated',
      storage_policy_row.policyname,
      storage_policy_row.schemaname,
      storage_policy_row.tablename
    );
  END LOOP;
END
$$;

COMMIT;
