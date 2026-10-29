import { parse as parseHtml } from "parse5";
import { identifyListing, validateSourceUrl } from "./sources.mjs";

function failure(code, message) {
  return Object.assign(new Error(message), { code });
}
const missing = () =>
  failure(
    "parse_missing",
    "未找到与本车身份匹配的明确车辆字段；页面可能动态加载或结构已变化",
  );
const compact = (value) => value.replace(/\s+/g, " ").trim();
const tight = (value) => value.replace(/\s+/g, "");
const str = (value) =>
  typeof value === "string" && compact(value)
    ? compact(value).slice(0, 300)
    : null;
const integer = (value) =>
  value !== null &&
  value !== "" &&
  /^(?:0|[1-9]\d*)(?:\.0+)?$/.test(String(value)) &&
  Number.isSafeInteger(Number(value))
    ? Number(value)
    : null;
function decimalMoney(value, scale = 2) {
  if (typeof value !== "string" && typeof value !== "number") return null;
  const text = String(value);
  if (!new RegExp(`^(?:0|[1-9]\\d*)(?:\\.\\d{1,${scale}})?$`).test(text))
    return null;
  const [whole, fraction = ""] = text.split(".");
  const scaled =
    BigInt(whole) * 10n ** BigInt(scale) + BigInt(fraction.padEnd(scale, "0"));
  if (scaled > BigInt(Number.MAX_SAFE_INTEGER)) return null;
  // For 万元, six fractional digits represent cents. Do not round the source.
  return Number(scaled) / 100;
}
const cny = (value) => decimalMoney(value, 2);
const wan = (value) => decimalMoney(value, 6);
const year = (value) =>
  Number(value?.match(/\b(19\d{2}|20\d{2})款/)?.[1]) || null;
const month = (value) =>
  /^(?:19|20)\d{2}-(?:0[1-9]|1[0-2])(?:-\d{2})?$/.test(value ?? "")
    ? value.slice(0, 7)
    : null;

function blankRecord(platform, url, fetchedAt) {
  return {
    schemaVersion: 1,
    source: {
      platform,
      externalId: identifyListing(platform, url),
      url,
      fetchedAt,
      method: "public_page",
      authorizationReference: null,
    },
    vehicle: {
      title: "",
      brand: null,
      model: null,
      trim: null,
      modelYear: null,
      registrationMonth: null,
      mileageKm: null,
      energy: null,
      transmission: null,
      seats: null,
      color: null,
      city: null,
    },
    listing: {
      priceCny: null,
      serviceFeeCny: null,
      transferFeeCny: null,
      transferCount: null,
      status: "unknown",
    },
    coverage: {
      inspection: {
        status: "not_disclosed",
        note: "本次公开页面提取未取得本车逐项检测报告；不代表检查通过",
      },
      insurance: {
        status: "requires_authorization",
        note: "未取得本车保单；费用估算和原厂质保不是保险记录，需授权资料",
      },
      claims: {
        status: "requires_authorization",
        note: "未取得本车出险记录；未知不代表没有出险，需授权资料",
      },
      maintenance: {
        status: "requires_authorization",
        note: "未取得本车维保事件；报告查询入口不等于已取得记录，需授权资料",
      },
    },
    inspections: [],
    insurancePolicies: [],
    insuranceClaims: [],
    maintenanceEvents: [],
  };
}

