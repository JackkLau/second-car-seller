import { vehicles as demoVehicles } from "../data/vehicles.ts";
import type {
  Budget,
  CatalogFilters,
  Category,
  SortOrder,
  Vehicle,
} from "../types.ts";

export const defaultFilters: CatalogFilters = {
  query: "",
  category: "all",
  budget: "all",
  brand: "all",
  city: "all",
  inspectedOnly: false,
  sort: "recommended",
  favoritesOnly: false,
};

const categories: Category[] = ["all", "commute", "family", "electric"];
const budgets: Budget[] = ["all", "under10", "10to20", "20to30", "over30"];
const sortOrders: SortOrder[] = [
  "recommended",
  "price-asc",
  "price-desc",
  "mileage",
];
const brands = new Set([
  "all",
  ...demoVehicles.map((vehicle) => vehicle.brand),
]);
const cities = new Set(["all", ...demoVehicles.map((vehicle) => vehicle.city)]);

const normalize = (value: string) =>
  value.normalize("NFKC").toLocaleLowerCase("zh-CN").trim();

function matchesBudget(price: number, budget: Budget): boolean {
  switch (budget) {
    case "under10":
      return price < 100_000;
    case "10to20":
      return price >= 100_000 && price < 200_000;
    case "20to30":
      return price >= 200_000 && price < 300_000;
    case "over30":
      return price >= 300_000;
    default:
      return true;
  }
}

/** Filters by vehicle asking price; separately disclosed fees are not in the budget filter. */
export function filterVehicles(
  vehicles: readonly Vehicle[],
  filters: CatalogFilters,
  favoriteIds: readonly string[] = [],
): Vehicle[] {
  const terms = normalize(filters.query).split(/\s+/u).filter(Boolean);
  const favorites = new Set(favoriteIds);
  const result = vehicles.filter((vehicle) => {
    if (
      filters.category !== "all" &&
      !vehicle.suitability.includes(filters.category)
    )
      return false;
    if (!matchesBudget(vehicle.price, filters.budget)) return false;
    if (filters.brand !== "all" && vehicle.brand !== filters.brand)
      return false;
    if (filters.city !== "all" && vehicle.city !== filters.city) return false;
    if (filters.inspectedOnly && !vehicle.inspected) return false;
    if (filters.favoritesOnly && !favorites.has(vehicle.id)) return false;
    const haystack = normalize(
      [
        vehicle.brand,
        vehicle.model,
        vehicle.trim,
        vehicle.year,
        vehicle.city,
        vehicle.energy,
        vehicle.body,
        ...vehicle.features,
      ].join(" "),
    );
    const compactHaystack = haystack.replace(/\s+/gu, "");
    return terms.every(
      (term) => haystack.includes(term) || compactHaystack.includes(term),
    );
  });

  return result.sort((left, right) => {
    switch (filters.sort) {
      case "price-asc":
        return left.price - right.price;
      case "price-desc":
        return right.price - left.price;
      case "mileage":
        return left.mileage - right.mileage;
      default:
        return right.recommendation - left.recommendation;
    }
  });
}

/** Known purchase costs only. Insurance and optional transport are explicitly excluded in the UI. */
export function totalKnownCost(vehicle: Vehicle): number {
  return vehicle.price + vehicle.serviceFee + vehicle.transferFee;
}

/** Number in ten-thousand-yuan units, without the currency unit. */
export function formatPrice(amount: number): string {
  return (amount / 10_000).toFixed(2);
}

export function formatMileage(km: number): string {
  if (km < 10_000) return `${new Intl.NumberFormat("zh-CN").format(km)}公里`;
  return `${(km / 10_000).toFixed(1)}万公里`;
}

function enumValue<T extends string>(
  value: string | null,
  choices: T[],
  fallback: T,
): T {
  return choices.includes(value as T) ? (value as T) : fallback;
}

/** Accepts a location.search string; unrecognized options fall back to safe defaults. */
export function parseFilters(search: string): CatalogFilters {
  const params = new URLSearchParams(search);
  const brand = params.get("brand") ?? "all";
  const city = params.get("city") ?? "all";
  return {
    query: params.get("q") ?? "",
    category: enumValue(params.get("category"), categories, "all"),
    budget: enumValue(params.get("budget"), budgets, "all"),
    brand: brands.has(brand) ? brand : "all",
    city: cities.has(city) ? city : "all",
    inspectedOnly: params.get("inspected") === "1",
    sort: enumValue(params.get("sort"), sortOrders, "recommended"),
    favoritesOnly: params.get("favorites") === "1",
  };
}

/** Returns a query string including '?' or an empty string when every option is default. */
export function filtersToSearch(filters: CatalogFilters): string {
  const params = new URLSearchParams();
  if (filters.query) params.set("q", filters.query);
  if (filters.category !== "all") params.set("category", filters.category);
  if (filters.budget !== "all") params.set("budget", filters.budget);
  if (filters.brand !== "all") params.set("brand", filters.brand);
  if (filters.city !== "all") params.set("city", filters.city);
  if (filters.inspectedOnly) params.set("inspected", "1");
  if (filters.sort !== "recommended") params.set("sort", filters.sort);
  if (filters.favoritesOnly) params.set("favorites", "1");
  const query = params.toString();
  return query ? `?${query}` : "";
}
