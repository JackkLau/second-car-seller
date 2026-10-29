import { createHash, randomUUID } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import {
  normalizeRecord,
  recordHash,
  assertObservationTime,
} from "./normalize.mjs";
import { validateSourceUrl, identifyListing } from "./sources.mjs";

const PLATFORM_IDS = new Set(["dongchedi", "yiche", "guazi", "autohome"]);
const MODES = new Set(["public_page", "authorized_import", "manual_capture"]);
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function boundedInteger(value, name, min, max) {
  if (!Number.isInteger(value) || value < min || value > max)
    throw new TypeError(`${name} must be an integer from ${min} to ${max}`);
  return value;
}

function iso(value) {
  return value instanceof Date
    ? value.toISOString()
    : new Date(value).toISOString();
}

export async function migrate(db) {
  // Bootstrap only; all application migrations are immutable and checksummed.
  await db.exec(`CREATE TABLE IF NOT EXISTS schema_migrations (
    version text PRIMARY KEY, checksum text NOT NULL, applied_at timestamptz NOT NULL DEFAULT clock_timestamp()
  )`);
  const directory = new URL("./migrations/", import.meta.url);
  const files = (await readdir(directory))
    .filter((name) => /^\d+_[a-z0-9_]+\.sql$/.test(name))
    .sort();
  for (const file of files) {
    const sql = await readFile(new URL(file, directory), "utf8");
    const checksum = createHash("sha256").update(sql).digest("hex");
    await db.transaction(async (tx) => {
      await tx.exec("LOCK TABLE schema_migrations IN EXCLUSIVE MODE");
      const existing = (
        await tx.query(
          "SELECT checksum FROM schema_migrations WHERE version = $1",
          [file],
        )
      ).rows[0];
      if (existing) {
        if (existing.checksum !== checksum)
          throw new Error(`Applied migration checksum changed: ${file}`);
        return;
      }
      await tx.exec(sql);
      await tx.query(
        "INSERT INTO schema_migrations (version, checksum) VALUES ($1, $2)",
        [file, checksum],
      );
    });
  }
}

export async function ingestRecord(
  db,
  input,
  { jobId = null, now = Date.now() } = {},
) {
  const record = normalizeRecord(input);
  assertObservationTime(record, now);
  if (jobId !== null && !UUID.test(jobId))
    throw new TypeError("jobId must be a UUID");
  const hash = recordHash(record);
  const { source, vehicle, listing } = record;
  return db.transaction(async (tx) => {
    if (jobId) {
      const job = (
        await tx.query(
          "SELECT source_id, source_url, mode, status FROM ingestion_jobs WHERE id = $1 FOR UPDATE",
          [jobId],
        )
      ).rows[0];
      if (
        !job ||
        job.status !== "running" ||
        job.source_id !== source.platform ||
        identifyListing(job.source_id, job.source_url) !== source.externalId ||
        job.mode !== source.method
      ) {
        throw new Error(
          "ingestion job must be running and match record source",
        );
      }
    }
    // UPSERT takes a row lock for the full transaction: simultaneous observations
    // for the same platform/listing serialize before selecting the current snapshot.
    const row = (
      await tx.query(
        `
      INSERT INTO listings (id, source_id, external_id, first_seen_at, last_seen_at)
      VALUES ($1, $2, $3, $4, $4)
      ON CONFLICT (source_id, external_id) DO UPDATE SET
        first_seen_at = LEAST(listings.first_seen_at, EXCLUDED.first_seen_at),
        last_seen_at = GREATEST(listings.last_seen_at, EXCLUDED.last_seen_at)
      RETURNING id, current_snapshot_id, current_observed_at`,
        [randomUUID(), source.platform, source.externalId, source.fetchedAt],
      )
    ).rows[0];
    let snapshot = (
      await tx.query(
        "SELECT id FROM listing_snapshots WHERE listing_id = $1 AND content_hash = $2",
        [row.id, hash],
      )
    ).rows[0];
    const changed = !snapshot;
    if (!snapshot) {
      snapshot = { id: randomUUID() };
      await tx.query(
        `INSERT INTO listing_snapshots (
        id, listing_id, job_id, content_hash, source_url, source_method, authorization_reference, observed_at,
        title, brand, model, trim, model_year, registration_month, mileage_km, energy, transmission, seats, color, city,
        price_cny, service_fee_cny, transfer_fee_cny, transfer_count, listing_status, normalized_payload
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26::jsonb)`,
        [
          snapshot.id,
          row.id,
          jobId,
          hash,
          source.url,
          source.method,
          source.authorizationReference,
          source.fetchedAt,
          vehicle.title,
          vehicle.brand,
          vehicle.model,
          vehicle.trim,
          vehicle.modelYear,
          vehicle.registrationMonth,
          vehicle.mileageKm,
          vehicle.energy,
          vehicle.transmission,
          vehicle.seats,
          vehicle.color,
          vehicle.city,
          listing.priceCny,
          listing.serviceFeeCny,
          listing.transferFeeCny,
          listing.transferCount,
          listing.status,
          JSON.stringify(record),
        ],
      );
      await saveRecords(tx, snapshot.id, record);
    }
    if (
      !row.current_snapshot_id ||
      new Date(source.fetchedAt) > new Date(row.current_observed_at)
    ) {
      await tx.query(
        "UPDATE listings SET current_snapshot_id = $2, current_observed_at = $3 WHERE id = $1",
        [row.id, snapshot.id, source.fetchedAt],
      );
    }
    return { listingId: row.id, snapshotId: snapshot.id, changed };
  });
}

