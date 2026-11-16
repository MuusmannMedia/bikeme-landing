-- Admin/service-role user overview for safe test-user audits.
-- This view is intentionally not exposed to anon/authenticated clients.

BEGIN;

DROP VIEW IF EXISTS public.admin_user_overview;

CREATE VIEW public.admin_user_overview AS
SELECT
  au.id AS user_id,
  au.email,
  au.created_at AS auth_created_at,
  au.last_sign_in_at,
  au.email_confirmed_at,
  au.phone,
  au.raw_app_meta_data,
  au.raw_user_meta_data,

  p.id IS NOT NULL AS has_profile,
  p.display_name,
  p.avatar_url,
  p.created_at AS profile_created_at,
  p.updated_at AS profile_updated_at,
  p.bike_type AS profile_bike_type,
  p.level_desc AS profile_level_desc,
  p.home_region AS profile_home_region,
  p.about_me AS profile_about_me,
  p.unit_system AS profile_unit_system,
  p.height_cm AS profile_height_cm,
  p.weight_kg AS profile_weight_kg,

  ua.user_id IS NOT NULL AS has_user_access,
  COALESCE(ua.access_level, 'basic') AS access_level,
  ua.access_source,
  ua.access_expires_at,
  ua.granted_at,
  ua.created_at AS access_created_at,
  ua.updated_at AS access_updated_at,

  fr.user_id IS NOT NULL AS has_founding_rider,
  fr.source AS founding_source,
  fr.granted_at AS founding_granted_at,
  fr.pro_starts_at,
  fr.pro_expires_at,
  fr.notes AS founding_notes,
  fr.created_at AS founding_created_at,
  fr.updated_at AS founding_updated_at,

  COALESCE(hosted_rides.hosted_rides_count, 0::bigint) AS hosted_rides_count,
  COALESCE(joined_participants.joined_participants_count, 0::bigint) AS joined_participants_count,
  COALESCE(ride_history.ride_history_count, 0::bigint) AS ride_history_count,
  COALESCE(sent_invites.sent_invites_count, 0::bigint) AS sent_invites_count,
  COALESCE(received_invites.received_invites_count, 0::bigint) AS received_invites_count,
  COALESCE(push_tokens.push_tokens_count, 0::bigint) AS push_tokens_count,
  COALESCE(notification_log_sent.notification_log_sent_count, 0::bigint) AS notification_log_sent_count,
  COALESCE(notification_log_received.notification_log_received_count, 0::bigint) AS notification_log_received_count,
  COALESCE(rider_reports_sent.rider_reports_sent_count, 0::bigint) AS rider_reports_sent_count,
  COALESCE(rider_reports_received.rider_reports_received_count, 0::bigint) AS rider_reports_received_count,
  COALESCE(planned_routes_created.planned_routes_created_count, 0::bigint) AS planned_routes_created_count
FROM auth.users au
LEFT JOIN public.profiles p ON p.id = au.id
LEFT JOIN public.user_access ua ON ua.user_id = au.id
LEFT JOIN public.founding_riders fr ON fr.user_id = au.id
LEFT JOIN (
  SELECT
    r.host_id AS user_id,
    COUNT(*)::bigint AS hosted_rides_count
  FROM public.rides r
  GROUP BY r.host_id
) hosted_rides ON hosted_rides.user_id = au.id
LEFT JOIN (
  SELECT
    p.user_id,
    COUNT(*)::bigint AS joined_participants_count
  FROM public.participants p
  WHERE p.role::text <> 'HOST'
  GROUP BY p.user_id
) joined_participants ON joined_participants.user_id = au.id
LEFT JOIN (
  SELECT
    rh.owner_id AS user_id,
    COUNT(*)::bigint AS ride_history_count
  FROM public.ride_history rh
  GROUP BY rh.owner_id
) ride_history ON ride_history.user_id = au.id
LEFT JOIN (
  SELECT
    ri.host_id AS user_id,
    COUNT(*)::bigint AS sent_invites_count
  FROM public.ride_invites ri
  GROUP BY ri.host_id
) sent_invites ON sent_invites.user_id = au.id
LEFT JOIN (
  SELECT
    ri.invitee_id AS user_id,
    COUNT(*)::bigint AS received_invites_count
  FROM public.ride_invites ri
  GROUP BY ri.invitee_id
) received_invites ON received_invites.user_id = au.id
LEFT JOIN (
  SELECT
    pt.user_id,
    COUNT(*)::bigint AS push_tokens_count
  FROM public.push_tokens pt
  GROUP BY pt.user_id
) push_tokens ON push_tokens.user_id = au.id
LEFT JOIN (
  SELECT
    nl.sender_user_id AS user_id,
    COUNT(*)::bigint AS notification_log_sent_count
  FROM public.notification_log nl
  GROUP BY nl.sender_user_id
) notification_log_sent ON notification_log_sent.user_id = au.id
LEFT JOIN (
  SELECT
    nl.recipient_user_id AS user_id,
    COUNT(*)::bigint AS notification_log_received_count
  FROM public.notification_log nl
  GROUP BY nl.recipient_user_id
) notification_log_received ON notification_log_received.user_id = au.id
LEFT JOIN (
  SELECT
    rr.reporter_user_id AS user_id,
    COUNT(*)::bigint AS rider_reports_sent_count
  FROM public.rider_reports rr
  GROUP BY rr.reporter_user_id
) rider_reports_sent ON rider_reports_sent.user_id = au.id
LEFT JOIN (
  SELECT
    rr.reported_user_id AS user_id,
    COUNT(*)::bigint AS rider_reports_received_count
  FROM public.rider_reports rr
  GROUP BY rr.reported_user_id
) rider_reports_received ON rider_reports_received.user_id = au.id
LEFT JOIN (
  SELECT
    rpr.created_by AS user_id,
    COUNT(*)::bigint AS planned_routes_created_count
  FROM public.ride_planned_routes rpr
  GROUP BY rpr.created_by
) planned_routes_created ON planned_routes_created.user_id = au.id;

ALTER VIEW public.admin_user_overview SET (security_invoker = true);
REVOKE ALL ON public.admin_user_overview FROM PUBLIC;
REVOKE ALL ON public.admin_user_overview FROM anon, authenticated;
GRANT SELECT ON public.admin_user_overview TO service_role;

COMMIT;
