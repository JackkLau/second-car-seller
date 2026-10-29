import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { SOURCES, validateSourceUrl, identifyListing } from "./sources.mjs";
import { parsePublicPage } from "./parsers.mjs";
import { normalizeRecord } from "./normalize.mjs";

const urls = {
  guazi: "https://www.guazi.com/car-detail/c164433896123047.html",
  autohome: "https://wap.che168.com/dealer/559088/59932190.html",
  dongchedi: "https://www.dongchedi.com/usedcar/357014057",
  yiche: "https://beta.m.taocheche.com/apps/detail/index.html?ucarId=378056784",
};
const fetchedAt = "2026-10-30T00:00:00Z";
const fixture = (name) =>
  readFile(
    new URL(`./fixtures/${name}-reconstructed.html`, import.meta.url),
    "utf8",
  );
const parse = (platform, body, extra = {}) =>
  parsePublicPage({
    platform,
    url: urls[platform],
    body,
    fetchedAt,
    contentType: "text/html; charset=utf-8",
    ...extra,
  });
const jsonPage = (data) =>
  `<html><script type="application/ld+json">${JSON.stringify(data)}</script></html>`;

test("source allowlist accepts only recognized HTTPS detail URLs and extracts stable platform IDs", () => {
  assert.deepEqual(Object.keys(SOURCES).sort(), [
    "autohome",
    "dongchedi",
    "guazi",
    "yiche",
  ]);
  for (const [platform, url] of Object.entries(urls))
    assert.equal(validateSourceUrl(platform, url), url);
  assert.equal(identifyListing("guazi", urls.guazi), "c164433896123047");
  assert.equal(identifyListing("autohome", urls.autohome), "59932190");
  assert.equal(identifyListing("dongchedi", urls.dongchedi), "357014057");
  assert.equal(identifyListing("yiche", urls.yiche), "378056784");
  assert.equal(
    identifyListing("guazi", urls.guazi.replace(".html", ".md")),
    "c164433896123047",
  );
});

test("rejects credentials, deceptive hosts, ports, unexpected paths and query parameters", () => {
  for (const url of [
    urls.guazi.replace("https:", "http:"),
    urls.guazi.replace("www.guazi.com", "www.guazi.com.attacker.test"),
    urls.guazi.replace("www.guazi.com", "a:b@www.guazi.com"),
    `${urls.guazi}#fragment`,
    `${urls.guazi}?token=x`,
    urls.guazi.replace(".com/", ".com:8443/"),
    "https://127.0.0.1/car-detail/c1.html",
    "https://www.guazi.com/robots.txt",
    "https://www.guazi.com/x/../car-detail/c1.html",
  ])
    assert.throws(() => validateSourceUrl("guazi", url), {
      code: "invalid_source_url",
    });
  assert.throws(() => validateSourceUrl("unknown", urls.guazi), {
    code: "invalid_source_url",
  });
  assert.throws(() => validateSourceUrl("yiche", `${urls.yiche}&ucarId=2`), {
    code: "invalid_source_url",
  });
  assert.throws(
    () => validateSourceUrl("yiche", `${urls.yiche}&token=secret`),
    { code: "invalid_source_url" },
  );
});

test("Guazi keeps main-vehicle price and delisting; estimates and nearby cars never become history", async () => {
  const data = parse("guazi", await fixture("guazi"));
  assert.equal(data.vehicle.title, "理想汽车 理想L9 2025款 Ultra 智能焕新版");
  assert.equal(data.listing.priceCny, 373700);
  assert.equal(data.listing.status, "delisted");
  assert.equal(data.listing.transferCount, 0);
  assert.equal(data.vehicle.mileageKm, 100);
  assert.equal(data.vehicle.city, "成都");
  assert.equal(data.vehicle.registrationMonth, "2026-03");
  assert.equal(data.vehicle.color, "黑色");
  assert.equal(data.vehicle.energy, "增程式");
  assert.equal(data.vehicle.modelYear, 2025);
  assert.equal(data.listing.serviceFeeCny, null);
  assert.equal(data.listing.transferFeeCny, null);
  assert.deepEqual(data.inspections, []);
  assert.deepEqual(data.insurancePolicies, []);
  assert.deepEqual(data.insuranceClaims, []);
  assert.deepEqual(data.maintenanceEvents, []);
  assert.equal(data.coverage.inspection.status, "not_disclosed");
});

test("Autohome separates sale price from down payment; ignores generic guarantee/history templates", async () => {
  const data = parse("autohome", await fixture("autohome"));
  assert.equal(data.vehicle.title, "极氪009 2022款 改款 WE版");
  assert.equal(data.listing.priceCny, 355400);
  assert.equal(data.vehicle.mileageKm, 112300);
  assert.equal(data.vehicle.registrationMonth, "2023-11");
  assert.equal(data.vehicle.city, "杭州");
  assert.equal(data.listing.transferCount, 0);
  assert.equal(data.listing.status, "unknown");
  assert.equal(data.listing.transferFeeCny, null);
  assert.equal(data.vehicle.energy, null);
  assert.deepEqual(data.inspections, []);
  assert.deepEqual(data.insurancePolicies, []);
  assert.deepEqual(data.maintenanceEvents, []);
});

test("incomplete main-vehicle boundaries fail closed instead of reading recommendations", async () => {
  const html = await fixture("guazi");
  assert.throws(() => parse("guazi", html.replace(/<h1>.*?<\/h1>/, "")), {
    code: "parse_missing",
  });
  assert.throws(
    () => parse("guazi", html.replace("车况详解</h2>", "项目改版</h2>")),
    { code: "parse_missing" },
  );
  assert.throws(
    () =>
      parse(
        "guazi",
        html.replace("<span>37.37</span><span>万</span>", "价格待询"),
      ),
    { code: "parse_missing" },
  );
});

