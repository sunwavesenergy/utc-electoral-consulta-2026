CREATE TABLE IF NOT EXISTS voters (
  cedula TEXT PRIMARY KEY NOT NULL,
  name TEXT NOT NULL,
  polling_place TEXT NOT NULL,
  station TEXT NOT NULL,
  campus TEXT NOT NULL DEFAULT '',
  address TEXT NOT NULL DEFAULT '',
  maps_url TEXT NOT NULL DEFAULT ''
);
CREATE TABLE IF NOT EXISTS lookup_limits (
  ip_hash TEXT PRIMARY KEY NOT NULL,
  window_start INTEGER NOT NULL,
  request_count INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS voters_polling_place_idx ON voters(polling_place);
