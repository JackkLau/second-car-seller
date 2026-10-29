import { getVehicleInspections } from "../data/inspections.ts";
import type {
  AdditionalCost,
  DrivingNeeds,
  Vehicle,
  VisitTask,
} from "../types.ts";

const quoteFirst =
  "待报价：先书面确认是否收费、是否已含服务费及费用承担方；勾选项目不会产生收费。";

/** Stable task IDs preserve a buyer's selections while their preferences change. */
export function buildVisitTasks(
  vehicle: Vehicle,
  needs: DrivingNeeds | null,
): VisitTask[] {
  const inspections = getVehicleInspections(vehicle);
  const missing = inspections.filter((item) => item.status === "pending");
  const findings = inspections.filter(
    (item) =>
      item.status === "attention" ||
      (item.id === "bodywork" && item.status === "unverified"),
  );
  const family =
    needs?.purpose === "family" ||
    needs?.passengers === "3-5" ||
    needs?.passengers === "6+";
  const longDistance =
    needs?.purpose === "long-distance" || needs?.dailyDistance === "over80";
  const parking = needs?.priority === "parking";
  const tasks: VisitTask[] = [
    {
      id: "report-review",
      title: "核对报告与车辆身份",
      reason:
        "当前仅展示虚构记录，未提供报告原件；已有记录不等于当前所有项目合格。",
      userAction:
        "核对车架号、报告日期、检测范围与实车，圈出不理解或缺少证据的结论。",
      salesAction:
        "请销售提供可核对的报告原件、瑕疵照片、维保来源及车辆在售状态，说明未覆盖和未核验的项目。",
      feeNote:
        "资料提供是否收费、是否已含服务费待确认；如需另购查询报告，先确认来源、书面报价和承担方。",
      suggested: true,
    },
    {
      id: "missing-checks",
      title: "补齐待检测项目",
      reason: missing.length
        ? "尚缺专项记录：" + missing.map((item) => item.name).join("、") + "。"
        : "暂无标记为待检测的项目；仍可按报告范围要求独立复检。",
      userAction:
        "确认自己要补查的范围，选择是否接受检测方案，收到结果后逐项核对；专业检测由检测方完成。",
      salesAction:
        "请销售协调独立检测方、专业人员和工位，先出项目范围与书面报价，取得同意后安排，并交付逐项结果和异常证据。",
      feeNote: quoteFirst,
      suggested: missing.length > 0,
    },
    {
      id: "condition-review",
      title: "复核瑕疵与整备方案",
      reason: findings.length
        ? "需要核对的提示：" +
          findings.map((item) => item.name).join("、") +
          "；卖家自述不等于已检测结论。"
        : "可对报告与实车不一致、使用磨损或新发现的问题提出复核。",
      userAction:
        "到店核对标记部位与照片，记录接受、需修复或继续比较的项目；未确认报价前不默认同意整备。",
      salesAction:
        "请销售逐项解释瑕疵，安排专业人员复核，分别列明维修项目、配件、工时、复检和交付条件，再确认费用承担方。",
      feeNote: quoteFirst + " 维修与复检是否分别收费需另行列明。",
      suggested: findings.length > 0,
    },
    {
      id: "road-experience",
      title: "体验日常驾驶与乘坐",
      reason: longDistance
        ? "你有长途或较高日常里程需求，需重点体验乘坐舒适、噪声和日常驾驶感受。"
        : needs?.priority === "comfort"
          ? "你更关注舒适性，建议前后排都体验座椅、空调及正常行驶时的感受。"
          : "用实际常见场景核对驾驶与乘坐感受，主观体验不能替代专业车况检测。",
      userAction:
        "在手续和保险安排确认后，由销售陪同按约定路线体验正常起步、转向、停车及乘坐，记录异响或不适。",
      salesAction:
        "请销售先确认试驾资格、车辆状态、陪同人、路线、保险及责任安排；专业制动性能检测交由检测方完成。",
      feeNote:
        "试驾是否收费、是否已含服务费、押金及退还条件均待书面确认；本演示不收取费用。",
      suggested: true,
    },
    {
      id: "family-fit",
      title: "核对乘坐与装载需求",
      reason:
        needs?.passengers === "6+" && vehicle.seats < 6
          ? "这台示例车为 " +
            vehicle.seats +
            " 座，不能满足 6 人及以上需求，应先调整候选。"
          : needs?.passengers === "3-5" && vehicle.seats < 5
            ? "这台示例车为 " +
              vehicle.seats +
              " 座；若需要 5 人同行，应先换选座位足够的车辆。"
            : family
              ? "你有家庭或多人乘坐需求；这台示例车为 " +
                vehicle.seats +
                " 座，需按实际人数核对空间。"
              : "可按实际乘坐人数核对座位、上下车及常用行李空间。",
      userAction:
        "先核对核载人数，再正常试坐；可带常用行李或儿童座椅，按车辆与座椅说明核对适配，不能用试坐替代核载核验。",
      salesAction:
        "请销售准备车辆座位与接口资料，协助展示后排、后备箱和装载空间，说明未核实的适配信息。",
      feeNote:
        "现场体验是否收费或已含服务费待确认；如需配件、安装或改装，先取得适配结论及单独报价。",
      suggested: family,
    },
    {
      id: "parking-fit",
      title: "体验停车与视野",
      reason: parking
        ? "你更关注停车便利，需结合常用车位核对车身尺寸、视野与泊车辅助。"
        : "如常用车位较窄，可提前核对尺寸并安排正常停车体验。",
      userAction:
        "带上车位长宽或已知限制，在销售陪同下体验正常低速泊车，核对视野和辅助功能是否符合习惯。",
      salesAction:
        "请销售提供尺寸资料，确认泊车配置及工作状态，并协调允许体验的区域；辅助功能不能替代驾驶观察。",
      feeNote:
        "体验是否收费、是否已含服务费待确认；发现故障后的诊断和维修需另行报价。",
      suggested: parking,
    },
  ];

  if (vehicle.energy === "纯电") {
    tasks.push(
      {
        id: "battery-check",
        title: "核验电池与电驱资料",
        reason:
          "现有电池资料仍需核对方法、日期与范围；健康度摘要不能直接推导实际续航或质保权益。",
        userAction:
          "提出续航、充电表现和权益疑问，核对报告与车辆身份；电池及高压系统检测由专业人员操作。",
        salesAction:
          "请销售协调有能力的专业检测方，确认电池和电驱检测范围、报告原件、产权及权益转移条件，先提供书面报价。",
        feeNote: quoteFirst + " 电池专项可能不包含在常规检测中。",
        suggested: true,
      },
      {
        id: "charging-fit",
        title: "核对补能是否适合日常",
        reason:
          !needs || needs.charging === "unsure"
            ? "补能条件尚未明确，先核对常用充电点、接口及可用时段，再判断是否适合日常。"
            : needs.charging === "none"
              ? "你没有固定补能条件，需要先验证可用充电方案，不能仅凭示例续航判断适用。"
              : needs.charging === "public"
                ? "你主要依赖公共充电，需核对常用站点、排队时间与实际费用。"
                : "你有家充条件，仍需核对接口、停车位安装条件和实际充电安排。",
        userAction:
          "整理常用路线与可用充电点，核对充电时间是否符合日程；如需安装家充，先核对现场条件。",
        salesAction:
          "请销售说明随车充电设备、接口及权益范围，协调专业人员确认可用补能方案，并分别说明设备、安装和使用费用。",
        feeNote:
          "充电设备、安装、公共充电及相关服务费用待报价；是否已含服务费或车价需逐项确认。",
        suggested: true,
      },
    );
  }
  return tasks.sort(
    (left, right) => Number(right.suggested) - Number(left.suggested),
  );
}

