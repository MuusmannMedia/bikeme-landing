-- Operational rollback, NOT a forward migration. Test project only.
-- Run ONLY through backend/scripts/test-project.cjs, whose project guard runs
-- before each request. Keep migration history, accepted memberships and data.
BEGIN;
UPDATE club_private.visit_flags
SET visits=false, applications=false, rides=false, images=false
WHERE singleton;
COMMIT;
