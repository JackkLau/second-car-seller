import {
  CircleAlert,
  ClipboardCheck,
  Clock3,
  FileQuestion,
} from "lucide-react";
import type { Vehicle } from "../types";
import { getVehicleInspections } from "../data/inspections";

export function InspectionRecords({ vehicle }: { vehicle: Vehicle }) {
  const records = getVehicleInspections(vehicle);
  const groups = [
    { title: "已经检查", states: ["recorded", "attention"] },
    { title: "需要补检", states: ["pending"] },
    { title: "资料需要核验", states: ["unverified"] },
  ];
  const statusLabels = {
    recorded: "已有检查记录",
    attention: "已查 · 需关注",
    pending: "待检测",
    unverified: "待核验",
  };
  return (
    <div className="inspection-records">
      {groups.map((group) => {
        const items = records.filter((record) =>
          group.states.includes(record.status),
        );
        if (!items.length) return null;
        return (
          <section key={group.title} aria-label={group.title}>
            <h4>
              {group.title}
              <span>{items.length} 项</span>
            </h4>
            <ul className="inspection-record-list">
              {items.map((record) => {
                const Icon =
                  record.status === "recorded"
                    ? ClipboardCheck
                    : record.status === "attention"
                      ? CircleAlert
                      : record.status === "pending"
                        ? Clock3
                        : FileQuestion;
                return (
                  <li
                    key={record.id}
                    data-testid={`inspection-record-${record.id}`}
                  >
                    <div className="inspection-record-heading">
                      <strong>{record.name}</strong>
                      <span
                        className={`inspection-state inspection-state-${record.status}`}
                      >
                        <Icon size={14} />
                        {statusLabels[record.status]}
                      </span>
                    </div>
                    <p>{record.result}</p>
                    <small>
                      {record.checkedAt
                        ? `检查日期 ${record.checkedAt}`
                        : "检查日期未提供"}{" "}
                      · {record.source || "尚无检查来源"}
                    </small>
                  </li>
                );
              })}
            </ul>
          </section>
        );
      })}
      <p className="field-caption">
        以上为逐项虚构记录，不是实车检测结论。已有检查记录不代表全部项目正常，仍需核对原件、范围及实车。
      </p>
    </div>
  );
}
