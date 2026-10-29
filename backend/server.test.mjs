import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
import { migrate } from "./repository.mjs";
import { importRecord, ingestPublic } from "./ingestion.mjs";
import { createApi } from "./server.mjs";

const token = "test-only-token-at-least-32-characters";
const request = (path, authorized = true, method = "GET") =>
  new Request(`http://localhost${path}`, {
    method,
    headers: authorized ? { authorization: `Bearer ${token}` } : {},
  });

test("真实公开事实的人工录入→SQL存储→鉴权只读API→重复导入", async () => {
  const db = await PGlite.create();
  try {
    await migrate(db);
    const record = JSON.parse(
      await readFile(
        new URL("./examples/autohome-manual.json", import.meta.url),
        "utf8",
      ),
    );
    const result = await importRecord(db, record);
    const api = createApi(db, { token });
    assert.equal((await api(request("/api/listings", false))).status, 401);
    assert.equal(
      (await api(request("/api/listings", true, "POST"))).status,
      405,
    );
    const listing = await (
      await api(request(`/api/listings/${result.listingId}`))
    ).json();
    assert.equal(listing.listing.priceCny, 355400);
    assert.equal(listing.vehicle.mileageKm, 112300);
    assert.equal(listing.listing.transferFeeCny, null);
    assert.equal(listing.source.method, "manual_capture");
    assert.equal(listing.coverage.insurance.status, "requires_authorization");
    assert.deepEqual(listing.insurancePolicies, []);
    const again = await importRecord(db, record);
    assert.equal(again.changed, false);
    assert.equal(
      (await (await api(request("/api/listings?platform=autohome"))).json())
        .items.length,
      1,
    );
    assert.equal(
      (await (await api(request("/api/listings?platform=guazi"))).json()).items
        .length,
      0,
    );
    assert.equal((await api(request("/api/listings?limit=1001"))).status, 400);
    assert.equal(
      (await api(request("/api/listings?platform=other"))).status,
      400,
    );
    assert.equal(
      (await api(request("/api/listings/00000000-0000-0000-0000-000000000000")))
        .status,
      404,
    );
    const jobs = (await (await api(request("/api/jobs"))).json()).items;
    assert.equal(jobs.length, 2);
    assert.ok(jobs.every((j) => j.status === "succeeded"));
    assert.equal((await api(request("/healthz"))).status, 200);
  } finally {
    await db.close();
  }
});
test("抓取失败记录作业，不生成伪车源，日志不泄露原始错误", async () => {
  const db = await PGlite.create();
  try {
    await migrate(db);
    const fetchPage = async () => {
      throw Object.assign(new Error("secret raw response"), {
        code: "access_blocked",
      });
    };
    await assert.rejects(() =>
      ingestPublic(db, {
        platform: "autohome",
        url: "https://wap.che168.com/dealer/559088/59932190.html",
        fetchPage,
      }),
    );
    const api = createApi(db, { token });
    assert.deepEqual(
      (await (await api(request("/api/listings"))).json()).items,
      [],
    );
    const [job] = (await (await api(request("/api/jobs"))).json()).items;
    assert.equal(job.status, "failed");
    assert.equal(job.code, "access_blocked");
    assert.ok(!JSON.stringify(job).includes("secret"));
  } finally {
    await db.close();
  }
});
test("文件导入不能标成实时网络抓取，token示例值不能启动API", async () => {
  const record = JSON.parse(
    await readFile(
      new URL("./examples/autohome-manual.json", import.meta.url),
      "utf8",
    ),
  );
  record.source.method = "public_page";
  await assert.rejects(() => importRecord(null, record), {
    code: "invalid_record",
  });
  assert.throws(() =>
    createApi(null, { token: "replace_with_a_separate_random_read_token" }),
  );
});
test("抓取响应经解析、归一化、作业追踪、SQL快照到API；不混入推荐车辆价格", async () => {
  const db = await PGlite.create();
  try {
    await migrate(db);
    const body = await readFile(
      new URL("./fixtures/guazi-reconstructed.html", import.meta.url),
      "utf8",
    );
    const url = "https://www.guazi.com/car-detail/c164433896123047.html";
    const fetchPage = async () => ({
      url,
      body,
      contentType: "text/html",
      fetchedAt: new Date().toISOString(),
    });
    const result = await ingestPublic(db, {
      platform: "guazi",
      url,
      fetchPage,
    });
    const api = createApi(db, { token });
    const row = await (
      await api(request(`/api/listings/${result.listingId}`))
    ).json();
    assert.equal(row.listing.priceCny, 373700);
    assert.equal(row.listing.status, "delisted");
    assert.equal(row.vehicle.mileageKm, 100);
    assert.equal(row.source.method, "public_page");
    assert.deepEqual(row.insurancePolicies, []);
    assert.equal(
      (await (await api(request("/api/jobs"))).json()).items[0].status,
      "succeeded",
    );
  } finally {
    await db.close();
  }
});
