import assert from "node:assert/strict";
import test from "node:test";
import { vehicles } from "../data/vehicles.ts";
import type { CatalogFilters, Vehicle } from "../types.ts";
import {
  defaultFilters,
  filterVehicles,
  filtersToSearch,
  formatMileage,
  formatPrice,
  parseFilters,
  totalKnownCost,
} from "./catalog.ts";

const withFilters = (overrides: Partial<CatalogFilters>): CatalogFilters => ({
  ...defaultFilters,
  ...overrides,
});

test("combines category, city, budget, inspection and favorites as an intersection", () => {
  const result = filterVehicles(
    vehicles,
    withFilters({
      category: "commute",
      city: "杭州",
      budget: "10to20",
      inspectedOnly: true,
      favoritesOnly: true,
    }),
    ["tesla-model3", "mini-cooper", "bmw-3"],
  );
  assert.deepEqual(
    result.map((vehicle) => vehicle.id),
    ["tesla-model3"],
  );
});

test("price boundaries belong to exactly one budget band", () => {
  const fixture: Vehicle[] = [
    99_999, 100_000, 199_999, 200_000, 299_999, 300_000,
  ].map((price) => ({
    ...vehicles[0],
    id: String(price),
    price,
  }));
  const cases = [
    ["under10", ["99999"]],
    ["10to20", ["100000", "199999"]],
    ["20to30", ["200000", "299999"]],
    ["over30", ["300000"]],
  ] as const;
  for (const [budget, expected] of cases) {
    assert.deepEqual(
      filterVehicles(fixture, withFilters({ budget })).map(
        (vehicle) => vehicle.id,
      ),
      expected,
    );
  }
});

test("search normalizes full-width characters and case and requires every term", () => {
  assert.deepEqual(
    filterVehicles(
      vehicles,
      withFilters({ query: "特斯拉  ＭＯＤＥＬ　３" }),
    ).map((vehicle) => vehicle.id),
    ["tesla-model3"],
  );
  assert.deepEqual(
    filterVehicles(vehicles, withFilters({ query: "宝马3系 325li" })).map(
      (vehicle) => vehicle.id,
    ),
    ["bmw-3"],
  );
  assert.deepEqual(
    filterVehicles(vehicles, withFilters({ query: "特斯拉 宝马" })),
    [],
  );
});

test("URL parsing rejects invalid enums and unsupported city/brand", () => {
  const filters = parseFilters(
    "?category=wrong&budget=cheap&sort=random&brand=不存在&city=不存在&inspected=true&favorites=yes",
  );
  assert.deepEqual(filters, defaultFilters);
});

test("URL state roundtrips Chinese search and active filters", () => {
  const filters = withFilters({
    query: "宝马 325Li + 天窗",
    category: "family",
    budget: "20to30",
    brand: "宝马",
    city: "杭州",
    inspectedOnly: true,
    sort: "mileage",
    favoritesOnly: true,
  });
  assert.equal(filtersToSearch(defaultFilters), "");
  assert.ok(filtersToSearch(filters).startsWith("?"));
  assert.deepEqual(parseFilters(filtersToSearch(filters)), filters);
  assert.deepEqual(parseFilters(""), defaultFilters);
});

test("known purchase costs include both disclosed mandatory fees using integer yuan", () => {
  const vehicle = vehicles.find((item) => item.id === "tesla-model3")!;
  assert.equal(totalKnownCost(vehicle), 171100);
  assert.equal(formatPrice(vehicle.price), "16.88");
  assert.equal(formatPrice(totalKnownCost(vehicle)), "17.11");
  assert.equal(formatMileage(32000), "3.2万公里");
  assert.equal(formatMileage(800), "800公里");
});

test("sorting does not mutate inventory and maintains order for ties", () => {
  const originalOrder = vehicles.map((vehicle) => vehicle.id);
  const ascending = filterVehicles(
    vehicles,
    withFilters({ sort: "price-asc" }),
  );
  assert.equal(ascending[0].id, "vw-golf");
  assert.equal(ascending.at(-1)?.id, "mercedes-c");
  assert.deepEqual(
    vehicles.map((vehicle) => vehicle.id),
    originalOrder,
  );
  const ties = [vehicles[2], vehicles[1]].map((vehicle) => ({
    ...vehicle,
    price: 200000,
  }));
  assert.deepEqual(
    filterVehicles(ties, withFilters({ sort: "price-asc" })).map(
      (vehicle) => vehicle.id,
    ),
    ["volvo-xc60", "bmw-3"],
  );
});

test("inspection-only filter excludes the uninspected listing and unknown searches return no results", () => {
  const inspected = filterVehicles(
    vehicles,
    withFilters({ inspectedOnly: true }),
  );
  assert.equal(inspected.length, 7);
  assert.ok(
    inspected.every((vehicle) => vehicle.inspected && vehicle.inspectedAt),
  );
  assert.deepEqual(
    filterVehicles(vehicles, withFilters({ query: "不存在的车型" })),
    [],
  );
  assert.deepEqual(
    filterVehicles(vehicles, withFilters({ favoritesOnly: true }), []),
    [],
  );
});

test("mileage and recommendation sorting produce independent expected first cars", () => {
  assert.equal(filterVehicles(vehicles, defaultFilters)[0].id, "tesla-model3");
  assert.equal(
    filterVehicles(vehicles, withFilters({ sort: "mileage" }))[0].id,
    "nio-et5",
  );
});
