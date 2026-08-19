-- Booking requests and manual blocks.
--
-- Every row here is either something a guest submitted through the site or
-- something the owner entered in the manager panel. Declining moves `status`
-- to 'declined'; nothing in the application deletes a row, so the history of
-- who asked for what survives.

CREATE TABLE IF NOT EXISTS requests (
  id          TEXT PRIMARY KEY,
  created_at  TEXT NOT NULL,
  updated_at  TEXT,

  name        TEXT NOT NULL,
  email       TEXT NOT NULL,
  phone       TEXT,
  -- Nullable on purpose: the public form does not require dates, so an enquiry
  -- can legitimately arrive without them. Such a row never blocks the calendar.
  checkin     TEXT,
  checkout    TEXT,
  guests      INTEGER,
  message     TEXT,

  -- pending | confirmed | declined | cancelled
  status      TEXT NOT NULL DEFAULT 'pending',
  -- site | manual | airbnb | booking
  source      TEXT NOT NULL DEFAULT 'site',

  owner_note  TEXT,
  -- Only for rate limiting. Never returned by any endpoint.
  client_ip   TEXT
);

-- The availability query filters by status and overlapping dates.
CREATE INDEX IF NOT EXISTS idx_requests_dates ON requests (status, checkin, checkout);
-- The rate limiter counts recent rows per IP.
CREATE INDEX IF NOT EXISTS idx_requests_ip ON requests (client_ip, created_at);

-- Reserved for Phase 3 (Airbnb / Booking.com iCal import). Created now so the
-- availability query can be written against its final shape, but nothing writes
-- to it yet.
CREATE TABLE IF NOT EXISTS ical_blocks (
  uid        TEXT PRIMARY KEY,
  source     TEXT NOT NULL,
  checkin    TEXT NOT NULL,
  checkout   TEXT NOT NULL,
  summary    TEXT,
  synced_at  TEXT
);