async function saveRecords(tx, snapshotId, record) {
  for (const [domain, coverage] of Object.entries(record.coverage)) {
    await tx.query(
      "INSERT INTO record_coverage (snapshot_id, domain, status, note) VALUES ($1,$2,$3,$4)",
      [snapshotId, domain, coverage.status, coverage.note],
    );
  }
  for (const report of record.inspections) {
    const reportId = randomUUID();
    await tx.query(
      "INSERT INTO inspection_reports (id, snapshot_id, external_id, inspected_on, provider, summary) VALUES ($1,$2,$3,$4,$5,$6)",
      [
        reportId,
        snapshotId,
        report.externalId,
        report.inspectedOn,
        report.provider,
        report.summary,
      ],
    );
    for (const [position, item] of report.items.entries()) {
      await tx.query(
        "INSERT INTO inspection_items (report_id, position, name, result, detail) VALUES ($1,$2,$3,$4,$5)",
        [reportId, position, item.name, item.result, item.detail],
      );
    }
  }
  for (const policy of record.insurancePolicies) {
    await tx.query(
      "INSERT INTO insurance_policies (id, snapshot_id, external_id, insurer, policy_type, starts_on, ends_on, premium_cny, coverage_summary) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)",
      [
        randomUUID(),
        snapshotId,
        policy.externalId,
        policy.insurer,
        policy.policyType,
        policy.startsOn,
        policy.endsOn,
        policy.premiumCny,
        policy.coverageSummary,
      ],
    );
  }
  for (const claim of record.insuranceClaims) {
    await tx.query(
      "INSERT INTO insurance_claims (id, snapshot_id, external_id, occurred_on, amount_cny, summary) VALUES ($1,$2,$3,$4,$5,$6)",
      [
        randomUUID(),
        snapshotId,
        claim.externalId,
        claim.occurredOn,
        claim.amountCny,
        claim.summary,
      ],
    );
  }
  for (const event of record.maintenanceEvents) {
    await tx.query(
      "INSERT INTO maintenance_events (id, snapshot_id, external_id, serviced_on, mileage_km, provider, summary, cost_cny) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)",
      [
        randomUUID(),
        snapshotId,
        event.externalId,
        event.servicedOn,
        event.mileageKm,
        event.provider,
        event.summary,
        event.costCny,
      ],
    );
  }
}

const READ_CURRENT = `SELECT l.id, l.first_seen_at, l.last_seen_at, l.current_observed_at,
  s.id AS snapshot_id, s.normalized_payload
  FROM listings l JOIN listing_snapshots s ON s.id = l.current_snapshot_id`;

