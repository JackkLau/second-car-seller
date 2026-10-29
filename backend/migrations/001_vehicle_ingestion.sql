CREATE TABLE data_sources (
  id text PRIMARY KEY CHECK (id IN ('dongchedi','yiche','guazi','autohome')),
  name text NOT NULL,
  homepage_url text NOT NULL
);
INSERT INTO data_sources (id, name, homepage_url) VALUES
  ('dongchedi', '懂车帝', 'https://www.dongchedi.com/'),
  ('yiche', '易车 / 淘车车', 'https://yiche.taocheche.com.cn/'),
  ('guazi', '瓜子二手车', 'https://www.guazi.com/'),
  ('autohome', '汽车之家 / 二手车之家', 'https://www.che168.com/');

CREATE TABLE listings (
  id uuid PRIMARY KEY,
  source_id text NOT NULL REFERENCES data_sources(id),
  external_id text NOT NULL CHECK (length(external_id) BETWEEN 1 AND 200),
  first_seen_at timestamptz NOT NULL,
  last_seen_at timestamptz NOT NULL,
  current_observed_at timestamptz,
  current_snapshot_id uuid,
  UNIQUE (source_id, external_id),
  CHECK (last_seen_at >= first_seen_at)
);

CREATE TABLE ingestion_jobs (
  id uuid PRIMARY KEY,
  source_id text NOT NULL REFERENCES data_sources(id),
  source_url text NOT NULL,
  mode text NOT NULL CHECK (mode IN ('public_page','authorized_import','manual_capture')),
  status text NOT NULL DEFAULT 'running' CHECK (status IN ('running','succeeded','failed')),
  code text,
  message text CHECK (message IS NULL OR length(message) <= 500),
  listing_id uuid REFERENCES listings(id),
  started_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  finished_at timestamptz,
  CHECK ((status = 'running' AND finished_at IS NULL) OR (status <> 'running' AND finished_at IS NOT NULL)),
  CHECK (status <> 'succeeded' OR listing_id IS NOT NULL)
);

CREATE TABLE listing_snapshots (
  id uuid PRIMARY KEY,
  listing_id uuid NOT NULL REFERENCES listings(id),
  job_id uuid REFERENCES ingestion_jobs(id),
  content_hash text NOT NULL CHECK (content_hash ~ '^[a-f0-9]{64}$'),
  source_url text NOT NULL,
  source_method text NOT NULL CHECK (source_method IN ('public_page','authorized_import','manual_capture')),
  authorization_reference text,
  observed_at timestamptz NOT NULL,
  recorded_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  title text NOT NULL CHECK (length(title) > 0),
  brand text,
  model text,
  trim text,
  model_year integer CHECK (model_year BETWEEN 1900 AND 2100),
  registration_month text CHECK (registration_month ~ '^[0-9]{4}-(0[1-9]|1[0-2])$'),
  mileage_km integer CHECK (mileage_km BETWEEN 0 AND 10000000),
  energy text,
  transmission text,
  seats integer CHECK (seats BETWEEN 1 AND 100),
  color text,
  city text,
  price_cny numeric(14,2) CHECK (price_cny > 0 AND price_cny <> 'NaN'::numeric),
  service_fee_cny numeric(14,2) CHECK (service_fee_cny >= 0 AND service_fee_cny <> 'NaN'::numeric),
  transfer_fee_cny numeric(14,2) CHECK (transfer_fee_cny >= 0 AND transfer_fee_cny <> 'NaN'::numeric),
  transfer_count integer CHECK (transfer_count >= 0),
  listing_status text NOT NULL CHECK (listing_status IN ('unknown','listed','delisted')),
  normalized_payload jsonb NOT NULL CHECK (jsonb_typeof(normalized_payload) = 'object'),
  UNIQUE (listing_id, content_hash),
  UNIQUE (listing_id, id),
  CHECK ((source_method = 'authorized_import' AND authorization_reference IS NOT NULL) OR (source_method <> 'authorized_import' AND authorization_reference IS NULL))
);
ALTER TABLE listings ADD CONSTRAINT listing_current_snapshot_same_listing
  FOREIGN KEY (id, current_snapshot_id) REFERENCES listing_snapshots(listing_id, id);

