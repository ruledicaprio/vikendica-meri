-- The language the guest was reading the site in when they enquired.
--
-- The public site is rendered once per locale, so the form already knows this;
-- capturing it means the manager panel can offer a reply in the language the
-- guest actually used instead of guessing from a name or a phone prefix.
--
-- Nullable on purpose: existing rows predate the column and fall back to 'bs'.
ALTER TABLE requests ADD COLUMN lang TEXT;
