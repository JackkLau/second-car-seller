import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowDownUp,
  ArrowRight,
  ArrowUpRight,
  CarFront,
  Check,
  ChevronDown,
  FileCheck2,
  GitCompareArrows,
  Heart,
  Leaf,
  MapPin,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  WalletCards,
  X,
} from "lucide-react";
import { vehicles } from "./data/vehicles";
import {
  defaultFilters,
  filterVehicles,
  filtersToSearch,
  parseFilters,
} from "./lib/catalog";
import type { CatalogFilters, Category, DrivingNeeds, Vehicle } from "./types";
import { VehicleCard } from "./components/VehicleCard";
import { Filters } from "./components/Filters";
import { Modal } from "./components/Modal";
import { VehicleDetails } from "./components/VehicleDetails";
import { Comparison } from "./components/Comparison";
import { AppointmentDialog } from "./components/AppointmentDialog";
import { NeedsProfile } from "./components/NeedsProfile";
import {
  assessVehicle,
  rankForNeeds,
  summarizeNeeds,
} from "./lib/recommendations";
import { buildVisitTasks } from "./lib/visitPlan";

const favoriteKey = "jianche:favorites:v1";
const vehicleIds = new Set(vehicles.map((vehicle) => vehicle.id));

function readFavorites(): string[] {
  try {
    const value: unknown = JSON.parse(
      localStorage.getItem(favoriteKey) || "[]",
    );
    return Array.isArray(value)
      ? [
          ...new Set(
            value.filter(
              (id): id is string =>
                typeof id === "string" && vehicleIds.has(id),
            ),
          ),
        ]
      : [];
  } catch {
    return [];
  }
}

const categories: { id: Category; name: string; icon: typeof CarFront }[] = [
  { id: "all", name: "全部车源", icon: CarFront },
  { id: "commute", name: "通勤代步", icon: MapPin },
  { id: "family", name: "家庭出行", icon: Heart },
  { id: "electric", name: "纯电生活", icon: Leaf },
];
const budgetLabels = {
  all: "",
  under10: "10万以下",
  "10to20": "10–20万",
  "20to30": "20–30万",
  over30: "30万及以上",
};

