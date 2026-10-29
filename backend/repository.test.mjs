import assert from "node:assert/strict";
import { test } from "node:test";
import { PGlite } from "@electric-sql/pglite";
import {
  migrate,
  ingestRecord as ingestRecordAtClock,
  getListing,
  listListings,
  startJob,
  finishJob,
  listJobs,
} from "./repository.mjs";

function ingestRecord(db, input, options = {}) {
  return ingestRecordAtClock(db, input, {
    now: Date.parse("2026-11-01T00:00:00Z"),
    ...options,
  });
}

test("future observation is rejected before it can freeze the latest vehicle state", async (t) => {
  const db = await database(t);
  const base = fixture();
  const saved = await ingestRecord(db, base);
  await assert.rejects(
    ingestRecord(db, {
      ...base,
      source: { ...base.source, fetchedAt: "2099-01-01T00:00:00Z" },
      listing: { ...base.listing, priceCny: 999999 },
    }),
    { code: "invalid_record" },
  );
  const current = await getListing(db, saved.listingId);
  assert.equal(current.listing.priceCny, base.listing.priceCny);
  assert.equal(current.source.fetchedAt, "2026-10-29T10:00:00.000Z");
  assert.equal(
    (await db.query("SELECT count(*)::int AS n FROM listing_snapshots")).rows[0]
      .n,
    1,
  );
});

test("same-car HTML to Markdown redirect preserves requested and final URLs; another car is rejected", async (t) => {
  const db = await database(t);
  const base = fixture();
  const job = await startJob(db, {
    platform: "guazi",
    url: base.source.url,
    mode: "public_page",
  });
  const redirected = {
    ...base,
    source: { ...base.source, url: base.source.url.replace(".html", ".md") },
  };
  const saved = await ingestRecord(db, redirected, { jobId: job });
  await finishJob(db, job, { status: "succeeded", listingId: saved.listingId });
  assert.equal(
    (await getListing(db, saved.listingId)).source.url,
    redirected.source.url,
  );
  assert.equal((await listJobs(db))[0].url, base.source.url);
  const otherJob = await startJob(db, {
    platform: "guazi",
    url: "https://www.guazi.com/car-detail/c164433896123048.html",
    mode: "public_page",
  });
  await assert.rejects(
    ingestRecord(db, redirected, { jobId: otherJob }),
    /match record source/,
  );
  await assert.rejects(
    finishJob(db, otherJob, {
      status: "succeeded",
      listingId: saved.listingId,
    }),
    /listing does not match/,
  );
});

function fixture(overrides = {}) {
  const record = {
    schemaVersion: 1,
    source: {
      platform: "guazi",
      externalId: "c164433896123047",
      url: "https://www.guazi.com/car-detail/c164433896123047.html",
      fetchedAt: "2026-10-29T10:00:00Z",
      method: "public_page",
      authorizationReference: null,
    },
    vehicle: {
      title: "理想汽车 理想L9 2025款 Ultra 智能焕新版",
      brand: null,
      model: null,
      trim: null,
      modelYear: null,
      registrationMonth: "2026-03",
      mileageKm: 100,
      energy: null,
      transmission: null,
      seats: null,
      color: "黑色",
      city: "成都",
    },
    listing: {
      priceCny: 373700,
      serviceFeeCny: null,
      transferFeeCny: null,
      transferCount: 0,
      status: "delisted",
    },
    coverage: {
      inspection: { status: "not_disclosed", note: "未公开检测明细" },
      insurance: { status: "requires_authorization", note: "需要授权" },
      claims: { status: "requires_authorization", note: "需要授权" },
      maintenance: { status: "requires_authorization", note: "需要授权" },
    },
    inspections: [],
    insurancePolicies: [],
    insuranceClaims: [],
    maintenanceEvents: [],
  };
  return { ...record, ...overrides };
}

