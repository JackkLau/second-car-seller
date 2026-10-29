import test from "node:test";
import assert from "node:assert/strict";
import {
  normalizeRecord,
  recordHash,
  assertObservationTime,
} from "./normalize.mjs";

export function sampleRecord() {
  return {
    schemaVersion: 1,
    source: {
      platform: "autohome",
      externalId: "59932190",
      url: "https://wap.che168.com/dealer/559088/59932190.html",
      fetchedAt: "2026-10-29T10:00:00Z",
      method: "manual_capture",
      authorizationReference: null,
    },
    vehicle: {
      title: "极氪009 2022款 改款 WE版",
      registrationMonth: "2023-11",
      mileageKm: 112300,
      city: "杭州",
    },
    listing: { priceCny: 355400, transferCount: 0, status: "unknown" },
    coverage: Object.fromEntries(
      ["inspection", "insurance", "claims", "maintenance"].map((k) => [
        k,
        { status: "not_disclosed", note: "来源未公开本车记录" },
      ]),
    ),
    inspections: [],
    insurancePolicies: [],
    insuranceClaims: [],
    maintenanceEvents: [],
  };
}

test("保留未知金额与资料状态，不填零或通过", () => {
  const r = normalizeRecord(sampleRecord());
  assert.equal(r.listing.transferFeeCny, null);
  assert.equal(r.vehicle.seats, null);
  assert.equal(r.listing.transferCount, 0);
  assert.equal(r.coverage.inspection.status, "not_disclosed");
});
test("拒绝金额单位错误、非法日期与源身份不一致", () => {
  for (const mutate of [
    (r) => (r.listing.priceCny = "35.54万"),
    (r) => (r.listing.priceCny = 12.345),
    (r) => (r.listing.serviceFeeCny = 1.00000001),
    (r) => (r.vehicle.registrationMonth = "2023-13"),
    (r) => (r.source.externalId = "other"),
    (r) => (r.source.fetchedAt = "2026-02-30T00:00:00Z"),
    (r) => (r.source.fetchedAt = "2026-10-29T24:00:00Z"),
    (r) => (r.vehicle.mileageKm = -1),
  ]) {
    const r = sampleRecord();
    mutate(r);
    assert.throws(() => normalizeRecord(r), { code: "invalid_record" });
  }
});
test("金额保留分；入库时拒绝未来时间，内容哈希不依赖系统时钟", () => {
  const r = sampleRecord();
  r.listing.serviceFeeCny = 99.5;
  const record = normalizeRecord(r);
  assert.equal(record.listing.serviceFeeCny, 99.5);
  assert.doesNotThrow(() =>
    assertObservationTime(record, Date.parse("2026-10-29T10:00:00Z")),
  );
  assert.throws(
    () => assertObservationTime(record, Date.parse("2026-10-28T10:00:00Z")),
    { code: "invalid_record" },
  );
  assert.match(recordHash(record), /^[a-f0-9]{64}$/);
});
test("未知字段拒收，避免把联系方式或原始资料暗中入库", () => {
  const r = sampleRecord();
  r.vehicle.ownerPhone = "13800000000";
  assert.throws(() => normalizeRecord(r), { code: "invalid_record" });
});
test("保险估算与未授权历史资料不得成为保单", () => {
  const r = sampleRecord();
  r.insurancePolicies = [
    {
      externalId: "p1",
      policyType: "商业险",
      coverageSummary: "导入测试",
      premiumCny: 6647,
    },
  ];
  r.coverage.insurance.status = "available";
  assert.throws(() => normalizeRecord(r), { code: "invalid_record" });
  r.source.method = "authorized_import";
  assert.throws(() => normalizeRecord(r), { code: "invalid_record" });
  r.source.authorizationReference = "AUTH-TEST-001";
  assert.equal(normalizeRecord(r).insurancePolicies[0].premiumCny, 6647);
});
test("available 需实际条目；重复事件ID、无效日期和保单日期倒置拒收", () => {
  let r = sampleRecord();
  r.coverage.inspection.status = "available";
  assert.throws(() => normalizeRecord(r), { code: "invalid_record" });
  r = sampleRecord();
  r.source.method = "authorized_import";
  r.source.authorizationReference = "AUTH-TEST-001";
  r.coverage.insurance.status = "available";
  r.insurancePolicies = [
    {
      externalId: "p1",
      policyType: "商业险",
      coverageSummary: "资料摘要",
      startsOn: "2026-02-28",
      endsOn: "2026-02-27",
    },
  ];
  assert.throws(() => normalizeRecord(r), { code: "invalid_record" });
  r.insurancePolicies[0].endsOn = "2027-02-28";
  r.insurancePolicies.push({ ...r.insurancePolicies[0] });
  assert.throws(() => normalizeRecord(r), { code: "invalid_record" });
});
test("内容哈希忽略重新抓取时间但保留变化及来源模式", () => {
  const a = normalizeRecord(sampleRecord());
  const b = structuredClone(a);
  b.source.fetchedAt = "2026-10-30T10:00:00Z";
  assert.equal(recordHash(a), recordHash(b));
  b.listing.priceCny = 350000;
  assert.notEqual(recordHash(a), recordHash(b));
  b.listing.priceCny = a.listing.priceCny;
  b.source.method = "public_page";
  assert.notEqual(recordHash(a), recordHash(b));
});
