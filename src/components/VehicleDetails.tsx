import {
  ArrowRight,
  BatteryCharging,
  CalendarDays,
  FileCheck2,
  Info,
  MapPin,
  ShieldCheck,
  Wrench,
} from "lucide-react";
import type { DrivingNeeds, Vehicle } from "../types";
import { formatMileage, formatPrice, totalKnownCost } from "../lib/catalog";
import { assessVehicle } from "../lib/recommendations";
import { InspectionRecords } from "./InspectionRecords";
import { VehicleGuidance } from "./VehicleGuidance";

export function VehicleDetails({
  vehicle,
  needs,
  selectedTaskIds,
  onToggleTask,
  onBook,
}: {
  vehicle: Vehicle;
  needs: DrivingNeeds | null;
  selectedTaskIds: string[];
  onToggleTask: (id: string) => void;
  onBook: () => void;
}) {
  const recommendation = needs ? assessVehicle(vehicle, needs) : null;
  return (
    <div className="modal-body detail-body">
      <div className="detail-top">
        <div className="detail-photo">
          <img
            src={vehicle.image}
            alt={`${vehicle.brand}${vehicle.model}车型示意，非在售实车`}
          />
          <span>车型示意 · 非在售实车</span>
        </div>
        <div className="detail-intro">
          <span className="eyebrow">这台车的档案</span>
          <h3>
            {vehicle.brand} {vehicle.model}
          </h3>
          <p>{vehicle.trim}</p>
          <div className="detail-price">
            <span>{formatPrice(vehicle.price)}</span> 万 <small>全款车价</small>
          </div>
          <p className="detail-summary">{vehicle.summary}</p>
          <div className="feature-tags">
            {vehicle.features.map((item) => (
              <span key={item}>{item}</span>
            ))}
          </div>
          <button className="button" onClick={onBook}>
            <CalendarDays size={17} />
            预约看车
            <ArrowRight size={16} />
          </button>
          <span className="subtle-text">演示预约 · 无需真实手机号</span>
        </div>
      </div>
      <dl className="vehicle-facts">
        <div>
          <dt>首次上牌</dt>
          <dd>{vehicle.firstRegistration}</dd>
        </div>
        <div>
          <dt>表显里程</dt>
          <dd>{formatMileage(vehicle.mileage)}</dd>
        </div>
        <div>
          <dt>车主数量（示例）</dt>
          <dd>{vehicle.owners} 位</dd>
        </div>
        <div>
          <dt>能源 / 变速箱</dt>
          <dd>
            {vehicle.energy} / {vehicle.transmission}
          </dd>
        </div>
      </dl>
      {recommendation && (
        <section
          className="detail-recommendation"
          aria-label="这台车与你的需求"
        >
          <h3>
            {recommendation.eligible
              ? "这台车，哪些地方适合你"
              : "这台车暂不满足你的预算或座位要求"}
          </h3>
          <p>
            示例规则推荐，不是车况结论。座位数为示例资料（{vehicle.seats}{" "}
            座），请核对实车登记及乘坐情况。
          </p>
          {recommendation.reasons.length > 0 && (
            <ul>
              {recommendation.reasons.map((reason) => (
                <li key={reason}>{reason}</li>
              ))}
            </ul>
          )}
          {recommendation.cautions.length > 0 && (
            <div className="recommendation-cautions">
              <strong>决定前，再确认这些</strong>
              <ul>
                {recommendation.cautions.map((caution) => (
                  <li key={caution}>{caution}</li>
                ))}
              </ul>
            </div>
          )}
        </section>
      )}
      <div className="detail-columns">
        <div>
          <section className="detail-section inspection-section">
            <div className="section-title">
              <FileCheck2 size={21} />
              <h3>车况档案</h3>
              <span
                className={`status-badge ${vehicle.inspected ? "" : "pending-badge"}`}
              >
                {vehicle.inspected ? "已有部分示例记录" : "尚未检测"}
              </span>
            </div>
            <p className="section-description">
              {vehicle.inspected
                ? `检测日期 ${vehicle.inspectedAt} · 来源：虚构检测记录`
                : "这台示例车尚未提供检测报告，请先核实车况。"}
            </p>
            <InspectionRecords vehicle={vehicle} />
            <p className="report-note">
              <Info size={14} />
              检测仅反映检测时点及范围。未检出、未检测和没有历史记录是不同状态。
            </p>
            <h4 className="minor-heading">已知瑕疵，提前告诉你</h4>
            <div className="defect-list">
              {vehicle.defects.map((defect, index) => (
                <div className="defect-row" key={defect.part}>
                  <span className="defect-number">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <div>
                    <h5>
                      {defect.part}
                      <span>{defect.severity}</span>
                    </h5>
                    <p>{defect.note}</p>
                  </div>
                  <Wrench size={15} />
                </div>
              ))}
            </div>
            <p className="subtle-text">
              以上均为展示用的示例记录，未提供对应部位的实拍证据。
            </p>
          </section>
          {vehicle.battery && (
            <section className="detail-section battery-section">
              <div className="section-title">
                <BatteryCharging size={21} />
                <h3>电池与权益</h3>
              </div>
              <div className="battery-health">
                <div>
                  <span>示例电池健康度</span>
                  <strong>
                    {vehicle.battery.health}
                    <small>%</small>
                  </strong>
                </div>
                <div>
                  <p>{vehicle.battery.source}</p>
                  <p>{vehicle.battery.date} · 检测方法待实际报告核实</p>
                </div>
              </div>
              <div
                className="battery-meter"
                role="img"
                aria-label={`示例电池健康度 ${vehicle.battery.health}%`}
              >
                <span style={{ width: `${vehicle.battery.health}%` }} />
              </div>
              <p>{vehicle.battery.ownership}</p>
              <p className="subtle-text">{vehicle.battery.warranty}</p>
            </section>
          )}
        </div>
        <div>
          <section className="detail-section cost-section">
            <div className="section-title">
              <h3>费用，一项项列清楚</h3>
            </div>
            <dl className="cost-list">
              <div>
                <dt>车辆售价</dt>
                <dd>¥{vehicle.price.toLocaleString("zh-CN")}</dd>
              </div>
              <div>
                <dt>平台服务费（示例）</dt>
                <dd>¥{vehicle.serviceFee.toLocaleString("zh-CN")}</dd>
              </div>
              <div>
                <dt>过户服务费（示例）</dt>
                <dd>¥{vehicle.transferFee.toLocaleString("zh-CN")}</dd>
              </div>
              <div className="cost-total">
                <dt>已列费用合计</dt>
                <dd>¥{totalKnownCost(vehicle).toLocaleString("zh-CN")}</dd>
              </div>
            </dl>
            <div className="cost-exclusions">
              <Info size={15} />
              <p>
                保险、异地运输等费用尚未计入，需按实际情况另行确认。此处为示例报价。
              </p>
            </div>
          </section>
          <section className="detail-section seller-section">
            <MapPin size={22} />
            <h3>现场看看，更有把握</h3>
            <p>{vehicle.location}</p>
            <p className="subtle-text">
              地点为演示数据，可体验选择日期与时段。
            </p>
            <button
              className="button button-outline full-width"
              onClick={onBook}
            >
              选择看车时间
              <ArrowRight size={16} />
            </button>
          </section>
          <div className="detail-disclaimer">
            <ShieldCheck size={19} />
            <p>
              真实交易时，请核实报告来源、车况和合同中的保障提供方、期限及范围。
            </p>
          </div>
        </div>
      </div>
      <VehicleGuidance
        vehicle={vehicle}
        needs={needs}
        selectedTaskIds={selectedTaskIds}
        onToggleTask={onToggleTask}
        onBook={onBook}
      />
    </div>
  );
}
