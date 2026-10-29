import assert from "node:assert/strict";
import test from "node:test";
import { vehicles } from "../data/vehicles.ts";
import { getVehicleInspections } from "../data/inspections.ts";
import type { DrivingNeeds } from "../types.ts";
import { buildVisitTasks, getAdditionalCosts } from "./visitPlan.ts";

const needs: DrivingNeeds = {
  purpose: "unsure",
  maxBudget: null,
  passengers: "unsure",
  dailyDistance: "unsure",
  charging: "unsure",
  priority: "balanced",
};
const tesla = vehicles.find((vehicle) => vehicle.id === "tesla-model3")!;
const golf = vehicles.find((vehicle) => vehicle.id === "vw-golf")!;
const mini = vehicles.find((vehicle) => vehicle.id === "mini-cooper")!;

test("Golf tire evidence does not mark its uninspected brakes as checked", () => {
  const records = getVehicleInspections(golf);
  assert.equal(
    records.find((record) => record.id === "tires")?.status,
    "attention",
  );
  assert.equal(
    records.find((record) => record.id === "brakes")?.status,
    "pending",
  );
  assert.equal(
    records.find((record) => record.id === "brakes")?.checkedAt,
    null,
  );
  assert.equal(records.find((record) => record.id === "brakes")?.source, null);
  assert.match(
    buildVisitTasks(golf, null).find((task) => task.id === "missing-checks")!
      .reason,
    /制动系统/,
  );
  assert.ok(records.every((record) => record.id !== "tires-brakes"));
});

test("inspection records separate recorded results, findings and missing evidence", () => {
  const records = getVehicleInspections(golf);
  assert.equal(
    records.find((record) => record.id === "structure")?.status,
    "recorded",
  );
  assert.equal(
    records.find((record) => record.id === "tires")?.status,
    "attention",
  );
  assert.match(
    records.find((record) => record.id === "tires")!.result,
    /3\.1 mm/,
  );
  assert.equal(
    records.find((record) => record.id === "powertrain")?.status,
    "pending",
  );
  for (const record of records.filter((item) =>
    ["recorded", "attention"].includes(item.status),
  )) {
    assert.equal(record.checkedAt, "2026-10-24");
    assert.match(record.source!, /虚构报告摘要，无报告原件/);
  }
});

test("an inspected flag cannot invent or erase individual inspection conclusions", () => {
  const original = getVehicleInspections(tesla);
  assert.deepEqual(
    getVehicleInspections({ ...tesla, inspected: false }),
    original,
  );
  const unknown = getVehicleInspections({
    ...tesla,
    id: "new-unchecked-car",
    inspected: true,
  });
  assert.equal(unknown.length, 8);
  assert.ok(
    unknown.every(
      (record) =>
        record.status === "pending" &&
        record.checkedAt === null &&
        record.source === null,
    ),
  );
});

test("MINI preserves unknown checks and distinguishes seller claims", () => {
  const records = getVehicleInspections(mini);
  for (const id of ["structure", "flood", "fire"]) {
    assert.equal(records.find((record) => record.id === id)?.status, "pending");
    assert.equal(records.find((record) => record.id === id)?.result, "待检测");
  }
  assert.equal(
    records.find((record) => record.id === "bodywork")?.status,
    "unverified",
  );
  assert.ok(
    records.every(
      (record) => !["recorded", "attention"].includes(record.status),
    ),
  );
});

test("all inventory cars have unique scoped records and consumers cannot mutate stored evidence", () => {
  for (const vehicle of vehicles) {
    const records = getVehicleInspections(vehicle);
    assert.equal(
      new Set(records.map((record) => record.id)).size,
      records.length,
    );
    assert.equal(records.length, vehicle.energy === "纯电" ? 8 : 7);
    assert.ok(records.some((record) => record.id === "tires"));
    assert.equal(
      records.find((record) => record.id === "brakes")?.status,
      "pending",
    );
    assert.ok(records.every((record) => record.id !== "tires-brakes"));
    assert.equal(
      records.some((record) => record.id === "battery"),
      vehicle.energy === "纯电",
    );
    records[0].result = "consumer mutation";
    assert.notEqual(
      getVehicleInspections(vehicle)[0].result,
      "consumer mutation",
    );
  }
});

