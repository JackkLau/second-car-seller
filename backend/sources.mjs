/** Public detail-page entry points only. These are not private API adapters. */
export const SOURCES = Object.freeze({
  dongchedi: Object.freeze({
    name: "懂车帝",
    host: "www.dongchedi.com",
    parser: "identity-bound JSON-LD only",
    verification: "尚未取得可验证的真实详情正文；动态页返回 parse_missing",
    history: "需经授权的结构化资料导入；未接通平台历史记录 API",
  }),
  yiche: Object.freeze({
    name: "易车 / 淘车车",
    host: "beta.m.taocheche.com",
    parser: "identity-bound JSON-LD only",
    verification: "易车关联入口已核查；详情为动态页，尚未验证真实抓取",
    history: "车型库开放接口不等于二手车库存或历史记录接口",
  }),
  guazi: Object.freeze({
    name: "瓜子二手车",
    host: "www.guazi.com",
    parser: "scoped visible detail sections or identity-bound JSON-LD",
    verification: "公开页面事实已阅读；原始 HTML 及 .md 抓取尚未完成实网验证",
    history: "公开估算、原厂质保及平台通用承诺不构成检测或保险维保记录",
  }),
  autohome: Object.freeze({
    name: "汽车之家 / 二手车之家",
    host: "wap.che168.com",
    parser: "scoped visible detail sections or identity-bound JSON-LD",
    verification: "公开页面事实已阅读；原始 HTML 抓取尚未完成实网验证",
    history: "保障说明与报告查询入口不构成本车已获得的历史记录",
  }),
});

function invalidUrl() {
  const error = new Error(
    "仅接受已登记平台的 HTTPS 车辆详情 URL；不接受额外参数或身份凭据",
  );
  error.code = "invalid_source_url";
  return error;
}

export function validateSourceUrl(platform, input) {
  if (
    !Object.hasOwn(SOURCES, platform) ||
    typeof input !== "string" ||
    input.length > 2048
  )
    throw invalidUrl();
  // Reject transformations that would conceal the originally submitted path.
  if (/\s|\\|%|(?:^|\/)\.{1,2}(?:\/|$)/u.test(input)) throw invalidUrl();
  let url;
  try {
    url = new URL(input);
  } catch {
    throw invalidUrl();
  }
  if (
    url.protocol !== "https:" ||
    url.hostname !== SOURCES[platform].host ||
    url.username ||
    url.password ||
    url.hash ||
    url.port ||
    input.includes("#")
  )
    throw invalidUrl();
  const patterns = {
    guazi: /^\/car-detail\/c[0-9]{1,30}\.(?:html|md)$/,
    autohome: /^\/dealer\/[0-9]{1,20}\/[0-9]{1,30}\.html$/,
    dongchedi: /^\/usedcar\/[0-9]{1,30}$/,
    yiche: /^\/apps\/detail\/index\.html$/,
  };
  if (!patterns[platform].test(url.pathname)) throw invalidUrl();
  if (platform === "yiche") {
    if (!/^\?ucarId=[0-9]{1,30}$/.test(url.search)) throw invalidUrl();
  } else if (url.search || input.includes("?")) throw invalidUrl();
  return url.href;
}

export function identifyListing(platform, input) {
  const url = new URL(validateSourceUrl(platform, input));
  if (platform === "yiche") return url.searchParams.get("ucarId");
  const leaf = url.pathname.split("/").at(-1);
  return leaf.replace(/\.(?:html|md)$/, "");
}
