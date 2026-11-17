BEGIN;
-- Test deployment now; production requires its own reviewed rollout approval.
CREATE EXTENSION IF NOT EXISTS pg_cron;
-- Fixed real clock, no client-controlled time, no legacy tables.
SELECT cron.schedule('club-visit-retention','*/15 * * * *',$job$SELECT club_private.visit_maintenance();$job$);
COMMIT;
