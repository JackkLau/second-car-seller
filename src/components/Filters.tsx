import { Check, ChevronDown, RotateCcw, ShieldCheck } from "lucide-react";
import type { Budget, CatalogFilters } from "../types";

interface FiltersProps {
  filters: CatalogFilters;
  onChange: (patch: Partial<CatalogFilters>) => void;
  onReset: () => void;
  idPrefix: string;
}

const budgets: [Budget, string][] = [
  ["all", "不限预算"],
  ["under10", "10万以下"],
  ["10to20", "10–20万"],
  ["20to30", "20–30万"],
  ["over30", "30万及以上"],
];
const brands = [
  "特斯拉",
  "宝马",
  "沃尔沃",
  "大众",
  "丰田",
  "蔚来",
  "MINI",
  "奔驰",
];

export function Filters({
  filters,
  onChange,
  onReset,
  idPrefix,
}: FiltersProps) {
  return (
    <div className="filter-content">
      <div className="filter-heading">
        <h3>按你的需求找车</h3>
        <button className="text-button" onClick={onReset} aria-label="重置筛选">
          <RotateCcw size={13} />
          重置
        </button>
      </div>
      <fieldset className="filter-section">
        <legend>购车预算</legend>
        <p className="field-caption">按车辆售价，不含另列费用</p>
        <div className="budget-options">
          {budgets.map(([value, label]) => (
            <label
              className={`radio-option ${filters.budget === value ? "is-selected" : ""}`}
              key={value}
            >
              <input
                type="radio"
                name={`${idPrefix}-budget`}
                value={value}
                checked={filters.budget === value}
                onChange={() => onChange({ budget: value })}
              />
              <span className="radio-mark" />
              <span>{label}</span>
            </label>
          ))}
        </div>
      </fieldset>
      <div className="filter-section">
        <label className="field-label" htmlFor={`${idPrefix}-brand`}>
          车辆品牌
        </label>
        <div className="select-wrap">
          <select
            id={`${idPrefix}-brand`}
            value={filters.brand}
            onChange={(event) => onChange({ brand: event.target.value })}
          >
            <option value="all">全部品牌</option>
            {brands.map((brand) => (
              <option key={brand} value={brand}>
                {brand}
              </option>
            ))}
          </select>
          <ChevronDown size={15} />
        </div>
      </div>
      <div className="filter-section">
        <label className="field-label" htmlFor={`${idPrefix}-city`}>
          车辆所在地
        </label>
        <div className="select-wrap">
          <select
            id={`${idPrefix}-city`}
            value={filters.city}
            onChange={(event) => onChange({ city: event.target.value })}
          >
            <option value="all">全部城市</option>
            {["杭州", "上海", "苏州"].map((city) => (
              <option key={city}>{city}</option>
            ))}
          </select>
          <ChevronDown size={15} />
        </div>
      </div>
      <fieldset className="filter-section">
        <legend>车况偏好</legend>
        <label className="check-option">
          <input
            type="checkbox"
            checked={filters.inspectedOnly}
            onChange={(event) =>
              onChange({ inspectedOnly: event.target.checked })
            }
          />
          <span className="checkbox-mark">
            {filters.inspectedOnly && <Check size={12} />}
          </span>
          <span>只看有检测报告的车</span>
        </label>
      </fieldset>
      <div className="filter-note">
        <ShieldCheck size={25} />
        <h4>先看清楚，再做决定</h4>
        <p>车况、费用、已知瑕疵都在详情里。慢慢选，我们把信息讲清楚。</p>
      </div>
    </div>
  );
}