const blocks = new Set([
  "address",
  "article",
  "aside",
  "blockquote",
  "br",
  "button",
  "dd",
  "div",
  "dl",
  "dt",
  "footer",
  "header",
  "hr",
  "li",
  "main",
  "nav",
  "ol",
  "p",
  "section",
  "table",
  "td",
  "th",
  "tr",
  "ul",
]);
function htmlDocument(body) {
  const tree = parseHtml(body);
  const document = { text: "", headings: [], json: [], title: "" };
  const rawText = (node) =>
    node.nodeName === "#text"
      ? node.value
      : (node.childNodes ?? []).map(rawText).join("");
  function walk(node) {
    const tag = node.tagName;
    if (tag === "title") {
      document.title = rawText(node);
      return;
    }
    if (tag === "script") {
      if (
        node.attrs?.some(
          (attr) =>
            attr.name === "type" &&
            attr.value.toLowerCase() === "application/ld+json",
        )
      ) {
        try {
          document.json.push(JSON.parse(rawText(node)));
        } catch {
          /* Invalid structured data cannot establish identity. */
        }
      }
      return;
    }
    if (["style", "template", "noscript", "svg"].includes(tag)) return;
    if (
      node.attrs?.some(
        (attr) =>
          attr.name === "hidden" ||
          (attr.name === "aria-hidden" && attr.value === "true"),
      )
    )
      return;
    const heading = /^h[1-6]$/.test(tag ?? "");
    if (blocks.has(tag) || heading) document.text += "\n";
    const start = document.text.length;
    // Preserve token boundaries between sibling spans (e.g. condition score 99
    // beside 100公里); concatenating them would invent a 99,100 km odometer.
    if (node.nodeName === "#text")
      document.text += ` ${node.value.replace(/\s+/g, " ")} `;
    for (const child of node.childNodes ?? []) walk(child);
    if (heading)
      document.headings.push({
        level: Number(tag[1]),
        text: compact(document.text.slice(start)),
        start,
        end: document.text.length,
      });
    if (blocks.has(tag) || heading) document.text += "\n";
  }
  walk(tree);
  return document;
}

function markdownDocument(body) {
  // Only explicit headings are recognized. No private script state or API is evaluated.
  const document = { text: body, headings: [], json: [], title: "" };
  for (const match of body.matchAll(/^(#{1,6})\s+([^\n]+)$/gm)) {
    document.headings.push({
      level: match[1].length,
      text: compact(match[2]),
      start: match.index,
      end: match.index + match[0].length,
    });
  }
  return document;
}

function uniqueHeading(document, label) {
  const matches = document.headings.filter((heading) => heading.text === label);
  return matches.length === 1 ? matches[0] : null;
}
function section(document, heading) {
  const next = document.headings.find(
    (item) => item.start > heading.start && item.level <= heading.level,
  );
  return document.text.slice(heading.end, next?.start).trim();
}
const fieldLabels = new Set([
  "档案手续",
  "排放标准",
  "车源地",
  "车身颜色",
  "车源编号",
  "功能配置",
  "三电质保",
  "电池容量",
  "电池类型",
  "综合续航",
  "快充",
  "电池品牌",
  "驱动电机",
  "质保信息",
  "整车质保",
  "首次上牌",
  "亮点配置",
  "安全配置",
  "全部参数",
  "厂商",
  "生产方式",
  "上市时间",
  "能源形式",
  "发动机",
  "变速箱",
  "查看完整参数配置",
  "表显里程",
  "查询准迁地",
  "CLTC纯电续航里程",
  "过户次数",
  "所在地",
  "上架时间",
  "看车地点",
  "标准容量",
  "标准快充",
  "更多参数配置",
]);
function adjacentValue(text, label, direction) {
  const lines = text.split("\n").map(compact).filter(Boolean);
  const matches = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line === label) matches.push(lines[i + direction] ?? null);
    else if (direction === 1 && line.startsWith(label))
      matches.push(line.slice(label.length).trim());
    else if (direction === -1 && line.endsWith(label))
      matches.push(line.slice(0, -label.length).trim());
  }
  if (matches.length !== 1 || !matches[0]) return null;
  const value = matches[0];
  // A missing value must stop at the immediately adjacent field label. Never
  // scan forward/backward past it to obtain another field's label or value.
  if (
    [...fieldLabels].some(
      (token) => value === token || (token !== label && value.includes(token)),
    )
  )
    return null;
  if (/^(?:[-—–/]+|暂无|未知|未披露|未提供|待确认)$/.test(value)) return null;
  return value;
}
const afterLabel = (text, label) => adjacentValue(text, label, 1);
const beforeLabel = (text, label) => adjacentValue(text, label, -1);
function kilometers(value) {
  const match = value?.match(/^(\d+(?:\.\d+)?)\s*(万)?公里/);
  return match ? Math.round(Number(match[1]) * (match[2] ? 10000 : 1)) : null;
}

