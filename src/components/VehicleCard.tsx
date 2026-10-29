import {
  ArrowUpRight,
  Check,
  FileCheck2,
  GitCompareArrows,
  Heart,
  MapPin,
  SearchCheck,
} from "lucide-react";
import type { Vehicle } from "../types";
import { formatMileage, formatPrice } from "../lib/catalog";
import type { Recommendation } from "../lib/recommendations";
import { getVehicleInspections } from "../data/inspections";

interface VehicleCardProps {
  vehicle: Vehicle;
  favorite: boolean;
  compared: boolean;
  recommendation?: Recommendation;
  onFavorite: () => void;
  onCompare: () => void;
  onDetail: () => void;
  onBook: () => void;
}

export function VehicleCard({
  vehicle,
  favorite,
  compared,
  recommendation,
  onFavorite,
  onCompare,
  onDetail,
  onBook,
}: VehicleCardProps) {
  const inspections = getVehicleInspections(vehicle);
  const checkedCount = inspections.filter(
    (item) => item.status === "recorded" || item.status === "attention",
  ).length;
  const pendingCount = inspections.length - checkedCount;
  return (
    <article
      className="vehicle-card"
      data-testid="vehicle-card"
      data-vehicle-id={vehicle.id}
    >
      <div className="vehicle-image-wrap">
        <button
          className="vehicle-image-button"
          onClick={onDetail}
          aria-label={`查看${vehicle.brand}${vehicle.model}详情`}
        >
          <img
            src={vehicle.image}
            alt={`${vehicle.brand}${vehicle.model}车型示意图`}
            loading="lazy"
            width="900"
            height="600"
            style={{ objectPosition: vehicle.imagePosition || "center" }}
          />
        </button>
        <span
          className={`photo-label ${vehicle.energy === "纯电" ? "electric-label" : ""}`}
        >
          {vehicle.tag}
        </span>
        <button
          className={`favorite-button ${favorite ? "is-favorite" : ""}`}
          onClick={onFavorite}
          aria-label={`${favorite ? "取消收藏" : "收藏"}${vehicle.brand}${vehicle.model}`}
          aria-pressed={favorite}
        >
          <Heart size={19} fill={favorite ? "currentColor" : "none"} />
        </button>
        <span className="photo-caption">车型示意</span>
      </div>
      <div className="vehicle-content">
        <div className="vehicle-heading">
          <h3>
            <button onClick={onDetail}>
              {vehicle.brand} {vehicle.model}
            </button>
          </h3>
          <span className="location">
            <MapPin size={12} />
            {vehicle.city}
          </span>
        </div>
        <p className="vehicle-trim">{vehicle.trim}</p>
        <div className="vehicle-meta">
          <span>{vehicle.firstRegistration.slice(0, 4)}年上牌</span>
          <i />
          <span>表显 {formatMileage(vehicle.mileage)}</span>
          <i />
          <span>{vehicle.energy}</span>
        </div>
        <div className="feature-tags">
          {vehicle.features.slice(0, 2).map((feature) => (
            <span key={feature}>{feature}</span>
          ))}
        </div>
        {recommendation && (
          <div
            className={`card-recommendation ${recommendation.eligible ? "" : "needs-mismatch"}`}
          >
            <strong>
              {recommendation.eligible
                ? "与你的需求相关"
                : "暂不满足预算或座位要求"}
            </strong>
            {recommendation.reasons.length > 0 && (
              <p>{recommendation.reasons[0]}</p>
            )}
            {recommendation.cautions.length > 0 && (
              <p className="recommendation-caution">
                需留意：{recommendation.cautions[0]}
              </p>
            )}
            <button onClick={onDetail}>
              查看适配理由与检测建议
              <ArrowUpRight size={13} />
            </button>
          </div>
        )}
        <button
          className={`condition-line ${vehicle.inspected ? "" : "condition-pending"}`}
          onClick={onDetail}
        >
          {vehicle.inspected ? (
            <FileCheck2 size={16} />
          ) : (
            <SearchCheck size={16} />
          )}
          <span>已查 {checkedCount} 项</span>
          <span className="condition-note">待检测/核验 {pendingCount} 项</span>
          <ArrowUpRight size={14} />
        </button>
        <div className="price-row">
          <div>
            <span className="price">{formatPrice(vehicle.price)}</span>
            <span className="price-unit">万</span>
            <span className="price-label">车价</span>
          </div>
          <span className="fee-hint">
            另列费用 ¥
            {(vehicle.serviceFee + vehicle.transferFee).toLocaleString("zh-CN")}
          </span>
        </div>
        <div className="card-actions">
          <button
            className={`compare-toggle ${compared ? "is-selected" : ""}`}
            onClick={onCompare}
            aria-label={`${compared ? "取消对比" : "加入对比"}${vehicle.brand}${vehicle.model}`}
            aria-pressed={compared}
          >
            {compared ? <Check size={16} /> : <GitCompareArrows size={16} />}
            <span>{compared ? "已选对比" : "对比"}</span>
          </button>
          <button
            className="button button-small button-outline"
            onClick={onDetail}
          >
            查看车况
          </button>
          <button className="button button-small" onClick={onBook}>
            预约看车
          </button>
        </div>
      </div>
    </article>
  );
}
