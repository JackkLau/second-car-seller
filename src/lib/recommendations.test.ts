import assert from "node:assert/strict";
import test from "node:test";
import { vehicles } from "../data/vehicles.ts";
import type { DrivingNeeds } from "../types.ts";
import {
  assessVehicle,
  defaultNeeds,
  rankForNeeds,
  summarizeNeeds,
} from "./recommendations.ts";

const car = (id: string) => vehicles.find((vehicle) => vehicle.id === id)!;
const needs = (patch: Partial<DrivingNeeds>): DrivingNeeds => ({
  ...defaultNeeds,
  ...patch,
});

test("personal budget includes disclosed fees and accepts the exact inclusive cap", () => {
  assert.equal(
    assessVehicle(car("tesla-model3"), needs({ maxBudget: 171100 })).eligible,
    true,
  );
  const over = assessVehicle(car("tesla-model3"), needs({ maxBudget: 171099 }));
  assert.equal(over.eligible, false);
  assert.ok(over.cautions.some((text) => text.includes("超出")));
});

test("hard budget constraints cannot be offset by charging or commute preferences", () => {
  const profile = needs({
    maxBudget: 100000,
    purpose: "commute",
    charging: "home",
    dailyDistance: "over80",
    priority: "running-cost",
  });
  const ranked = rankForNeeds(vehicles, profile);
  assert.equal(ranked[0].id, "vw-golf");
  assert.equal(assessVehicle(car("tesla-model3"), profile).eligible, false);
});

test("seat needs are hard constraints, including five people and six-plus", () => {
  assert.equal(
    assessVehicle(car("mini-cooper"), needs({ passengers: "3-5" })).eligible,
    false,
  );
  assert.ok(
    vehicles.every(
      (vehicle) =>
        !assessVehicle(vehicle, needs({ passengers: "6+" })).eligible,
    ),
  );
});

test("seat mismatch is the first caution even when the known-cost budget fits", () => {
  const assessment = assessVehicle(
    car("tesla-model3"),
    needs({ maxBudget: 200000, passengers: "6+" }),
  );
  assert.equal(assessment.eligible, false);
  assert.match(assessment.cautions[0], /不满足至少6座/);
  assert.ok(
    assessment.cautions.slice(1).some((text) => text.includes("待报价")),
  );
});

test("family and short-distance parking needs change the relative recommendation", () => {
  assert.equal(
    rankForNeeds(
      [car("tesla-model3"), car("bmw-3")],
      needs({ purpose: "family", passengers: "3-5" }),
    )[0].id,
    "bmw-3",
  );
  assert.equal(
    rankForNeeds(
      [car("mercedes-c"), car("vw-golf")],
      needs({
        purpose: "commute",
        dailyDistance: "under30",
        priority: "parking",
      }),
    )[0].id,
    "vw-golf",
  );
});

test("home charging and unavailable charging produce different commute choices", () => {
  const candidates = [car("vw-golf"), car("tesla-model3")];
  const profile = needs({ purpose: "commute", dailyDistance: "over80" });
  assert.equal(
    rankForNeeds(candidates, { ...profile, charging: "home" })[0].id,
    "tesla-model3",
  );
  assert.equal(
    rankForNeeds(candidates, { ...profile, charging: "none" })[0].id,
    "vw-golf",
  );
});

test("unknown and public charging remain visible cautions instead of range claims", () => {
  for (const charging of ["unsure", "public", "none"] as const) {
    const assessment = assessVehicle(car("tesla-model3"), needs({ charging }));
    assert.ok(assessment.cautions.some((text) => /充电|补能/.test(text)));
  }
  const assessment = assessVehicle(
    car("tesla-model3"),
    needs({ purpose: "long-distance", priority: "running-cost" }),
  );
  assert.ok(assessment.cautions.some((text) => text.includes("能耗")));
  assert.ok(assessment.cautions.some((text) => text.includes("续航")));
});

test("without stated preferences ranking keeps the general order and never mutates input", () => {
  const input = [car("vw-golf"), car("tesla-model3"), car("bmw-3")];
  const original = input.map((vehicle) => vehicle.id);
  assert.deepEqual(
    rankForNeeds(input, defaultNeeds).map((vehicle) => vehicle.id),
    ["tesla-model3", "bmw-3", "vw-golf"],
  );
  assert.deepEqual(
    input.map((vehicle) => vehicle.id),
    original,
  );
  assert.equal(assessVehicle(input[0], defaultNeeds).score, 0);
  assert.deepEqual(summarizeNeeds(defaultNeeds), []);
});

test("mileage and a report boolean do not create safety or fitness scores", () => {
  const vehicle = car("vw-golf");
  const profile = needs({ purpose: "commute" });
  assert.equal(
    assessVehicle(vehicle, profile).score,
    assessVehicle({ ...vehicle, mileage: 1, inspected: false }, profile).score,
  );
  const withoutReport = assessVehicle(
    { ...vehicle, inspected: false },
    profile,
  );
  assert.ok(withoutReport.cautions.some((text) => text.includes("检测")));
});

test("summaries include only explicit choices and distinguish the known-cost budget", () => {
  const summary = summarizeNeeds(
    needs({ purpose: "family", maxBudget: 200000, charging: "home" }),
  );
  assert.equal(summary.length, 3);
  assert.ok(summary.some((text) => text.includes("家庭")));
  assert.ok(
    summary.some((text) => text.includes("已列费用") && text.includes("20")),
  );
  assert.ok(summary.some((text) => text.includes("家充")));
});

test("invalid numerical caps cannot be treated as affordable", () => {
  for (const maxBudget of [Number.NaN, Number.POSITIVE_INFINITY, -1]) {
    assert.equal(
      assessVehicle(car("vw-golf"), needs({ maxBudget })).eligible,
      false,
    );
  }
});