CREATE TABLE record_coverage (
  snapshot_id uuid NOT NULL REFERENCES listing_snapshots(id),
  domain text NOT NULL CHECK (domain IN ('inspection','insurance','claims','maintenance')),
  status text NOT NULL CHECK (status IN ('available','not_disclosed','requires_authorization','unavailable')),
  note text NOT NULL,
  PRIMARY KEY (snapshot_id, domain)
);

CREATE TABLE inspection_reports (
  id uuid PRIMARY KEY,
  snapshot_id uuid NOT NULL REFERENCES listing_snapshots(id),
  external_id text NOT NULL,
  inspected_on date,
  provider text,
  summary text NOT NULL,
  UNIQUE (snapshot_id, external_id)
);
CREATE TABLE inspection_items (
  report_id uuid NOT NULL REFERENCES inspection_reports(id),
  position integer NOT NULL CHECK (position >= 0),
  name text NOT NULL,
  result text NOT NULL CHECK (result IN ('reported_ok','attention','not_tested','unknown')),
  detail text NOT NULL,
  PRIMARY KEY (report_id, position)
);

CREATE TABLE insurance_policies (
  id uuid PRIMARY KEY,
  snapshot_id uuid NOT NULL REFERENCES listing_snapshots(id),
  external_id text NOT NULL,
  insurer text,
  policy_type text NOT NULL,
  starts_on date,
  ends_on date,
  premium_cny numeric(14,2) CHECK (premium_cny >= 0 AND premium_cny <> 'NaN'::numeric),
  coverage_summary text NOT NULL,
  UNIQUE (snapshot_id, external_id),
  CHECK (starts_on IS NULL OR ends_on IS NULL OR ends_on >= starts_on)
);
CREATE TABLE insurance_claims (
  id uuid PRIMARY KEY,
  snapshot_id uuid NOT NULL REFERENCES listing_snapshots(id),
  external_id text NOT NULL,
  occurred_on date,
  amount_cny numeric(14,2) CHECK (amount_cny >= 0 AND amount_cny <> 'NaN'::numeric),
  summary text NOT NULL,
  UNIQUE (snapshot_id, external_id)
);
CREATE TABLE maintenance_events (
  id uuid PRIMARY KEY,
  snapshot_id uuid NOT NULL REFERENCES listing_snapshots(id),
  external_id text NOT NULL,
  serviced_on date,
  mileage_km integer CHECK (mileage_km >= 0),
  provider text,
  summary text NOT NULL,
  cost_cny numeric(14,2) CHECK (cost_cny >= 0 AND cost_cny <> 'NaN'::numeric),
  UNIQUE (snapshot_id, external_id)
);

CREATE INDEX snapshots_listing_history ON listing_snapshots (listing_id, observed_at DESC);
CREATE INDEX snapshots_city_price ON listing_snapshots (city, price_cny);
CREATE INDEX listings_observed ON listings (last_seen_at DESC, id);
CREATE INDEX ingestion_jobs_recent ON ingestion_jobs (started_at DESC);
CREATE INDEX inspections_snapshot ON inspection_reports (snapshot_id);
CREATE INDEX policies_snapshot ON insurance_policies (snapshot_id);
CREATE INDEX claims_snapshot ON insurance_claims (snapshot_id);
CREATE INDEX maintenance_snapshot ON maintenance_events (snapshot_id);

COMMENT ON TABLE listing_snapshots IS 'Immutable source claims. normalized_payload is the validated ingestion envelope, not raw HTML. No inference of safety from missing history.';
COMMENT ON TABLE insurance_policies IS 'Actual authorized policy records only; excludes insurance estimates and manufacturer warranties.';
COMMENT ON TABLE inspection_items IS 'reported_ok means source reported a result, not independent verification by this application.';
