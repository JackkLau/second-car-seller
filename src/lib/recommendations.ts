import type { DrivingNeeds, Vehicle } from "../types.ts";
import { totalKnownCost } from "./catalog.ts";

export const defaultNeeds: DrivingNeeds = {
  purpose: "unsure",
  maxBudget: null,
  passengers: "unsure",
  dailyDistance: "unsure",
  charging: "unsure",
  priority: "balanced",
};

export type Recommendation = {
  vehicleId: string;
  /** Internal ordering weight, never a probability or a displayed match percentage. */
  score: number;
  eligible: boolean;
  reasons: string[];
  cautions: string[];
};

const purposeLabels = {
  unsure: "",
  commute: "日常通勤",
  family: "家庭出行",
  "long-distance": "经常长途",
};
const passengerLabels = {
  unsure: "",
  "1-2": "常乘1–2人",
  "3-5": "常乘3–5人（按5座核对）",
  "6+": "常乘6人及以上（至少6座）",
};
const distanceLabels = {
  unsure: "",
  under30: "日常少于30公里",
  "30to80": "日常30–80公里",
  over80: "日常80公里以上",
};
const chargingLabels = {
  unsure: "",
  home: "有固定家充",
  public: "依赖公共充电",
  none: "暂无方便的充电条件",
};
const priorityLabels = {
  balanced: "",
  parking: "优先考虑停车便利",
  comfort: "优先考虑乘坐舒适",
  "running-cost": "优先核对日常开支",
};

export function summarizeNeeds(needs: DrivingNeeds): string[] {
  return [
    purposeLabels[needs.purpose],
    needs.maxBudget === null
      ? ""
      : Number.isFinite(needs.maxBudget) && needs.maxBudget >= 0
        ? `已列费用预算上限${(needs.maxBudget / 10000).toLocaleString("zh-CN")}万`
        : "预算上限需要重新设置",
    passengerLabels[needs.passengers],
    distanceLabels[needs.dailyDistance],
    chargingLabels[needs.charging],
    priorityLabels[needs.priority],
  ].filter(Boolean);
}