async function database(t) {
  const pg = new PGlite();
  t.after(() => pg.close());
  const db = {
    query: (text, values = []) => pg.query(text, values),
    exec: (text) => pg.exec(text),
    transaction: (callback) =>
      pg.transaction((tx) =>
        callback({
          query: (text, values = []) => tx.query(text, values),
          exec: (text) => tx.exec(text),
        }),
      ),
  };
  await migrate(db);
  return db;
}

test("migration is repeatable and stores source registry; empty database has no fake cars", async (t) => {
  const db = await database(t);
  await migrate(db);
  assert.equal((await db.query("SELECT * FROM data_sources")).rows.length, 4);
  assert.deepEqual(await listListings(db), []);
  assert.equal(
    await getListing(db, "00000000-0000-0000-0000-000000000001"),
    null,
  );
});

test("same facts deduplicate while observation dates advance and unknown fees stay null", async (t) => {
  const db = await database(t);
  const record = fixture();
  const first = await ingestRecord(db, record);
  const second = await ingestRecord(db, {
    ...record,
    source: { ...record.source, fetchedAt: "2026-10-30T10:00:00Z" },
  });
  assert.equal(first.changed, true);
  assert.equal(second.changed, false);
  assert.equal(first.listingId, second.listingId);
  assert.equal(first.snapshotId, second.snapshotId);
  assert.equal(
    (await db.query("SELECT * FROM listing_snapshots")).rows.length,
    1,
  );
  const saved = await getListing(db, first.listingId);
  assert.equal(saved.listing.priceCny, 373700);
  assert.equal(saved.listing.serviceFeeCny, null);
  assert.equal(saved.vehicle.mileageKm, 100);
  assert.equal(saved.coverage.insurance.status, "requires_authorization");
  assert.deepEqual(saved.insurancePolicies, []);
  assert.equal(saved.lastSeenAt, "2026-10-30T10:00:00.000Z");
  assert.equal(saved.source.fetchedAt, saved.lastSeenAt);
});

test("new facts create history; late old observation cannot replace the current price", async (t) => {
  const db = await database(t);
  const record = fixture();
  const first = await ingestRecord(db, record);
  await ingestRecord(db, {
    ...record,
    source: { ...record.source, fetchedAt: "2026-10-30T10:00:00Z" },
    listing: { ...record.listing, priceCny: 360000 },
  });
  await ingestRecord(db, {
    ...record,
    source: { ...record.source, fetchedAt: "2026-10-28T10:00:00Z" },
    listing: { ...record.listing, priceCny: 380000 },
  });
  const saved = await getListing(db, first.listingId);
  assert.equal(saved.listing.priceCny, 360000);
  assert.equal(saved.lastSeenAt, "2026-10-30T10:00:00.000Z");
  assert.equal(saved.firstSeenAt, "2026-10-28T10:00:00.000Z");
  assert.equal(
    (await db.query("SELECT * FROM listing_snapshots")).rows.length,
    3,
  );
});

test("different platforms stay separate and pagination/filtering is bounded", async (t) => {
  const db = await database(t);
  const guazi = fixture();
  const other = fixture({
    source: {
      ...guazi.source,
      platform: "autohome",
      externalId: "59932190",
      url: "https://wap.che168.com/dealer/559088/59932190.html",
    },
  });
  const a = await ingestRecord(db, guazi);
  const b = await ingestRecord(db, other);
  assert.notEqual(a.listingId, b.listingId);
  assert.equal((await listListings(db, { platform: "autohome" })).length, 1);
  assert.equal((await listListings(db, { limit: 1 })).length, 1);
  assert.equal((await listListings(db, { limit: 1, offset: 1 })).length, 1);
  await assert.rejects(listListings(db, { limit: 1001 }), /limit/);
  await assert.rejects(
    listListings(db, { platform: "guazi' OR 1=1" }),
    /platform/,
  );
});

