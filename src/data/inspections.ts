import type { InspectionRecord, Vehicle } from "../types.ts";

const names = {
  structure: "结构性损伤",
  flood: "泡水痕迹",
  fire: "火烧痕迹",
  bodywork: "车身外观与漆面",
  tires: "轮胎",
  brakes: "制动系统",
  powertrain: "动力总成",
  battery: "动力电池",
} as const;
type CheckId = keyof typeof names;
const reportSource = "虚构报告摘要，无报告原件";

function record(
  id: CheckId,
  status: InspectionRecord["status"],
  result: string,
  checkedAt: string | null = null,
  source: string | null = null,
): InspectionRecord {
  return { id, name: names[id], status, result, checkedAt, source };
}

/**
 * Per-item fictional evidence. The listing-level inspected flag only describes
 * report availability and must never manufacture a result for a missing check.
 */
const recordsByVehicle: Readonly<Record<string, readonly InspectionRecord[]>> =
  {
    "tesla-model3": [
      record(
        "structure",
        "recorded",
        "本次示例未检出",
        "2026-10-27",
        reportSource,
      ),
      record("flood", "recorded", "本次示例未检出", "2026-10-27", reportSource),
      record("fire", "recorded", "本次示例未检出", "2026-10-27", reportSource),
      record(
        "bodywork",
        "attention",
        "右后轮毂擦痕；前保险杠局部补漆。",
        "2026-10-27",
        reportSource,
      ),
      record("tires", "pending", "未提供胎纹、轮胎磨损及老化专项记录。"),
      record(
        "brakes",
        "pending",
        "未提供制动系统专项记录，需由专业检测方检查。",
      ),
      record("powertrain", "pending", "未提供电驱、底盘及行驶异响专项记录。"),
      record(
        "battery",
        "unverified",
        "示例健康度 94%；检测方法、范围及报告原件待核验。",
        "2026-10-27",
        "虚构电池报告摘要，无报告原件",
      ),
    ],
    "bmw-3": [
      record(
        "structure",
        "recorded",
        "本次示例未检出",
        "2026-10-26",
        reportSource,
      ),
      record("flood", "recorded", "本次示例未检出", "2026-10-26", reportSource),
      record("fire", "recorded", "本次示例未检出", "2026-10-26", reportSource),
      record(
        "bodywork",
        "attention",
        "左前翼子板局部补漆；主驾驶座椅侧翼有褶皱。",
        "2026-10-26",
        reportSource,
      ),
      record("tires", "pending", "未提供胎纹、轮胎磨损及老化专项记录。"),
      record(
        "brakes",
        "pending",
        "未提供制动系统专项记录，需由专业检测方检查。",
      ),
      record(
        "powertrain",
        "unverified",
        "冷启动、变速箱及维保信息缺少可核对的专项原件。",
        null,
        "虚构资料清单，无专项报告原件",
      ),
    ],
    "volvo-xc60": [
      record(
        "structure",
        "recorded",
        "本次示例未检出",
        "2026-10-28",
        reportSource,
      ),
      record("flood", "recorded", "本次示例未检出", "2026-10-28", reportSource),
      record("fire", "recorded", "本次示例未检出", "2026-10-28", reportSource),
      record(
        "bodywork",
        "attention",
        "右后车门约 2 cm 浅划痕；后备箱饰板擦痕。",
        "2026-10-28",
        reportSource,
      ),
      record("tires", "pending", "未提供胎纹、轮胎磨损及老化专项记录。"),
      record(
        "brakes",
        "pending",
        "未提供制动系统专项记录，需由专业检测方检查。",
      ),
      record("powertrain", "pending", "未提供四驱系统、变速箱及渗漏专项记录。"),
    ],
    "vw-golf": [
      record(
        "structure",
        "recorded",
        "本次示例未检出",
        "2026-10-24",
        reportSource,
      ),
      record("flood", "recorded", "本次示例未检出", "2026-10-24", reportSource),
      record("fire", "recorded", "本次示例未检出", "2026-10-24", reportSource),
      record(
        "bodywork",
        "attention",
        "后保险杠局部补漆，示例记录为已修复。",
        "2026-10-24",
        reportSource,
      ),
      record(
        "tires",
        "attention",
        "前轮胎剩余胎纹约 3.1 mm；需到店复核磨损并评估更换。",
        "2026-10-24",
        reportSource,
      ),
      record(
        "brakes",
        "pending",
        "未提供制动系统专项记录，需由专业检测方检查。",
      ),
      record(
        "powertrain",
        "pending",
        "未提供冷启动、双离合变速箱及行驶异响专项记录。",
      ),
    ],
    "toyota-camry": [
      record(
        "structure",
        "recorded",
        "本次示例未检出",
        "2026-10-23",
        reportSource,
      ),
      record("flood", "recorded", "本次示例未检出", "2026-10-23", reportSource),
      record("fire", "recorded", "本次示例未检出", "2026-10-23", reportSource),
      record(
        "bodywork",
        "attention",
        "左后车门补漆；方向盘表面有使用磨损。",
        "2026-10-23",
        reportSource,
      ),
      record("tires", "pending", "未提供胎纹、轮胎磨损及老化专项记录。"),
      record(
        "brakes",
        "pending",
        "未提供制动系统专项记录，需由专业检测方检查。",
      ),
      record(
        "powertrain",
        "unverified",
        "维保及动力总成资料尚无可核对原件，不等于无维修记录。",
        null,
        "虚构资料清单，无专项报告原件",
      ),
    ],
    "nio-et5": [
      record(
        "structure",
        "recorded",
        "本次示例未检出",
        "2026-10-25",
        reportSource,
      ),
      record("flood", "recorded", "本次示例未检出", "2026-10-25", reportSource),
      record("fire", "recorded", "本次示例未检出", "2026-10-25", reportSource),
      record(
        "bodywork",
        "attention",
        "左前轮毂擦痕；右侧门槛饰板有细微划痕。",
        "2026-10-25",
        reportSource,
      ),
      record("tires", "pending", "未提供胎纹、轮胎磨损及老化专项记录。"),
      record(
        "brakes",
        "pending",
        "未提供制动系统专项记录，需由专业检测方检查。",
      ),
      record(
        "powertrain",
        "pending",
        "未提供双电机驱动系统及行驶异响专项记录。",
      ),
      record(
        "battery",
        "unverified",
        "示例健康度 96%；检测方法、买断信息、换电及质保权益仍待原件核验。",
        "2026-10-25",
        "虚构电池报告摘要，无报告原件",
      ),
    ],
    "mini-cooper": [
      record("structure", "pending", "待检测"),
      record("flood", "pending", "待检测"),
      record("fire", "pending", "待检测"),
      record(
        "bodywork",
        "unverified",
        "卖家自述前保险杠有擦痕，尚未独立检测。",
        null,
        "虚构卖家自述，未核验",
      ),
      record("tires", "pending", "未提供胎纹、轮胎磨损及老化专项记录。"),
      record(
        "brakes",
        "pending",
        "未提供制动系统专项记录，需由专业检测方检查。",
      ),
      record(
        "powertrain",
        "pending",
        "未提供冷启动、变速箱及行驶异响专项记录。",
      ),
    ],
    "mercedes-c": [
      record(
        "structure",
        "recorded",
        "本次示例未检出",
        "2026-10-20",
        reportSource,
      ),
      record("flood", "recorded", "本次示例未检出", "2026-10-20", reportSource),
      record("fire", "recorded", "本次示例未检出", "2026-10-20", reportSource),
      record(
        "bodywork",
        "attention",
        "右前翼子板局部补漆；后保险杠有未修复细小划痕。",
        "2026-10-20",
        reportSource,
      ),
      record("tires", "pending", "未提供胎纹、轮胎磨损及老化专项记录。"),
      record(
        "brakes",
        "pending",
        "未提供制动系统专项记录，需由专业检测方检查。",
      ),
      record("powertrain", "pending", "未提供冷启动、变速箱及渗漏专项记录。"),
    ],
  };

export function getVehicleInspections(vehicle: Vehicle): InspectionRecord[] {
  const records = Object.hasOwn(recordsByVehicle, vehicle.id)
    ? recordsByVehicle[vehicle.id]
    : (Object.keys(names) as CheckId[])
        .filter((id) => id !== "battery" || vehicle.energy === "纯电")
        .map((id) => record(id, "pending", "未提供该项目记录，待检测。"));
  return records.map((item) => ({ ...item }));
}