/** Explainable demo rules. A report flag, low mileage, or score is never safety evidence. */
export function assessVehicle(
  vehicle: Vehicle,
  needs: DrivingNeeds,
): Recommendation {
  const reasons: string[] = [];
  const blockingCautions: string[] = [];
  const cautions: string[] = [];
  let eligible = true;
  let score = 0;
  const electric = vehicle.energy === "纯电";
  const compact = vehicle.body === "两厢车";
  const family = vehicle.suitability.includes("family");

  if (needs.maxBudget !== null) {
    if (!Number.isFinite(needs.maxBudget) || needs.maxBudget < 0) {
      eligible = false;
      blockingCautions.push("预算上限无效，请重新设置后再比较。");
    } else if (totalKnownCost(vehicle) > needs.maxBudget) {
      eligible = false;
      blockingCautions.push(
        `已列费用合计¥${totalKnownCost(vehicle).toLocaleString("zh-CN")}，超出你的预算上限。`,
      );
    } else {
      score += 1;
      reasons.push(
        `已列费用合计¥${totalKnownCost(vehicle).toLocaleString("zh-CN")}，在你的预算上限内。`,
      );
    }
    cautions.push("保险、专项检测和整备等待报价，尚未计入上述预算比较。");
  }

  if (needs.passengers !== "unsure") {
    const requiredSeats = { "1-2": 2, "3-5": 5, "6+": 6 }[needs.passengers];
    if (vehicle.seats < requiredSeats) {
      eligible = false;
      blockingCautions.push(
        `这台示例车为${vehicle.seats}座，不满足至少${requiredSeats}座的乘坐需求。`,
      );
    } else {
      reasons.push(
        `示例登记${vehicle.seats}座，座位数量满足所选人数；空间仍需实坐核对。`,
      );
    }
  }

  if (needs.purpose === "commute" && vehicle.suitability.includes("commute")) {
    score += 3;
    reasons.push("这台车的示例用途标签包含日常通勤。");
  } else if (needs.purpose === "family") {
    if (family) {
      score += 3;
      reasons.push(
        "这台车的示例用途标签包含家庭出行，可优先核对后排和行李空间。",
      );
    } else {
      cautions.push(
        "这台车的示例用途偏向通勤，家庭乘坐与行李空间需要重点实测。",
      );
    }
  } else if (needs.purpose === "long-distance") {
    if (!electric) {
      score += 2;
      reasons.push("这台车不依赖充电，可按你的长途路线核对加油与休息安排。");
    }
    cautions.push(
      electric
        ? "缺少实车长途续航数据，先核对电池状态、实际能耗和沿途补能安排。"
        : "长途使用前需复核轮胎、制动和动力系统，并体验噪声与乘坐感受。",
    );
  }

  if (electric) {
    if (needs.charging === "home") {
      score += 3;
      reasons.push("你有固定家充，日常补能安排可作为选择纯电车的有利条件。");
    } else if (needs.charging === "none") {
      score -= 8;
      cautions.push(
        "你暂时没有方便的充电条件，需先解决补能安排，再考虑这台纯电车。",
      );
    } else if (needs.charging === "public") {
      score -= 1;
      cautions.push(
        "依赖公共充电，需实地核对常用站点、排队时间、费用及车型兼容性。",
      );
    } else {
      cautions.push(
        "补能条件尚未明确，选择纯电前请先核对固定或公共充电是否方便。",
      );
    }
    if (needs.dailyDistance === "over80") {
      if (needs.charging === "home") score += 2;
      cautions.push(
        "日常里程较长，需核实实车续航与补能频率，不能用示例电池健康度推算续航。",
      );
    }
  }

  if (needs.priority === "parking") {
    if (compact) {
      score += 4;
      reasons.push(
        "两厢车身可优先纳入停车体验清单，建议现场试停常用尺寸车位。",
      );
      if (needs.dailyDistance === "under30") score += 1;
    }
    cautions.push("页面未提供实测车身尺寸和转弯空间，请核对车位后再决定。");
  } else if (needs.priority === "comfort") {
    if (family) {
      score += 2;
      reasons.push("家庭用途标签与舒适偏好相近，建议全员实坐并体验后排。");
    }
    cautions.push("舒适感因人而异，需到店体验座椅、上下车、空调和行驶噪声。");
  } else if (needs.priority === "running-cost") {
    if (electric && needs.charging === "home") {
      score += 2;
      reasons.push("固定家充条件便于按实际电价和用车里程核算补能支出。");
    }
    cautions.push("缺少真实能耗、保险和整备报价，当前不能判断实际持有成本。");
  }

  if (!vehicle.inspected) {
    cautions.push("尚无完成检测记录，请先核实车况，再决定是否继续看车。");
  }
  const concern = vehicle.defects.find(
    (defect) => defect.severity === "需关注",
  );
  if (concern) {
    cautions.push(
      `已知${concern.part}需关注，建议先取得复核结果和可能的整备报价。`,
    );
  }
  if (reasons.length === 0) {
    reasons.push(
      summarizeNeeds(needs).length === 0
        ? "尚未设置明确用车偏好，先按一般推荐顺序浏览。"
        : "目前没有足够的已知条件支持优先推荐，可作为备选进一步核对。",
    );
  }

  return {
    vehicleId: vehicle.id,
    score,
    eligible,
    reasons,
    cautions: [...blockingCautions, ...cautions],
  };
}

/** Hard constraints sort first; preferences never compensate for a budget or seat mismatch. */
export function rankForNeeds(
  vehicles: readonly Vehicle[],
  needs: DrivingNeeds,
): Vehicle[] {
  return vehicles
    .map((vehicle, index) => ({
      vehicle,
      index,
      assessment: assessVehicle(vehicle, needs),
    }))
    .sort(
      (left, right) =>
        Number(right.assessment.eligible) - Number(left.assessment.eligible) ||
        right.assessment.score - left.assessment.score ||
        right.vehicle.recommendation - left.vehicle.recommendation ||
        left.index - right.index,
    )
    .map(({ vehicle }) => vehicle);
}
