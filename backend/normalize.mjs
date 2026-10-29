import { createHash } from "node:crypto";
import { validateSourceUrl, identifyListing } from "./sources.mjs";

function invalid(path) {
  throw Object.assign(new Error(`车辆资料校验失败：${path}`), {
    code: "invalid_record",
  });
}
function shape(value, keys, path) {
  if (!value || typeof value !== "object" || Array.isArray(value))
    invalid(path);
  if (Object.keys(value).some((k) => !keys.includes(k)))
    invalid(`${path} 含未支持字段`);
  return value;
}
function str(value, path, { required = false, max = 1000 } = {}) {
  if (value === undefined || value === null) {
    if (required) invalid(path);
    return null;
  }
  if (
    typeof value !== "string" ||
    !value.trim() ||
    value.length > max ||
    /[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(value)
  )
    invalid(path);
  return value.trim();
}
function integer(value, path, min = 0, max = 1000000000) {
  if (value === undefined || value === null) return null;
  if (!Number.isSafeInteger(value) || value < min || value > max) invalid(path);
  return value;
}
function money(value, path, min = 0) {
  if (value === undefined || value === null) return null;
  if (
    typeof value !== "number" ||
    !Number.isFinite(value) ||
    value < min ||
    value > 1000000000 ||
    Number(value.toFixed(2)) !== value
  )
    invalid(path);
  return value;
}
function option(value, values, path) {
  if (!values.includes(value)) invalid(path);
  return value;
}
function day(value, path) {
  if (value === undefined || value === null) return null;
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value))
    invalid(path);
  const d = new Date(`${value}T00:00:00Z`);
  if (
    !Number.isFinite(+d) ||
    d.toISOString().slice(0, 10) !== value ||
    value < "1900-01-01"
  )
    invalid(path);
  return value;
}
function month(value, path) {
  if (value === undefined || value === null) return null;
  if (typeof value !== "string" || !/^\d{4}-\d{2}$/.test(value)) invalid(path);
  day(`${value}-01`, path);
  return value;
}
function records(value, fields, path, parse) {
  if (!Array.isArray(value) || value.length > 500) invalid(path);
  const ids = new Set();
  return value.map((item, i) => {
    const p = `${path}[${i}]`;
    shape(item, ["externalId", ...fields], p);
    const externalId = str(item.externalId, `${p}.externalId`, {
      required: true,
      max: 160,
    });
    if (ids.has(externalId)) invalid(`${p}.externalId 重复`);
    ids.add(externalId);
    return { externalId, ...parse(item, p) };
  });
}

