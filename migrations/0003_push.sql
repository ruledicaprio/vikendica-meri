-- Phones that asked for push notifications from the manager panel.
--
-- One row per browser push subscription (a phone, or a desktop browser). The
-- endpoint is the push service URL for that device; p256dh and auth are the
-- keys its notifications are encrypted with. Rows the push service reports as
-- gone (404/410) are deleted by worker/push.js.
CREATE TABLE IF NOT EXISTS push_subscriptions (
  endpoint    TEXT PRIMARY KEY,
  p256dh      TEXT NOT NULL,
  auth        TEXT NOT NULL,
  created_at  TEXT NOT NULL
);