test("visit task identity survives changes in the buyer's needs", () => {
  const base = buildVisitTasks(tesla, null);
  const family = buildVisitTasks(tesla, {
    ...needs,
    purpose: "family",
    passengers: "3-5",
  });
  const parking = buildVisitTasks(tesla, {
    ...needs,
    purpose: "commute",
    priority: "parking",
  });
  assert.deepEqual(
    family.map((task) => task.id).sort(),
    base.map((task) => task.id).sort(),
  );
  assert.deepEqual(
    parking.map((task) => task.id).sort(),
    base.map((task) => task.id).sort(),
  );
  assert.equal(base.find((task) => task.id === "family-fit")?.suggested, false);
  assert.equal(
    family.find((task) => task.id === "family-fit")?.suggested,
    true,
  );
  assert.equal(
    parking.find((task) => task.id === "parking-fit")?.suggested,
    true,
  );
  assert.match(
    family.find((task) => task.id === "family-fit")!.reason,
    /家庭|乘坐/,
  );
});

test("missing checks and observed wear produce actionable professional follow-up", () => {
  const tasks = buildVisitTasks(golf, {
    ...needs,
    purpose: "long-distance",
    dailyDistance: "over80",
  });
  assert.equal(
    tasks.find((task) => task.id === "missing-checks")?.suggested,
    true,
  );
  assert.match(
    tasks.find((task) => task.id === "missing-checks")!.reason,
    /动力总成/,
  );
  assert.match(
    tasks.find((task) => task.id === "condition-review")!.reason,
    /轮胎/,
  );
  assert.match(
    tasks.find((task) => task.id === "missing-checks")!.salesAction,
    /专业|独立检测/,
  );
  assert.match(
    tasks.find((task) => task.id === "road-experience")!.reason,
    /长途|里程/,
  );
});

test("electric battery and charging follow-up is vehicle-scoped with honest uncertainty", () => {
  const electric = buildVisitTasks(tesla, { ...needs, charging: "none" });
  const petrol = buildVisitTasks(golf, { ...needs, charging: "none" });
  assert.ok(electric.some((task) => task.id === "battery-check"));
  assert.ok(electric.some((task) => task.id === "charging-fit"));
  assert.ok(
    petrol.every(
      (task) => !["battery-check", "charging-fit"].includes(task.id),
    ),
  );
  assert.match(
    electric.find((task) => task.id === "charging-fit")!.reason,
    /补能|充电/,
  );
  assert.match(
    electric.find((task) => task.id === "battery-check")!.salesAction,
    /专业/,
  );
});

test("family follow-up describes the actual seat limit without rejecting a larger future car", () => {
  const fivePeople = buildVisitTasks(mini, { ...needs, passengers: "3-5" });
  assert.match(
    fivePeople.find((task) => task.id === "family-fit")!.reason,
    /若需要 5 人同行/,
  );
  const sixPeople = buildVisitTasks(tesla, { ...needs, passengers: "6+" });
  assert.match(
    sixPeople.find((task) => task.id === "family-fit")!.reason,
    /不能满足/,
  );
  const sevenSeats = buildVisitTasks(
    { ...tesla, seats: 7 },
    { ...needs, passengers: "6+" },
  );
  assert.doesNotMatch(
    sevenSeats.find((task) => task.id === "family-fit")!.reason,
    /不能满足/,
  );
});

test("potential charges stay unquoted and include trigger, payee and service-fee confirmation", () => {
  for (const vehicle of [tesla, golf, mini]) {
    const costs = getAdditionalCosts(vehicle);
    assert.ok(costs.length >= 5);
    assert.equal(new Set(costs.map((cost) => cost.id)).size, costs.length);
    assert.ok(costs.every((cost) => cost.amount === null));
    assert.ok(
      costs.every(
        (cost) => cost.trigger && cost.payee && /待报价|待确认/.test(cost.note),
      ),
    );
    assert.ok(costs.every((cost) => /服务费/.test(cost.note)));
    assert.equal(
      costs.some((cost) => cost.id === "battery-diagnostics"),
      vehicle.energy === "纯电",
    );
  }
});