/** Unknown charges remain null, never silently added as zero to purchase totals. */
export function getAdditionalCosts(vehicle: Vehicle): AdditionalCost[] {
  const costs: AdditionalCost[] = [
    {
      id: "independent-inspection",
      name: "独立检测 / 专项复检",
      trigger: "你要求补查缺项或由独立机构复核车况时。",
      payee: "约定的检测机构",
      amount: null,
      note: "待报价；先确认检测范围、是否已含服务费、报告交付内容及费用承担方。",
    },
    {
      id: "test-drive",
      name: "试驾与现场体验安排",
      trigger: "安排试驾、场地或额外体验服务时，先确认是否收费。",
      payee: "实际提供服务的商家或场地方",
      amount: null,
      note: "是否收费待确认，不能按免费处理；是否已含服务费、押金及退还条件须书面说明。",
    },
    {
      id: "repairs",
      name: "维修整备与复检",
      trigger: "复核发现问题且你同意维修方案时；不默认把整备费用转由买方承担。",
      payee: "约定的维修门店 / 复检机构",
      amount: null,
      note: "待报价；配件、工时和复检分别列明，确认是否已含服务费、交付条件及承担方后再安排。",
    },
    {
      id: "insurance",
      name: "车辆保险",
      trigger: "确认具体投保方案或保险衔接安排时。",
      payee: "约定的保险服务提供方",
      amount: null,
      note: "待报价；按车辆和实际方案确认，不含在当前已列合计内，是否涉及额外服务费也需说明。",
    },
    {
      id: "transport",
      name: "异地运输 / 送车",
      trigger: "你选择异地运输或额外送车服务时。",
      payee: "约定的承运或送车服务方",
      amount: null,
      note: "待报价；确认路线、交接、运输保障、是否已含服务费及承担方，不自动计入当前合计。",
    },
  ];
  if (vehicle.energy === "纯电") {
    costs.push(
      {
        id: "battery-diagnostics",
        name: "电池专项检测",
        trigger: "常规检测未覆盖电池问题，且你同意安排专项诊断时。",
        payee: "有相应能力的专业检测机构",
        amount: null,
        note: "待报价；先确认诊断方法、报告范围及是否已含常规检测或服务费，避免重复收费。",
      },
      {
        id: "charging",
        name: "补能设备与安装 / 使用",
        trigger: "需购买充电设备、安排安装，或使用付费补能服务时。",
        payee: "约定的设备、安装或补能服务方",
        amount: null,
        note: "待报价；现场条件先核实，设备、安装及使用费用分开，是否已含车价或服务费需确认。",
      },
    );
  }
  return costs;
}
