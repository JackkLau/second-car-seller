import { ArrowRight } from "lucide-react";
import type { Vehicle } from "../types";
import { formatMileage, formatPrice, totalKnownCost } from "../lib/catalog";

export function Comparison({
  vehicles,
  onBook,
}: {
  vehicles: Vehicle[];
  onBook: (vehicle: Vehicle) => void;
}) {
  const rows: {
    label: string;
    value: (vehicle: Vehicle) => string;
    emphasis?: boolean;
  }[] = [
    {
      label: "车辆售价",
      value: (vehicle) => `${formatPrice(vehicle.price)} 万元`,
      emphasis: true,
    },
    {
      label: "已列费用合计",
      value: (vehicle) => `¥${totalKnownCost(vehicle).toLocaleString("zh-CN")}`,
    },
    { label: "首次上牌", value: (vehicle) => vehicle.firstRegistration },
    { label: "表显里程", value: (vehicle) => formatMileage(vehicle.mileage) },
    { label: "所在地", value: (vehicle) => vehicle.city },
    { label: "能源", value: (vehicle) => vehicle.energy },
    {
      label: "检测资料",
      value: (vehicle) =>
        vehicle.inspected
          ? `示例报告 · ${vehicle.inspectedAt}`
          : "尚未提供检测报告",
    },
    {
      label: "已知瑕疵",
      value: (vehicle) =>
        vehicle.defects
          .map((defect) => `${defect.part}：${defect.note}`)
          .join("；"),
    },
    { label: "主要配置", value: (vehicle) => vehicle.features.join(" / ") },
    {
      label: "电池资料",
      value: (vehicle) =>
        vehicle.battery
          ? `示例健康度 ${vehicle.battery.health}% · ${vehicle.battery.ownership}`
          : "不适用",
    },
  ];
  return (
    <div className="modal-body compare-body">
      <p className="comparison-note">
        同一张表，把关键差异看清楚。已列费用合计不含保险及异地运输。
      </p>
      <div
        className="comparison-scroll"
        tabIndex={0}
        aria-label="车辆对比表，可横向滚动"
      >
        <table className="comparison-table">
          <caption className="sr-only">所选车辆的价格、车况和配置对比</caption>
          <thead>
            <tr>
              <th scope="col">对比项目</th>
              {vehicles.map((vehicle) => (
                <th scope="col" key={vehicle.id}>
                  <img
                    src={vehicle.image}
                    alt={`${vehicle.brand}${vehicle.model}车型示意图`}
                  />
                  <strong>
                    {vehicle.brand} {vehicle.model}
                  </strong>
                  <span>{vehicle.trim}</span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr
                key={row.label}
                className={row.emphasis ? "price-comparison-row" : ""}
              >
                <th scope="row">{row.label}</th>
                {vehicles.map((vehicle) => (
                  <td key={vehicle.id}>{row.value(vehicle)}</td>
                ))}
              </tr>
            ))}
            <tr>
              <th scope="row">下一步</th>
              {vehicles.map((vehicle) => (
                <td key={vehicle.id}>
                  <button
                    className="button button-small"
                    onClick={() => onBook(vehicle)}
                  >
                    预约看车
                    <ArrowRight size={14} />
                  </button>
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