function parseGuazi(document, record) {
  const mainHeadings = document.headings.filter(
    (item) => item.level === 1 && year(item.text),
  );
  const details = uniqueHeading(document, "车况详解");
  if (mainHeadings.length !== 1 || !details) return null;
  const main = mainHeadings[0];
  const detailText = section(document, details);
  if (!tight(detailText).includes(tight(main.text))) return null;
  const priceArea = section(document, main).slice(0, 300);
  const priceMatch = priceArea.match(/^(\d+(?:\.\d{1,6})?)\s*万(?:\s|$)/);
  if (!priceMatch) return null;
  record.vehicle.title = main.text;
  record.vehicle.modelYear = year(main.text);
  record.listing.priceCny = wan(priceMatch[1]);
  record.listing.status = /已下架|已售出/.test(priceArea)
    ? "delisted"
    : "unknown";
  const condition = detailText.split("档案手续")[0];
  const mileage = condition.match(/(\d+(?:\.\d+)?\s*(?:万)?公里)/)?.[1];
  record.vehicle.mileageKm = kilometers(mileage);
  record.listing.transferCount = integer(
    condition.match(/过户\s*(\d+)次/)?.[1],
  );
  record.vehicle.registrationMonth = month(afterLabel(detailText, "首次上牌"));
  record.vehicle.city = str(beforeLabel(detailText, "车源地"));
  record.vehicle.color = str(beforeLabel(detailText, "车身颜色"));
  record.vehicle.energy = str(afterLabel(detailText, "能源形式"));
  record.vehicle.transmission = str(afterLabel(detailText, "变速箱"));
  return record;
}

function parseAutohome(document, record) {
  const archive = uniqueHeading(document, "车辆档案");
  if (!archive) return null;
  const prior = document.headings.filter(
    (item) => item.start < archive.start && year(item.text),
  );
  if (prior.length !== 1) return null;
  const main = prior[0];
  if (!tight(document.title).includes(tight(main.text))) return null;
  const priceArea = document.text.slice(main.end, archive.start);
  const priceMatch = priceArea.match(
    /(?:^|\n)\s*(\d+(?:\.\d{1,6})?)\s*万\s*厂商指导价/,
  );
  if (!priceMatch) return null;
  const detailText = section(document, archive);
  record.vehicle.title = main.text;
  record.vehicle.modelYear = year(main.text);
  record.listing.priceCny = wan(priceMatch[1]);
  record.vehicle.registrationMonth = month(afterLabel(detailText, "首次上牌"));
  record.vehicle.mileageKm = kilometers(afterLabel(detailText, "表显里程"));
  record.vehicle.transmission = str(afterLabel(detailText, "变速箱"));
  record.vehicle.city = str(afterLabel(detailText, "所在地"));
  record.listing.transferCount = integer(
    afterLabel(detailText, "过户次数")?.match(/^(\d+)次/)?.[1],
  );
  record.listing.status = /已下架|已售出/.test(priceArea)
    ? "delisted"
    : "unknown";
  return record;
}