export default function App() {
  const [filters, setFilters] = useState<CatalogFilters>(() =>
    parseFilters(window.location.search),
  );
  const [searchValue, setSearchValue] = useState(filters.query);
  const [favorites, setFavorites] = useState(readFavorites);
  const [needs, setNeeds] = useState<DrivingNeeds | null>(null);
  const [selectedTaskIds, setSelectedTaskIds] = useState<
    Record<string, string[]>
  >({});
  const [compared, setCompared] = useState<string[]>([]);
  const [overlay, setOverlay] = useState<
    "detail" | "compare" | "guide" | "filters" | null
  >(null);
  const [selectedVehicle, setSelectedVehicle] = useState<Vehicle | null>(null);
  const [bookingVehicle, setBookingVehicle] = useState<Vehicle | null>(null);
  const [bookingOpen, setBookingOpen] = useState(false);
  const [toast, setToast] = useState<{ id: number; message: string } | null>(
    null,
  );
  const searchRef = useRef<HTMLInputElement>(null);
  const composing = useRef(false);
  const featured = vehicles.find((vehicle) => vehicle.id === "volvo-xc60")!;

  const filteredVehicles = useMemo(() => {
    const filtered = filterVehicles(vehicles, filters, favorites);
    return needs && filters.sort === "recommended"
      ? rankForNeeds(filtered, needs)
      : filtered;
  }, [filters, favorites, needs]);
  const matchingNeedsCount = needs
    ? filteredVehicles.filter(
        (vehicle) => assessVehicle(vehicle, needs).eligible,
      ).length
    : filteredVehicles.length;
  const bookingTasks = bookingVehicle
    ? buildVisitTasks(bookingVehicle, needs).filter((task) =>
        (selectedTaskIds[bookingVehicle.id] || []).includes(task.id),
      )
    : [];
  const compareVehicles = compared
    .map((id) => vehicles.find((vehicle) => vehicle.id === id)!)
    .filter(Boolean);
  const activeFilterCount = [
    filters.budget !== "all",
    filters.brand !== "all",
    filters.city !== "all",
    filters.inspectedOnly,
  ].filter(Boolean).length;

  useEffect(() => {
    window.history.replaceState(
      null,
      "",
      `${window.location.pathname}${filtersToSearch(filters)}${window.location.hash}`,
    );
  }, [filters]);
  useEffect(() => {
    setSearchValue(filters.query);
  }, [filters.query]);
  useEffect(() => {
    const restore = () => setFilters(parseFilters(window.location.search));
    const syncFavorites = (event: StorageEvent) => {
      if (event.key === favoriteKey || event.key === null)
        setFavorites(readFavorites());
    };
    window.addEventListener("popstate", restore);
    window.addEventListener("storage", syncFavorites);
    return () => {
      window.removeEventListener("popstate", restore);
      window.removeEventListener("storage", syncFavorites);
    };
  }, []);
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 3600);
    return () => clearTimeout(timer);
  }, [toast]);
  useEffect(() => {
    document.title =
      overlay === "detail" && selectedVehicle
        ? `${selectedVehicle.brand} ${selectedVehicle.model} · 车况档案 | 见车`
        : "见车 · 下一程，心里有底";
  }, [overlay, selectedVehicle]);

  function notify(message: string) {
    setToast({ id: Date.now(), message });
  }
  function changeFilters(patch: Partial<CatalogFilters>) {
    setFilters((current) => ({ ...current, ...patch }));
  }
  function resetFilters() {
    setFilters({ ...defaultFilters });
    setSearchValue("");
  }
  function scrollToCatalog() {
    document.getElementById("catalog")?.scrollIntoView({
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
        ? "auto"
        : "smooth",
      block: "start",
    });
  }

  function toggleFavorite(vehicle: Vehicle) {
    const exists = favorites.includes(vehicle.id);
    const next = exists
      ? favorites.filter((id) => id !== vehicle.id)
      : [...favorites, vehicle.id];
    setFavorites(next);
    try {
      localStorage.setItem(favoriteKey, JSON.stringify(next));
      notify(exists ? "已取消收藏" : "已加入收藏，下次可以接着看");
    } catch {
      notify("已更新当前收藏；浏览器暂时无法保存，刷新后不会保留。");
    }
  }
  function toggleCompare(vehicle: Vehicle) {
    if (compared.includes(vehicle.id)) {
      setCompared((current) => current.filter((id) => id !== vehicle.id));
      return;
    }
    if (compared.length >= 3) {
      notify("最多对比3台车，请先移除一台。");
      return;
    }
    setCompared((current) => [...current, vehicle.id]);
  }
  function showDetail(vehicle: Vehicle) {
    setSelectedVehicle(vehicle);
    setOverlay("detail");
  }
  function showBooking(vehicle: Vehicle) {
    setOverlay(null);
    setBookingVehicle(vehicle);
    setBookingOpen(true);
  }
  function toggleVisitTask(vehicleId: string, taskId: string) {
    setSelectedTaskIds((current) => {
      const ids = current[vehicleId] || [];
      return {
        ...current,
        [vehicleId]: ids.includes(taskId)
          ? ids.filter((id) => id !== taskId)
          : [...ids, taskId],
      };
    });
  }

  return (
    <>
      <a className="skip-link" href="#catalog">
        跳转到车辆列表
      </a>
      <header className="site-header">
        <div className="header-inner">
          <button
            className="brand"
            aria-label="见车首页"
            onClick={() => {
              resetFilters();
              window.scrollTo({ top: 0, behavior: "auto" });
            }}
          >
            <img src="/favicon.svg" width="36" height="36" alt="" />
            <span>
              见车<small>JIAN CHE</small>
            </span>
          </button>
          <button className="city-button" onClick={() => setOverlay("filters")}>
            <MapPin size={15} />
            <span>{filters.city === "all" ? "全部城市" : filters.city}</span>
            <ChevronDown size={13} />
          </button>
          <nav className="main-nav" aria-label="主导航">
            <button
              className={!filters.favoritesOnly ? "nav-active" : ""}
              onClick={() => {
                changeFilters({ favoritesOnly: false });
                scrollToCatalog();
              }}
            >
              发现好车
            </button>
            <button
              className={filters.favoritesOnly ? "nav-active" : ""}
              onClick={() => {
                setFilters({ ...defaultFilters, favoritesOnly: true });
                scrollToCatalog();
              }}
            >
              我的收藏
              {favorites.length > 0 && (
                <span className="nav-count">{favorites.length}</span>
              )}
            </button>
            <button onClick={() => setOverlay("guide")}>购车指南</button>
          </nav>
          <div className="header-end">
            <span className="demo-badge">交互示例</span>
            <button
              className="header-favorite"
              aria-label={`查看我的收藏，${favorites.length}台`}
              onClick={() => {
                setFilters({ ...defaultFilters, favoritesOnly: true });
                scrollToCatalog();
              }}
            >
              <Heart size={19} />
              <span>收藏</span>
            </button>
          </div>
        </div>
      </header>

      <main className="page-shell">
        <section className="hero" aria-label="见车选车介绍">
          <div className="hero-copy">
            <span className="hero-eyebrow">
              <span />
              好车，值得被看清楚
            </span>
            <h1>
              下一程，
              <br />
              心里有底。
            </h1>
            <p>
              看得见的车况，算得清的价格。
              <br />
              把选择交给你，把信息讲明白。
            </p>
            <button className="hero-link" onClick={scrollToCatalog}>
              找到适合我的车
              <ArrowRight size={18} />
            </button>
            <div className="hero-copy-mark" aria-hidden="true">
              JIAN CHE / YOUR NEXT CHAPTER
            </div>
          </div>
          <button
            className="hero-visual"
            onClick={() => showDetail(featured)}
            aria-label="查看沃尔沃XC60车况详情"
          >
            <img
              src="/images/hero.jpg"
              alt="沃尔沃XC60车型示意图"
              fetchPriority="high"
              width="1280"
              height="746"
            />
            <span className="hero-image-shade" />
            <span className="hero-visual-label">
              <span>给家人的下一程</span>
              <strong>
                空间大一点，
                <br />
                生活近一点。
              </strong>
            </span>
            <span className="hero-car-label">
              VOLVO XC60 <ArrowUpRight size={19} />
            </span>
            <span className="hero-image-note">车型示意图</span>
          </button>
        </section>
        <div className="trust-strip">
          <div>
            <FileCheck2 size={19} />
            <span>
              <strong>车况有据可看</strong>
              <small>检测结论与已知瑕疵一起展示</small>
            </span>
          </div>
          <div>
            <WalletCards size={19} />
            <span>
              <strong>费用逐项透明</strong>
              <small>车价、服务费分开列清</small>
            </span>
          </div>
          <div>
            <CalendarIcon />
            <span>
              <strong>按你的节奏看车</strong>
              <small>先了解，再选择看车时间</small>
            </span>
          </div>
        </div>

        <section
          className="catalog-section"
          id="catalog"
          aria-labelledby="catalog-title"
        >
          <div className="catalog-heading">
            <div>
              <span className="eyebrow">FIND YOUR NEXT CAR</span>
              <h2 id="catalog-title">
                {filters.favoritesOnly
                  ? "喜欢的车，留着慢慢看"
                  : "找到适合你的那一台"}
              </h2>
            </div>
            <form
              className="search-box"
              role="search"
              noValidate
              onSubmit={(event) => {
                event.preventDefault();
                if (!composing.current) changeFilters({ query: searchValue });
              }}
            >
              <Search size={18} />
              <label className="sr-only" htmlFor="vehicle-search">
                搜索品牌、车型或配置
              </label>
              <input
                id="vehicle-search"
                ref={searchRef}
                type="search"
                placeholder="搜索品牌、车型或配置"
                value={searchValue}
                onCompositionStart={() => {
                  composing.current = true;
                }}
                onCompositionEnd={(event) => {
                  composing.current = false;
                  changeFilters({ query: event.currentTarget.value });
                }}
                onChange={(event) => {
                  setSearchValue(event.target.value);
                  if (!composing.current)
                    changeFilters({ query: event.target.value });
                }}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && event.nativeEvent.isComposing)
                    event.preventDefault();
                }}
              />
              {searchValue && (
                <button
                  type="button"
                  className="search-clear"
                  aria-label="清除搜索"
                  onClick={() => {
                    setSearchValue("");
                    changeFilters({ query: "" });
                    searchRef.current?.focus();
                  }}
                >
                  <X size={16} />
                </button>
              )}
            </form>
          </div>

          <NeedsProfile
            needs={needs}
            onApply={(next) => {
              setNeeds(next);
              changeFilters({ sort: "recommended" });
              notify("用车需求已更新，已在当前筛选结果内重新推荐。");
            }}
            onClear={() => {
              setNeeds(null);
              notify("已清除用车需求，保留筛选条件和已选检测项目。");
            }}
          />

          <div className="category-row">
            <div
              className="category-options"
              role="group"
              aria-label="购车用途"
            >
              {categories.map((category) => (
                <button
                  key={category.id}
                  className={`category-button ${filters.category === category.id ? "is-active" : ""}`}
                  aria-pressed={filters.category === category.id}
                  onClick={() => changeFilters({ category: category.id })}
                >
                  <category.icon size={17} />
                  <span>{category.name}</span>
                  {category.id === "all" && (
                    <span className="category-count">{vehicles.length}</span>
                  )}
                </button>
              ))}
            </div>
            <span className="catalog-demo-note">示例车源 · 非真实销售</span>
          </div>

          <div className="catalog-layout">
            <aside className="filter-rail" aria-label="车辆筛选">
              <Filters
                filters={filters}
                onChange={changeFilters}
                onReset={resetFilters}
                idPrefix="desktop"
              />
            </aside>
            <div className="catalog-results">
              <div className="results-toolbar">
                <div className="result-count" role="status">
                  共 <strong>{filteredVehicles.length}</strong> 台
                  {filters.favoritesOnly ? "收藏车辆" : "符合条件的车"}
                  {filters.inspectedOnly && (
                    <span className="desktop-only"> · 均含示例检测资料</span>
                  )}
                </div>
                <div className="toolbar-actions">
                  <button
                    className="mobile-filter-button button button-outline button-small"
                    onClick={() => setOverlay("filters")}
                  >
                    <SlidersHorizontal size={16} />
                    筛选
                    {activeFilterCount > 0 && <span>{activeFilterCount}</span>}
                  </button>
                  <div className="sort-control">
                    <ArrowDownUp size={14} />
                    <label className="sr-only" htmlFor="sort-order">
                      车辆排序
                    </label>
                    <select
                      id="sort-order"
                      value={filters.sort}
                      onChange={(event) =>
                        changeFilters({
                          sort: event.target.value as CatalogFilters["sort"],
                        })
                      }
                    >
                      <option value="recommended">
                        {needs ? "按我的需求推荐" : "推荐排序"}
                      </option>
                      <option value="price-asc">价格从低到高</option>
                      <option value="price-desc">价格从高到低</option>
                      <option value="mileage">里程从少到多</option>
                    </select>
                    <ChevronDown size={12} />
                  </div>
                </div>
              </div>
              {needs && filteredVehicles.length > 0 && (
                <div className="recommendation-notice" role="status">
                  <strong>
                    {matchingNeedsCount === 0
                      ? "当前结果没有满足预算和座位要求的车"
                      : `其中 ${matchingNeedsCount} 台未超已填预算且座位数量符合要求`}
                  </strong>
                  <p>
                    {matchingNeedsCount === 0
                      ? "下方保留备选车，并标明不匹配原因。可以修改用车需求或调整筛选。"
                      : "推荐会说明适配理由与待确认项；符合预算和座位要求不代表车况通过。"}{" "}
                    {filters.sort !== "recommended"
                      ? "当前仍按你选择的价格或里程排序。"
                      : "已在当前筛选内按用车需求排序。"}
                  </p>
                </div>
              )}
              {(activeFilterCount > 0 || filters.favoritesOnly) && (
                <div className="active-filters">
                  {filters.favoritesOnly && (
                    <button
                      onClick={() => changeFilters({ favoritesOnly: false })}
                    >
                      我的收藏
                      <X size={12} />
                    </button>
                  )}
                  {filters.budget !== "all" && (
                    <button onClick={() => changeFilters({ budget: "all" })}>
                      {budgetLabels[filters.budget]}
                      <X size={12} />
                    </button>
                  )}
                  {filters.brand !== "all" && (
                    <button onClick={() => changeFilters({ brand: "all" })}>
                      {filters.brand}
                      <X size={12} />
                    </button>
                  )}
                  {filters.city !== "all" && (
                    <button onClick={() => changeFilters({ city: "all" })}>
                      {filters.city}
                      <X size={12} />
                    </button>
                  )}
                  {filters.inspectedOnly && (
                    <button
                      onClick={() => changeFilters({ inspectedOnly: false })}
                    >
                      有检测报告
                      <X size={12} />
                    </button>
                  )}
                </div>
              )}
              {filteredVehicles.length > 0 ? (
                <div className="vehicle-grid">
                  {filteredVehicles.map((vehicle) => (
                    <VehicleCard
                      key={vehicle.id}
                      vehicle={vehicle}
                      favorite={favorites.includes(vehicle.id)}
                      compared={compared.includes(vehicle.id)}
                      recommendation={
                        needs ? assessVehicle(vehicle, needs) : undefined
                      }
                      onFavorite={() => toggleFavorite(vehicle)}
                      onCompare={() => toggleCompare(vehicle)}
                      onDetail={() => showDetail(vehicle)}
                      onBook={() => showBooking(vehicle)}
                    />
                  ))}
                </div>
              ) : (
                <div className="empty-state">
                  <div className="empty-icon">
                    {filters.favoritesOnly && favorites.length === 0 ? (
                      <Heart size={36} />
                    ) : (
                      <Search size={36} />
                    )}
                  </div>
                  <h3>
                    {filters.favoritesOnly && favorites.length === 0
                      ? "还没有收藏车辆"
                      : "没有找到符合条件的车"}
                  </h3>
                  <p>
                    {filters.favoritesOnly && favorites.length === 0
                      ? "点击车辆照片右上角的爱心，把喜欢的车留在这里。"
                      : "试试放宽预算、更换城市，或者减少一个筛选条件。"}
                  </p>
                  <button className="button" onClick={resetFilters}>
                    浏览全部车源
                    <ArrowRight size={16} />
                  </button>
                </div>
              )}
              <div className="catalog-end">
                <span />
                <p>每一台车，都值得认真了解</p>
                <span />
              </div>
            </div>
          </div>
        </section>

        <section className="help-strip">
          <div className="help-icon">
            <Sparkles size={26} />
          </div>
          <div>
            <h2>第一次买二手车？从看懂信息开始。</h2>
            <p>预算怎么算、车况怎么看、到店问什么，给你一份简单的选车指南。</p>
          </div>
          <button
            className="button button-outline"
            onClick={() => setOverlay("guide")}
          >
            查看购车指南
            <ArrowUpRight size={16} />
          </button>
        </section>
      </main>

      <footer
        className={`site-footer ${compared.length ? "with-compare-bar" : ""}`}
      >
        <div className="footer-main">
          <div className="footer-brand">
            <img src="/favicon.svg" alt="" width="26" height="26" />
            <strong>见车</strong>
            <span>下一程，心里有底。</span>
          </div>
          <a href="./images/credits.html" target="_blank" rel="noreferrer">
            图片来源与署名
            <ArrowUpRight size={13} />
          </a>
        </div>
        <p>
          这是一个交互示例。车源、价格、车况与预约均为虚构数据；图片为车型示意，非在售实车。
        </p>
      </footer>

      {compared.length > 0 && (
        <section className="compare-bar" aria-label="已选对比车辆">
          <div className="compare-bar-label">
            <GitCompareArrows size={22} />
            <div>
              <strong>
                车辆对比 <span>{compared.length}/3</span>
              </strong>
              <small>
                {compared.length < 2
                  ? "再选1台，差异更清楚"
                  : "把关键差异放在一起看"}
              </small>
            </div>
          </div>
          <div className="compare-selected">
            {compareVehicles.map((vehicle) => (
              <div className="compare-mini" key={vehicle.id}>
                <img src={vehicle.image} alt="" />
                <span>
                  {vehicle.brand} {vehicle.model}
                </span>
                <button
                  className="icon-button"
                  aria-label={`移除${vehicle.brand}${vehicle.model}的对比`}
                  onClick={() => toggleCompare(vehicle)}
                >
                  <X size={14} />
                </button>
              </div>
            ))}
          </div>
          <div className="compare-bar-actions">
            <button className="text-button" onClick={() => setCompared([])}>
              清空
            </button>
            <button
              className="button"
              onClick={() => setOverlay("compare")}
              disabled={compared.length < 2}
            >
              开始对比
              <ArrowRight size={16} />
            </button>
          </div>
        </section>
      )}

      <div
        className="toast-region"
        role="status"
        aria-live="polite"
        aria-atomic="true"
      >
        {toast && (
          <div className="toast" key={toast.id}>
            <Check size={17} />
            <span>{toast.message}</span>
            <button
              className="icon-button"
              aria-label="关闭提示"
              onClick={() => setToast(null)}
            >
              <X size={15} />
            </button>
          </div>
        )}
      </div>
      <Modal
        open={overlay === "detail"}
        onClose={() => setOverlay(null)}
        title={
          selectedVehicle
            ? `${selectedVehicle.brand} ${selectedVehicle.model} · 车况详情`
            : "车况详情"
        }
        subtitle="价格与车况都摊开，选择才更有底气"
        className="detail-modal"
      >
        {selectedVehicle && (
          <VehicleDetails
            vehicle={selectedVehicle}
            needs={needs}
            selectedTaskIds={selectedTaskIds[selectedVehicle.id] || []}
            onToggleTask={(id) => toggleVisitTask(selectedVehicle.id, id)}
            onBook={() => showBooking(selectedVehicle)}
          />
        )}
      </Modal>
      <Modal
        open={overlay === "compare"}
        onClose={() => setOverlay(null)}
        title="车辆对比"
        subtitle={`已选择${compareVehicles.length}台车 · 最多支持3台`}
        className="compare-modal"
      >
        <Comparison vehicles={compareVehicles} onBook={showBooking} />
      </Modal>
      <Modal
        open={overlay === "filters"}
        onClose={() => setOverlay(null)}
        title="筛选车辆"
        className="filter-modal"
      >
        <div className="modal-body">
          <Filters
            filters={filters}
            onChange={changeFilters}
            onReset={resetFilters}
            idPrefix="dialog"
          />
          <button
            className="button full-width"
            onClick={() => {
              setOverlay(null);
              scrollToCatalog();
            }}
          >
            查看{filteredVehicles.length}台车
            <ArrowRight size={16} />
          </button>
        </div>
      </Modal>
      <Modal
        open={overlay === "guide"}
        onClose={() => setOverlay(null)}
        title="选车之前，先看这三件事"
        subtitle="花一点时间了解，给下一程多一点把握"
        className="guide-modal"
      >
        <div className="modal-body guide-body">
          <section>
            <WalletCards size={24} />
            <div>
              <h3>先把预算算完整</h3>
              <p>
                车价之外，确认服务费、过户、保险与运输等支出。页面里的“已列费用合计”会说明尚未计入的项目。
              </p>
            </div>
          </section>
          <section>
            <FileCheck2 size={24} />
            <div>
              <h3>看结论，也看依据</h3>
              <p>
                核实检测机构、日期、范围和瑕疵照片。没有历史记录，不代表从未发生事故；未检测的项目需要进一步核实。
              </p>
            </div>
          </section>
          <section>
            <ShieldCheck size={24} />
            <div>
              <h3>到店再核对实车</h3>
              <p>
                将页面信息与实车逐项比对，按需安排独立检测和试驾。签约前确认费用、交付条件及售后责任。
              </p>
            </div>
          </section>
          <div className="guide-note">
            本示例中的车源与车况数据均为虚构，仅展示信息组织方式。
          </div>
          <button
            className="button full-width"
            onClick={() => {
              setOverlay(null);
              scrollToCatalog();
            }}
          >
            我知道了，开始选车
            <ArrowRight size={16} />
          </button>
        </div>
      </Modal>
      <AppointmentDialog
        open={bookingOpen}
        vehicle={bookingVehicle}
        visitTasks={bookingTasks}
        needsSummary={needs ? summarizeNeeds(needs) : []}
        onReviewPlan={() => {
          setBookingOpen(false);
          if (bookingVehicle) showDetail(bookingVehicle);
        }}
        onClose={() => setBookingOpen(false)}
      />
    </>
  );
}

function CalendarIcon() {
  return (
    <svg
      width="19"
      height="19"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path d="M16 3v4M8 3v4M3 11h18m-13 5 3 3 5-5" />
    </svg>
  );
}
