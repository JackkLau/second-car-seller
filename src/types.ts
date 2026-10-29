export type Category = "all" | "commute" | "family" | "electric";
export type Budget = "all" | "under10" | "10to20" | "20to30" | "over30";
export type SortOrder = "recommended" | "price-asc" | "price-desc" | "mileage";

export interface Vehicle {
  id: string;
  brand: string;
  model: string;
  seats: number;
  trim: string;
  year: number;
  firstRegistration: string;
  mileage: number;
  price: number;
  serviceFee: number;
  transferFee: number;
  city: string;
  location: string;
  energy: "纯电" | "汽油" | "油电混动";
  body: "轿车" | "SUV" | "两厢车";
  image: string;
  imagePosition?: string;
  tag: string;
  inspected: boolean;
  inspectedAt: string | null;
  defects: { part: string; note: string; severity: "轻微" | "需关注" }[];
  features: string[];
  owners: number;
  power: string;
  transmission: string;
  color: string;
  battery?: {
    health: number;
    source: string;
    date: string;
    ownership: string;
    warranty: string;
  };
  suitability: Exclude<Category, "all">[];
  summary: string;
  recommendation: number;
}

export interface CatalogFilters {
  query: string;
  category: Category;
  budget: Budget;
  brand: string;
  city: string;
  inspectedOnly: boolean;
  sort: SortOrder;
  favoritesOnly: boolean;
}

export interface DrivingNeeds {
  purpose: "unsure" | "commute" | "family" | "long-distance";
  maxBudget: number | null;
  passengers: "unsure" | "1-2" | "3-5" | "6+";
  dailyDistance: "unsure" | "under30" | "30to80" | "over80";
  charging: "unsure" | "home" | "public" | "none";
  priority: "balanced" | "parking" | "comfort" | "running-cost";
}

export interface InspectionRecord {
  id: string;
  name: string;
  status: "recorded" | "attention" | "pending" | "unverified";
  result: string;
  checkedAt: string | null;
  source: string | null;
}

export interface VisitTask {
  id: string;
  title: string;
  reason: string;
  userAction: string;
  salesAction: string;
  feeNote: string;
  suggested: boolean;
}

export interface AdditionalCost {
  id: string;
  name: string;
  trigger: string;
  payee: string;
  amount: number | null;
  note: string;
}