function sameListing(candidate, platform, url) {
  if (typeof candidate !== "string") return false;
  try {
    const parsed = new URL(candidate, url);
    parsed.hash = "";
    return (
      identifyListing(platform, parsed.href) === identifyListing(platform, url)
    );
  } catch {
    return false;
  }
}
function jsonCandidates(data, output = []) {
  if (Array.isArray(data))
    for (const item of data) jsonCandidates(item, output);
  else if (data && typeof data === "object") {
    const types = [data["@type"]]
      .flat()
      .map((type) =>
        typeof type === "string"
          ? type.replace(/^https?:\/\/schema\.org\//, "")
          : "",
      );
    const vehicleType = types.some((type) => ["Vehicle", "Car"].includes(type));
    const vehicleProduct =
      types.includes("Product") &&
      [
        "mileageFromOdometer",
        "dateVehicleFirstRegistered",
        "vehicleModelDate",
      ].some((key) => Object.hasOwn(data, key));
    if (vehicleType || vehicleProduct) output.push(data);
    for (const key of ["@graph", "mainEntity", "itemListElement", "item"])
      if (data[key]) jsonCandidates(data[key], output);
  }
  return output;
}
function parseStructured(document, record) {
  const { platform, url } = record.source;
  const candidates = document.json
    .flatMap((data) => jsonCandidates(data))
    .filter(
      (data) =>
        [
          data.url,
          data["@id"],
          typeof data.mainEntityOfPage === "string"
            ? data.mainEntityOfPage
            : data.mainEntityOfPage?.["@id"],
        ].some((value) => sameListing(value, platform, url)) && str(data.name),
    );
  const distinct = [
    ...new Map(candidates.map((data) => [JSON.stringify(data), data])).values(),
  ];
  if (distinct.length !== 1) return null;
  const data = distinct[0];
  record.vehicle.title = str(data.name);
  record.vehicle.brand = str(
    typeof data.brand === "string" ? data.brand : data.brand?.name,
  );
  record.vehicle.model = str(
    typeof data.model === "string" ? data.model : data.model?.name,
  );
  record.vehicle.modelYear = /^\d{4}/.test(String(data.vehicleModelDate ?? ""))
    ? Number(String(data.vehicleModelDate).slice(0, 4))
    : null;
  record.vehicle.registrationMonth = month(data.dateVehicleFirstRegistered);
  record.vehicle.energy = str(data.fuelType);
  record.vehicle.transmission = str(data.vehicleTransmission);
  record.vehicle.color = str(data.color);
  record.vehicle.seats = integer(
    data.vehicleSeatingCapacity ?? data.seatingCapacity,
  );
  const distance = data.mileageFromOdometer;
  if (
    distance &&
    (distance.unitCode === "KMT" ||
      /^(km|公里)$/i.test(distance.unitText ?? ""))
  )
    record.vehicle.mileageKm = integer(distance.value);
  const offers = [data.offers].flat().filter(Boolean);
  if (
    offers.length === 1 &&
    (!offers[0].url || sameListing(offers[0].url, platform, url))
  ) {
    const offer = offers[0];
    if (
      offer.priceCurrency === "CNY" &&
      !["LeaseOut", "Rent"].some((value) =>
        String(offer.businessFunction).includes(value),
      )
    )
      record.listing.priceCny = cny(offer.price);
    if (/^https?:\/\/schema\.org\/InStock$/.test(offer.availability ?? ""))
      record.listing.status = "listed";
    if (
      /^https?:\/\/schema\.org\/(OutOfStock|SoldOut|Discontinued)$/.test(
        offer.availability ?? "",
      )
    )
      record.listing.status = "delisted";
  }
  return record;
}

export function parsePublicPage({
  platform,
  url,
  body,
  contentType = "",
  fetchedAt,
}) {
  const canonicalUrl = validateSourceUrl(platform, url);
  if (typeof body !== "string" || !body.trim()) throw missing();
  const mime = contentType.split(";")[0].trim().toLowerCase();
  const isHtml = ["text/html", "application/xhtml+xml"].includes(mime);
  const isMarkdown =
    platform === "guazi" &&
    canonicalUrl.endsWith(".md") &&
    ["text/plain", "text/markdown"].includes(mime);
  if (!isHtml && !isMarkdown)
    throw failure(
      "unsupported_format",
      "仅支持 HTML 或明确的瓜子 Markdown 详情；不执行页面脚本",
    );
  const document = isHtml ? htmlDocument(body) : markdownDocument(body);
  const challenge =
    /安全验证|访问验证|滑动验证|请完成验证|访问过于频繁|access denied|just a moment/i;
  if (
    challenge.test(document.title) ||
    document.headings.some(
      (item) => item.level === 1 && challenge.test(item.text),
    )
  )
    throw failure("access_blocked", "页面要求访问验证；已停止解析");
  const record = blankRecord(platform, canonicalUrl, fetchedAt);
  const parsed =
    platform === "guazi"
      ? parseGuazi(document, record)
      : platform === "autohome"
        ? parseAutohome(document, record)
        : null;
  if (parsed) return parsed;
  const structured = parseStructured(
    document,
    blankRecord(platform, canonicalUrl, fetchedAt),
  );
  if (structured) return structured;
  throw missing();
}