function listingView(row) {
  const record =
    typeof row.normalized_payload === "string"
      ? JSON.parse(row.normalized_payload)
      : row.normalized_payload;
  return {
    ...record,
    source: { ...record.source, fetchedAt: iso(row.current_observed_at) },
    listingId: row.id,
    snapshotId: row.snapshot_id,
    firstSeenAt: iso(row.first_seen_at),
    lastSeenAt: iso(row.last_seen_at),
  };
}

export async function listListings(
  db,
  { limit = 20, offset = 0, platform = null } = {},
) {
  boundedInteger(limit, "limit", 1, 100);
  boundedInteger(offset, "offset", 0, 1000000);
  if (platform !== null && !PLATFORM_IDS.has(platform))
    throw new TypeError("platform is invalid");
  const { rows } = await db.query(
    `${READ_CURRENT} WHERE ($1::text IS NULL OR l.source_id = $1)
    ORDER BY l.last_seen_at DESC, l.id ASC LIMIT $2 OFFSET $3`,
    [platform, limit, offset],
  );
  return rows.map(listingView);
}

export async function getListing(db, id) {
  if (!UUID.test(id)) return null;
  const row = (await db.query(`${READ_CURRENT} WHERE l.id = $1`, [id])).rows[0];
  return row ? listingView(row) : null;
}

export async function startJob(db, { platform, url, mode }) {
  if (!PLATFORM_IDS.has(platform)) throw new TypeError("platform is invalid");
  if (!MODES.has(mode)) throw new TypeError("mode is invalid");
  const sourceUrl = validateSourceUrl(platform, url);
  const id = randomUUID();
  await db.query(
    "INSERT INTO ingestion_jobs (id, source_id, source_url, mode) VALUES ($1,$2,$3,$4)",
    [id, platform, sourceUrl, mode],
  );
  return id;
}

export async function finishJob(
  db,
  id,
  { status, code = null, message = null, listingId = null },
) {
  if (!UUID.test(id)) throw new TypeError("job id must be a UUID");
  if (!["succeeded", "failed"].includes(status))
    throw new TypeError("job status must be succeeded or failed");
  if (listingId !== null && !UUID.test(listingId))
    throw new TypeError("listingId must be a UUID");
  if (status === "succeeded" && listingId === null)
    throw new TypeError("successful job needs listingId");
  if (
    code !== null &&
    (typeof code !== "string" || !/^[a-z0-9_]{1,80}$/.test(code))
  )
    throw new TypeError("job code is invalid");
  if (message !== null && (typeof message !== "string" || message.length > 500))
    throw new TypeError("job message is invalid");
  // Callers must pass a bounded public error description, never raw upstream HTML,
  // request headers, database connection strings or provider error dumps.
  const job = (
    await db.query(
      "SELECT source_id, source_url FROM ingestion_jobs WHERE id=$1",
      [id],
    )
  ).rows[0];
  const externalId = job
    ? identifyListing(job.source_id, job.source_url)
    : null;
  const result = await db.query(
    `UPDATE ingestion_jobs SET status=$2, code=$3, message=$4, listing_id=$5,
    finished_at=clock_timestamp() WHERE id=$1 AND status='running'
    AND ($5::uuid IS NULL OR EXISTS (
      SELECT 1 FROM listings l
      WHERE l.id=$5 AND l.source_id=ingestion_jobs.source_id AND l.external_id=$6
    )) RETURNING id`,
    [id, status, code, message, listingId, externalId],
  );
  if (!result.rows.length)
    throw new Error(
      "job is missing, already finished, or listing does not match; only running jobs may finish",
    );
}

export async function listJobs(db, { limit = 20 } = {}) {
  boundedInteger(limit, "limit", 1, 100);
  const { rows } = await db.query(
    "SELECT * FROM ingestion_jobs ORDER BY started_at DESC, id ASC LIMIT $1",
    [limit],
  );
  return rows.map((row) => ({
    id: row.id,
    platform: row.source_id,
    url: row.source_url,
    mode: row.mode,
    status: row.status,
    code: row.code,
    message: row.message,
    listingId: row.listing_id,
    startedAt: iso(row.started_at),
    finishedAt: row.finished_at ? iso(row.finished_at) : null,
  }));
}
