import { identifyListing, validateSourceUrl } from "./sources.mjs";

export const USER_AGENT = "CardisplayBot/0.1";
const BOT_TOKEN = "cardisplaybot";
const DETAIL_LIMIT = 5 * 1024 * 1024;
const ROBOTS_LIMIT = 256 * 1024;
const REDIRECTS = new Set([301, 302, 303, 307, 308]);
const FORMATS = new Set([
  "text/html",
  "application/xhtml+xml",
  "text/plain",
  "text/markdown",
]);

function failure(code, message) {
  const error = new Error(message);
  error.code = code;
  error.isPublicFetchError = true;
  return error;
}

// RFC 9309: paths are case-sensitive; decode unreserved ASCII only. Preserve
// escaped reserved bytes, and compare Unicode using their UTF-8 representation.
function pathBytes(value) {
  return value
    .replace(/[^\x00-\x7F]/gu, (char) => encodeURIComponent(char))
    .replace(/%[0-9a-f]{2}/gi, (encoded) => {
      const char = String.fromCharCode(parseInt(encoded.slice(1), 16));
      return /[A-Za-z0-9._~-]/.test(char) ? char : encoded.toUpperCase();
    });
}

function robotsPolicy(text) {
  const groups = [];
  let current = null;
  let hasRules = false;
  for (const original of text.replace(/^\uFEFF/, "").split(/\r?\n/)) {
    const line = original.split("#", 1)[0].trim();
    const colon = line.indexOf(":");
    if (colon < 0) continue;
    const key = line.slice(0, colon).trim().toLowerCase();
    const value = line.slice(colon + 1).trim();
    if (key === "user-agent") {
      if (!current || hasRules) {
        current = { agents: [], rules: [], delay: 0 };
        groups.push(current);
        hasRules = false;
      }
      current.agents.push(value.toLowerCase());
    } else if (current && (key === "allow" || key === "disallow")) {
      hasRules = true;
      if (value)
        current.rules.push({ allow: key === "allow", path: pathBytes(value) });
    } else if (current && key === "crawl-delay") {
      hasRules = true;
      const seconds = Number(value);
      if (Number.isFinite(seconds) && seconds >= 0)
        current.delay = seconds * 1000;
    }
  }
  const matches = groups.map((group) => ({
    ...group,
    specificity: Math.max(
      -1,
      ...group.agents.map((agent) =>
        agent === "*"
          ? 0
          : agent && BOT_TOKEN.includes(agent)
            ? agent.length
            : -1,
      ),
    ),
  }));
  const max = Math.max(-1, ...matches.map((group) => group.specificity));
  const selected = matches.filter(
    (group) => group.specificity === max && max >= 0,
  );
  return {
    rules: selected.flatMap((group) => group.rules),
    delay: Math.max(0, ...selected.map((group) => group.delay)),
  };
}

function allowedByPolicy(policy, url) {
  const parsed = new URL(url);
  const path = pathBytes(parsed.pathname + parsed.search);
  let winner = null;
  for (const rule of policy.rules) {
    const anchored = rule.path.endsWith("$");
    const pattern = anchored ? rule.path.slice(0, -1) : rule.path;
    if (!matchesPath(pattern, path, anchored)) continue;
    const specificity = Buffer.byteLength(pattern.replaceAll("*", ""));
    if (
      !winner ||
      specificity > winner.specificity ||
      (specificity === winner.specificity && rule.allow)
    ) {
      winner = { allow: rule.allow, specificity };
    }
  }
  return winner?.allow ?? true;
}

// Greedy wildcard matching avoids turning untrusted robots rules into expensive
// regular expressions. Unanchored rules match a path prefix, as RFC 9309 requires.
function matchesPath(pattern, path, anchored) {
  let p = 0;
  let s = 0;
  let star = -1;
  let fallback = 0;
  while (s < path.length) {
    if (p === pattern.length && !anchored) return true;
    if (pattern[p] === "*") {
      star = p++;
      fallback = s;
    } else if (pattern[p] === path[s]) {
      p++;
      s++;
    } else if (star >= 0) {
      p = star + 1;
      s = ++fallback;
    } else return false;
  }
  while (pattern[p] === "*") p++;
  return p === pattern.length;
}

export function robotsAllows(text, url) {
  return allowedByPolicy(robotsPolicy(text), url);
}

async function readBounded(response, maxBytes) {
  const declared = response.headers.get("content-length");
  if (declared && Number(declared) > maxBytes) {
    await response.body?.cancel();
    throw failure("response_too_large", "公开页面超过允许的体积上限");
  }
  if (!response.body) return "";
  const reader = response.body.getReader();
  const chunks = [];
  let total = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > maxBytes) {
        await reader.cancel();
        throw failure("response_too_large", "公开页面超过允许的体积上限");
      }
      chunks.push(Buffer.from(value));
    }
  } finally {
    reader.releaseLock();
  }
  return Buffer.concat(chunks).toString("utf8");
}