test("authorized reports and events have relational rows tied to the correct snapshot", async (t) => {
  const db = await database(t);
  const base = fixture();
  const record = fixture({
    source: {
      ...base.source,
      method: "authorized_import",
      authorizationReference: "DEMO-TEST-AUTH-001",
    },
    coverage: Object.fromEntries(
      ["inspection", "insurance", "claims", "maintenance"].map((key) => [
        key,
        { status: "available", note: "测试用授权导入" },
      ]),
    ),
    inspections: [
      {
        externalId: "test-report-1",
        inspectedOn: "2026-10-28",
        provider: "测试机构",
        summary: "演示测试记录",
        items: [{ name: "制动", result: "attention", detail: "需复检" }],
      },
    ],
    insurancePolicies: [
      {
        externalId: "test-policy-1",
        insurer: "测试保险机构",
        policyType: "交强险",
        startsOn: "2026-01-01",
        endsOn: "2026-12-31",
        premiumCny: null,
        coverageSummary: "测试资料",
      },
    ],
    insuranceClaims: [
      {
        externalId: "test-claim-1",
        occurredOn: null,
        amountCny: null,
        summary: "测试事件，金额未知",
      },
    ],
    maintenanceEvents: [
      {
        externalId: "test-service-1",
        servicedOn: "2026-10-01",
        mileageKm: 90,
        provider: null,
        summary: "测试服务",
        costCny: null,
      },
    ],
  });
  const first = await ingestRecord(db, record);
  for (const table of [
    "inspection_reports",
    "inspection_items",
    "insurance_policies",
    "insurance_claims",
    "maintenance_events",
  ]) {
    assert.equal(
      (await db.query(`SELECT count(*)::int AS n FROM ${table}`)).rows[0].n,
      1,
    );
  }
  assert.equal(
    (await getListing(db, first.listingId)).inspections[0].items[0].result,
    "attention",
  );
  await ingestRecord(db, {
    ...base,
    source: { ...base.source, fetchedAt: "2026-10-30T10:00:00Z" },
  });
  const current = await getListing(db, first.listingId);
  assert.deepEqual(current.inspections, []);
  assert.deepEqual(current.insurancePolicies, []);
  assert.equal(
    (await db.query("SELECT count(*)::int AS n FROM insurance_policies"))
      .rows[0].n,
    1,
  );
});

test("authorized insurance and maintenance amounts retain cents in relational storage and API records", async (t) => {
  const db = await database(t);
  const base = fixture();
  const record = fixture({
    source: {
      ...base.source,
      method: "authorized_import",
      authorizationReference: "TEST-CENTS-001",
    },
    coverage: {
      ...base.coverage,
      insurance: { status: "available", note: "测试用授权资料" },
      maintenance: { status: "available", note: "测试用授权资料" },
    },
    insurancePolicies: [
      {
        externalId: "test-policy-cents",
        insurer: null,
        policyType: "测试保单",
        startsOn: null,
        endsOn: null,
        premiumCny: 1234.56,
        coverageSummary: "测试金额保留到分",
      },
    ],
    maintenanceEvents: [
      {
        externalId: "test-service-cents",
        servicedOn: null,
        mileageKm: null,
        provider: null,
        summary: "测试金额保留到分",
        costCny: 99.5,
      },
    ],
  });
  const saved = await ingestRecord(db, record);
  const current = await getListing(db, saved.listingId);
  assert.equal(current.insurancePolicies[0].premiumCny, 1234.56);
  assert.equal(current.maintenanceEvents[0].costCny, 99.5);
  assert.equal(
    (
      await db.query(
        "SELECT premium_cny::text AS amount FROM insurance_policies",
      )
    ).rows[0].amount,
    "1234.56",
  );
  assert.equal(
    (await db.query("SELECT cost_cny::text AS amount FROM maintenance_events"))
      .rows[0].amount,
    "99.50",
  );
  await assert.rejects(
    db.query("UPDATE insurance_policies SET premium_cny='NaN'::numeric"),
    /check constraint/,
  );
});