test("dynamic page shells, denied pages and unsupported payloads never produce invented vehicles", () => {
  assert.throws(
    () =>
      parse(
        "dongchedi",
        '<html><div id="app"></div><script>window.foo={price:100}</script></html>',
      ),
    { code: "parse_missing" },
  );
  assert.throws(
    () =>
      parse("yiche", "<html><title>安全验证</title><p>请完成验证</p></html>"),
    { code: "access_blocked" },
  );
  assert.throws(() => parse("guazi", "图片", { contentType: "image/png" }), {
    code: "unsupported_format",
  });
});

test("standard JSON-LD must bind vehicle identity to the requested detail URL", () => {
  const other = {
    "@type": "Vehicle",
    url: urls.dongchedi.replace("357014057", "999"),
    name: "推荐车型",
    offers: { "@type": "Offer", price: "10000", priceCurrency: "CNY" },
  };
  const own = {
    "@type": "Car",
    url: urls.dongchedi,
    name: "测试车型",
    brand: { name: "测试品牌" },
    dateVehicleFirstRegistered: "2022-05-12",
    mileageFromOdometer: { value: 42000, unitCode: "KMT" },
    offers: {
      "@type": "Offer",
      price: "85000",
      priceCurrency: "CNY",
      availability: "https://schema.org/InStock",
    },
  };
  const data = parse("dongchedi", jsonPage({ "@graph": [other, own] }));
  assert.equal(data.vehicle.title, "测试车型");
  assert.equal(data.vehicle.mileageKm, 42000);
  assert.equal(data.vehicle.registrationMonth, "2022-05");
  assert.equal(data.listing.priceCny, 85000);
  assert.equal(data.listing.status, "listed");
  assert.throws(() => parse("dongchedi", jsonPage(other)), {
    code: "parse_missing",
  });
});

test("JSON-LD currency, mileage units and conflicting duplicate main records stay conservative", () => {
  const own = {
    "@type": "Product",
    url: urls.yiche,
    name: "测试车型",
    mileageFromOdometer: { value: 100, unitCode: "SMI" },
    offers: { "@type": "Offer", price: "1000", priceCurrency: "USD" },
  };
  const data = parse("yiche", jsonPage(own));
  assert.equal(data.listing.priceCny, null);
  assert.equal(data.vehicle.mileageKm, null);
  assert.throws(
    () => parse("yiche", jsonPage([own, { ...own, name: "另一辆车" }])),
    { code: "parse_missing" },
  );
});

test("adjacent inline condition numbers retain token boundaries and outputs pass the shared contract", async () => {
  const html = (await fixture("guazi")).replace(
    "成色 99 100公里",
    "<span>成色</span><span>99</span><span>100公里</span>",
  );
  assert.equal(normalizeRecord(parse("guazi", html)).vehicle.mileageKm, 100);
  assert.equal(
    normalizeRecord(parse("autohome", await fixture("autohome"))).listing
      .priceCny,
    355400,
  );
});

test("a product without vehicle fields is not mistaken for a vehicle even when its URL matches", () => {
  assert.throws(
    () =>
      parse(
        "dongchedi",
        jsonPage({
          "@type": "Product",
          name: "报告服务",
          url: urls.dongchedi,
          offers: { price: 500, priceCurrency: "CNY" },
        }),
      ),
    { code: "parse_missing" },
  );
});

test("missing visible field values remain null instead of consuming neighboring labels", async () => {
  const guazi = await fixture("guazi");
  for (const [field, value] of [
    ["city", "成都"],
    ["color", "黑色"],
    ["energy", "增程式"],
    ["transmission", "电动车单速变速箱"],
  ]) {
    const withoutValue = guazi.replace(`<div>${value}</div>`, "<div></div>");
    assert.equal(
      parse("guazi", withoutValue).vehicle[field],
      null,
      `Guazi ${field}`,
    );
  }
  const autohome = await fixture("autohome");
  for (const [field, value] of [
    ["city", "杭州"],
    ["transmission", "自动"],
  ]) {
    const withoutValue = autohome.replace(`<p>${value}</p>`, "<p></p>");
    assert.equal(
      parse("autohome", withoutValue).vehicle[field],
      null,
      `Autohome ${field}`,
    );
  }
});

test("JSON-LD CNY amounts preserve cents while fractional odometers and seats stay unknown", () => {
  const own = {
    "@type": "Car",
    url: urls.dongchedi,
    name: "测试车型",
    mileageFromOdometer: { value: 42000.5, unitCode: "KMT" },
    vehicleSeatingCapacity: 4.5,
    offers: { "@type": "Offer", price: "85000.29", priceCurrency: "CNY" },
  };
  const data = parse("dongchedi", jsonPage(own));
  assert.equal(data.listing.priceCny, 85000.29);
  assert.equal(data.vehicle.mileageKm, null);
  assert.equal(data.vehicle.seats, null);
  assert.equal(
    parse(
      "dongchedi",
      jsonPage({ ...own, offers: { ...own.offers, price: 10.01 } }),
    ).listing.priceCny,
    10.01,
  );
  assert.equal(
    parse(
      "dongchedi",
      jsonPage({ ...own, offers: { ...own.offers, price: "10.001" } }),
    ).listing.priceCny,
    null,
  );
});