export function createPublicFetcher({
  fetchImpl = globalThis.fetch,
  now = Date.now,
  sleepImpl = (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
} = {}) {
  const schedules = new Map();
  async function pace(origin, interval) {
    const state = schedules.get(origin) ?? {
      tail: Promise.resolve(),
      lastStarted: -Infinity,
    };
    schedules.set(origin, state);
    const reservation = state.tail.then(async () => {
      const delay = Math.max(0, state.lastStarted + interval - now());
      if (delay) await sleepImpl(delay);
      state.lastStarted = now();
    });
    state.tail = reservation.catch(() => {});
    await reservation;
  }

  return async function fetchPage({
    platform,
    url,
    timeoutMs = 15000,
    fetchImpl: overrideFetch,
  } = {}) {
    const canonical = validateSourceUrl(platform, url);
    const listingId = identifyListing(platform, canonical);
    if (!Number.isInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 15000) {
      throw failure("invalid_request", "请求超时必须介于 1 至 15000 毫秒");
    }
    const origin = new URL(canonical).origin;
    const robotsUrl = `${origin}/robots.txt`;
    let policy = { rules: [], delay: 0 };

    async function request(initialUrl, isRobots) {
      let target = initialUrl;
      for (let redirects = 0; redirects <= 3; redirects++) {
        if (!isRobots && !allowedByPolicy(policy, target))
          throw failure("robots_denied", "来源 robots.txt 不允许抓取此详情");
        const interval = Math.max(2000, policy.delay);
        if (interval > 60000)
          throw failure(
            "rate_limited",
            "来源要求较长抓取间隔；本次停止，请延后执行",
          );
        await pace(origin, interval);
        const controller = new AbortController();
        let timer;
        try {
          const timeout = new Promise((_, reject) => {
            timer = setTimeout(() => {
              controller.abort();
              reject(
                failure(
                  isRobots ? "robots_unavailable" : "fetch_timeout",
                  "公开页面请求超时，未获取数据",
                ),
              );
            }, timeoutMs);
          });
          const result = await Promise.race([
            (async () => {
              const response = await (overrideFetch ?? fetchImpl)(target, {
                method: "GET",
                redirect: "manual",
                credentials: "omit",
                signal: controller.signal,
                headers: {
                  "User-Agent": USER_AGENT,
                  Accept: isRobots
                    ? "text/plain"
                    : "text/html, text/markdown;q=0.9, text/plain;q=0.8",
                },
              });
              if (response.redirected)
                throw failure(
                  "redirect_rejected",
                  "不允许未经验证的自动重定向",
                );
              if (REDIRECTS.has(response.status)) {
                const location = response.headers.get("location");
                await response.body?.cancel();
                if (!location || redirects >= 3)
                  throw failure(
                    "redirect_rejected",
                    "公开页面重定向无效或次数过多",
                  );
                let next;
                try {
                  next = new URL(location, target);
                  if (
                    next.origin !== origin ||
                    next.username ||
                    next.password ||
                    next.hash
                  )
                    throw new Error();
                  if (isRobots) {
                    if (next.pathname !== "/robots.txt" || next.search)
                      throw new Error();
                  } else {
                    next = new URL(validateSourceUrl(platform, next.href));
                    if (identifyListing(platform, next.href) !== listingId)
                      throw new Error();
                  }
                } catch {
                  throw failure(
                    "redirect_rejected",
                    "公开页面重定向不符合来源白名单",
                  );
                }
                return { redirect: next.href };
              }
              if (isRobots && response.status === 404) {
                await response.body?.cancel();
                return { body: "", contentType: "text/plain", url: target };
              }
              if (!response.ok) {
                await response.body?.cancel();
                const code = isRobots
                  ? "robots_unavailable"
                  : response.status === 429
                    ? "rate_limited"
                    : [401, 403].includes(response.status)
                      ? "access_blocked"
                      : "http_error";
                throw failure(
                  code,
                  isRobots
                    ? "无法读取来源 robots.txt，本次停止"
                    : `来源返回 HTTP ${response.status}，本次停止`,
                );
              }
              const contentType = (response.headers.get("content-type") ?? "")
                .split(";", 1)[0]
                .trim()
                .toLowerCase();
              if (
                isRobots
                  ? contentType !== "text/plain"
                  : !FORMATS.has(contentType)
              ) {
                await response.body?.cancel();
                throw failure(
                  isRobots ? "robots_unavailable" : "unsupported_format",
                  "来源返回非支持的公开文本格式",
                );
              }
              const body = await readBounded(
                response,
                isRobots ? ROBOTS_LIMIT : DETAIL_LIMIT,
              );
              if (isRobots && /<\s*(?:!doctype|html|script|body)\b/i.test(body))
                throw failure(
                  "robots_unavailable",
                  "来源 robots.txt 返回页面内容，本次停止",
                );
              if (isRobots) {
                const meaningful = body
                  .split(/\r?\n/)
                  .map((line) => line.split("#", 1)[0].trim())
                  .filter(Boolean);
                if (
                  meaningful.length &&
                  !meaningful.some((line) =>
                    /^(?:user-agent|sitemap)\s*:/i.test(line),
                  )
                ) {
                  throw failure(
                    "robots_unavailable",
                    "来源 robots.txt 无可识别规则，本次停止",
                  );
                }
              }
              return { body, contentType, url: target };
            })(),
            timeout,
          ]);
          if (result.redirect) {
            target = result.redirect;
            continue;
          }
          return result;
        } catch (error) {
          controller.abort();
          if (error?.isPublicFetchError) throw error;
          throw failure(
            isRobots ? "robots_unavailable" : "network_error",
            isRobots
              ? "无法读取来源 robots.txt，本次停止"
              : "网络请求失败，未获取车辆数据",
          );
        } finally {
          clearTimeout(timer);
        }
      }
      throw failure("redirect_rejected", "公开页面重定向次数过多");
    }

    const robots = await request(robotsUrl, true);
    policy = robotsPolicy(robots.body);
    const result = await request(canonical, false);
    return { ...result, fetchedAt: new Date(now()).toISOString() };
  };
}

export const fetchPublicPage = createPublicFetcher();