test("failed ingestion rolls back a partially written listing/snapshot and constraints protect amounts", async (t) => {
  const db = await database(t);
  const wrapped = {
    ...db,
    transaction: (fn) =>
      db.transaction((tx) =>
        fn({
          ...tx,
          query: async (text, params) => {
            if (/INSERT INTO record_coverage/.test(text))
              throw new Error("simulated storage failure");
            return tx.query(text, params);
          },
        }),
      ),
  };
  await assert.rejects(
    ingestRecord(wrapped, fixture()),
    /simulated storage failure/,
  );
  assert.deepEqual(await listListings(db), []);
  assert.equal(
    (await db.query("SELECT count(*)::int AS n FROM listings")).rows[0].n,
    0,
  );
  const stored = await ingestRecord(db, fixture());
  await assert.rejects(
    db.query("UPDATE listing_snapshots SET price_cny = -1 WHERE id = $1", [
      stored.snapshotId,
    ]),
    /check constraint/,
  );
});

test("jobs record success and failure without allowing a finished job to change outcome", async (t) => {
  const db = await database(t);
  const record = fixture();
  const job = await startJob(db, {
    platform: "guazi",
    url: record.source.url,
    mode: "public_page",
  });
  const saved = await ingestRecord(db, record, { jobId: job });
  await finishJob(db, job, { status: "succeeded", listingId: saved.listingId });
  await assert.rejects(
    finishJob(db, job, { status: "failed", code: "unexpected" }),
    /finished|running/,
  );
  const failed = await startJob(db, {
    platform: "guazi",
    url: record.source.url,
    mode: "public_page",
  });
  await finishJob(db, failed, {
    status: "failed",
    code: "robots_unavailable",
    message: "未获取站点抓取规则",
  });
  const rows = await listJobs(db);
  assert.equal(rows.length, 2);
  assert.equal(rows.find((row) => row.id === job).status, "succeeded");
  assert.equal(
    rows.find((row) => row.id === failed).code,
    "robots_unavailable",
  );
});

test("migration refuses a changed checksum instead of silently accepting schema drift", async (t) => {
  const db = await database(t);
  await db.query("UPDATE schema_migrations SET checksum = $1", [
    "not-the-applied-checksum",
  ]);
  await assert.rejects(migrate(db), /checksum changed/);
});

test("overlapping imports retain one listing and the newest observation", async (t) => {
  const db = await database(t);
  const base = fixture();
  const results = await Promise.all([
    ingestRecord(db, {
      ...base,
      source: { ...base.source, fetchedAt: "2026-10-30T10:00:00Z" },
      listing: { ...base.listing, priceCny: 360000 },
    }),
    ingestRecord(db, base),
    ingestRecord(db, base),
  ]);
  assert.equal(new Set(results.map((result) => result.listingId)).size, 1);
  assert.equal((await listListings(db))[0].listing.priceCny, 360000);
  assert.equal(
    (await db.query("SELECT count(*)::int AS n FROM listing_snapshots")).rows[0]
      .n,
    2,
  );
});

test("jobs cannot be attached to another source or silently reused after completion", async (t) => {
  const db = await database(t);
  const record = fixture();
  const otherJob = await startJob(db, {
    platform: "autohome",
    url: "https://wap.che168.com/dealer/559088/59932190.html",
    mode: "public_page",
  });
  await assert.rejects(
    ingestRecord(db, record, { jobId: otherJob }),
    /match record source/,
  );
  const saved = await ingestRecord(db, record);
  await assert.rejects(
    finishJob(db, otherJob, {
      status: "succeeded",
      listingId: saved.listingId,
    }),
    /listing does not match/,
  );
  const job = await startJob(db, {
    platform: "guazi",
    url: record.source.url,
    mode: "public_page",
  });
  await ingestRecord(db, record, { jobId: job });
  await finishJob(db, job, { status: "succeeded", listingId: saved.listingId });
  await assert.rejects(ingestRecord(db, record, { jobId: job }), /running/);
});