export function normalizeRecord(input) {
  shape(
    input,
    [
      "schemaVersion",
      "source",
      "vehicle",
      "listing",
      "coverage",
      "inspections",
      "insurancePolicies",
      "insuranceClaims",
      "maintenanceEvents",
    ],
    "record",
  );
  if (input.schemaVersion !== 1) invalid("schemaVersion");
  const s = shape(
    input.source,
    [
      "platform",
      "externalId",
      "url",
      "fetchedAt",
      "method",
      "authorizationReference",
    ],
    "source",
  );
  let url, externalId;
  try {
    url = validateSourceUrl(s.platform, s.url);
    externalId = identifyListing(s.platform, url);
  } catch {
    invalid("source.url");
  }
  if (s.externalId !== externalId) invalid("source.externalId 与详情URL不一致");
  if (
    typeof s.fetchedAt !== "string" ||
    !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/.test(
      s.fetchedAt,
    )
  )
    invalid("source.fetchedAt");
  day(s.fetchedAt.slice(0, 10), "source.fetchedAt");
  const time = s.fetchedAt.slice(11, 19).split(":").map(Number);
  if (time[0] > 23 || time[1] > 59 || time[2] > 59) invalid("source.fetchedAt");
  if (!Number.isFinite(Date.parse(s.fetchedAt))) invalid("source.fetchedAt");
  const method = option(
    s.method,
    ["public_page", "authorized_import", "manual_capture"],
    "source.method",
  );
  const authorizationReference = str(
    s.authorizationReference,
    "source.authorizationReference",
    { required: method === "authorized_import", max: 160 },
  );
  if (method !== "authorized_import" && authorizationReference !== null)
    invalid("source.authorizationReference");
  const source = {
    platform: s.platform,
    externalId,
    url,
    fetchedAt: new Date(s.fetchedAt).toISOString(),
    method,
    authorizationReference,
  };
  const v = shape(
    input.vehicle,
    [
      "title",
      "brand",
      "model",
      "trim",
      "modelYear",
      "registrationMonth",
      "mileageKm",
      "energy",
      "transmission",
      "seats",
      "color",
      "city",
    ],
    "vehicle",
  );
  const vehicle = {
    title: str(v.title, "vehicle.title", { required: true, max: 300 }),
    brand: str(v.brand, "vehicle.brand", { max: 100 }),
    model: str(v.model, "vehicle.model", { max: 100 }),
    trim: str(v.trim, "vehicle.trim", { max: 200 }),
    modelYear: integer(v.modelYear, "vehicle.modelYear", 1900, 2100),
    registrationMonth: month(v.registrationMonth, "vehicle.registrationMonth"),
    mileageKm: integer(v.mileageKm, "vehicle.mileageKm", 0, 10000000),
    energy: str(v.energy, "vehicle.energy", { max: 40 }),
    transmission: str(v.transmission, "vehicle.transmission", { max: 60 }),
    seats: integer(v.seats, "vehicle.seats", 1, 100),
    color: str(v.color, "vehicle.color", { max: 60 }),
    city: str(v.city, "vehicle.city", { max: 100 }),
  };
  const l = shape(
    input.listing,
    ["priceCny", "serviceFeeCny", "transferFeeCny", "transferCount", "status"],
    "listing",
  );
  const listing = {
    priceCny: money(l.priceCny, "listing.priceCny", 0.01),
    serviceFeeCny: money(l.serviceFeeCny, "listing.serviceFeeCny"),
    transferFeeCny: money(l.transferFeeCny, "listing.transferFeeCny"),
    transferCount: integer(l.transferCount, "listing.transferCount", 0, 100),
    status: option(
      l.status,
      ["unknown", "listed", "delisted"],
      "listing.status",
    ),
  };
  const inspections = records(
    input.inspections,
    ["inspectedOn", "provider", "summary", "items"],
    "inspections",
    (r, p) => {
      if (
        !Array.isArray(r.items) ||
        r.items.length === 0 ||
        r.items.length > 1000
      )
        invalid(`${p}.items`);
      return {
        inspectedOn: day(r.inspectedOn, `${p}.inspectedOn`),
        provider: str(r.provider, `${p}.provider`, { max: 200 }),
        summary: str(r.summary, `${p}.summary`, { required: true }),
        items: r.items.map((item, i) => {
          const q = `${p}.items[${i}]`;
          shape(item, ["name", "result", "detail"], q);
          return {
            name: str(item.name, `${q}.name`, { required: true, max: 120 }),
            result: option(
              item.result,
              ["reported_ok", "attention", "not_tested", "unknown"],
              `${q}.result`,
            ),
            detail: str(item.detail, `${q}.detail`, { required: true }),
          };
        }),
      };
    },
  );
  const insurancePolicies = records(
    input.insurancePolicies,
    [
      "insurer",
      "policyType",
      "startsOn",
      "endsOn",
      "premiumCny",
      "coverageSummary",
    ],
    "insurancePolicies",
    (r, p) => {
      const startsOn = day(r.startsOn, `${p}.startsOn`),
        endsOn = day(r.endsOn, `${p}.endsOn`);
      if (startsOn && endsOn && endsOn < startsOn) invalid(`${p}.endsOn`);
      return {
        insurer: str(r.insurer, `${p}.insurer`, { max: 200 }),
        policyType: str(r.policyType, `${p}.policyType`, {
          required: true,
          max: 100,
        }),
        startsOn,
        endsOn,
        premiumCny: money(r.premiumCny, `${p}.premiumCny`),
        coverageSummary: str(r.coverageSummary, `${p}.coverageSummary`, {
          required: true,
        }),
      };
    },
  );
  const insuranceClaims = records(
    input.insuranceClaims,
    ["occurredOn", "amountCny", "summary"],
    "insuranceClaims",
    (r, p) => ({
      occurredOn: day(r.occurredOn, `${p}.occurredOn`),
      amountCny: money(r.amountCny, `${p}.amountCny`),
      summary: str(r.summary, `${p}.summary`, { required: true }),
    }),
  );
  const maintenanceEvents = records(
    input.maintenanceEvents,
    ["servicedOn", "mileageKm", "provider", "summary", "costCny"],
    "maintenanceEvents",
    (r, p) => ({
      servicedOn: day(r.servicedOn, `${p}.servicedOn`),
      mileageKm: integer(r.mileageKm, `${p}.mileageKm`, 0, 10000000),
      provider: str(r.provider, `${p}.provider`, { max: 200 }),
      summary: str(r.summary, `${p}.summary`, { required: true }),
      costCny: money(r.costCny, `${p}.costCny`),
    }),
  );
  if (
    method !== "authorized_import" &&
    (insurancePolicies.length ||
      insuranceClaims.length ||
      maintenanceEvents.length)
  )
    invalid("历史记录需要 authorized_import 来源及授权编号");
  const groups = {
    inspection: inspections,
    insurance: insurancePolicies,
    claims: insuranceClaims,
    maintenance: maintenanceEvents,
  };
  shape(input.coverage, Object.keys(groups), "coverage");
  const coverage = Object.fromEntries(
    Object.entries(groups).map(([key, rows]) => {
      const p = `coverage.${key}`,
        c = shape(input.coverage[key], ["status", "note"], p);
      const status = option(
        c.status,
        ["available", "not_disclosed", "requires_authorization", "unavailable"],
        `${p}.status`,
      );
      if ((status === "available") !== rows.length > 0)
        invalid(`${p} 状态与条目不一致`);
      return [
        key,
        { status, note: str(c.note, `${p}.note`, { required: true }) },
      ];
    }),
  );
  return {
    schemaVersion: 1,
    source,
    vehicle,
    listing,
    coverage,
    inspections,
    insurancePolicies,
    insuranceClaims,
    maintenanceEvents,
  };
}

// Ingress-only wall-clock check: historical content hashes stay stable forever.
export function assertObservationTime(record, now = Date.now()) {
  if (
    !Number.isFinite(now) ||
    Date.parse(record.source.fetchedAt) > now + 5 * 60 * 1000
  )
    invalid("source.fetchedAt 超出当前时间5分钟");
}

export function recordHash(record) {
  const normalized = normalizeRecord(record);
  const { fetchedAt: _ignored, ...source } = normalized.source;
  return createHash("sha256")
    .update(JSON.stringify({ ...normalized, source }))
    .digest("hex");
}
