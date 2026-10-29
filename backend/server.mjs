import { createServer } from "node:http";
import { timingSafeEqual } from "node:crypto";
import { pathToFileURL } from "node:url";
import { connectDatabase } from "./database.mjs";
import { getListing, listListings, listJobs } from "./repository.mjs";
import { SOURCES } from "./sources.mjs";

const json = (body, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
function integerParam(search, key, fallback, min, max) {
  const raw = search.get(key);
  if (raw === null) return fallback;
  if (!/^\d+$/.test(raw) || +raw < min || +raw > max)
    throw new TypeError("invalid parameter");
  return +raw;
}
export function createApi(db, { token }) {
  if (
    typeof token !== "string" ||
    token.length < 32 ||
    token.startsWith("replace_")
  )
    throw new Error("请配置至少32字符的独立 API_READ_TOKEN");
  const expected = Buffer.from(`Bearer ${token}`);
  return async (request) => {
    const url = new URL(request.url);
    if (request.method !== "GET")
      return json({ error: "method_not_allowed" }, 405);
    const actual = Buffer.from(request.headers.get("authorization") ?? "");
    if (actual.length !== expected.length || !timingSafeEqual(actual, expected))
      return json({ error: "unauthorized" }, 401);
    try {
      if (url.pathname === "/healthz") {
        await db.query("SELECT 1");
        return json({ status: "ready" });
      }
      if (url.pathname === "/api/sources")
        return json({
          items: Object.entries(SOURCES).map(([id, source]) => ({
            id,
            ...source,
          })),
        });
      if (url.pathname === "/api/listings") {
        const limit = integerParam(url.searchParams, "limit", 20, 1, 100);
        const offset = integerParam(url.searchParams, "offset", 0, 0, 1000000);
        const platform = url.searchParams.get("platform");
        if (platform !== null && !Object.hasOwn(SOURCES, platform))
          return json({ error: "invalid_parameters" }, 400);
        const items = await listListings(db, { limit, offset, platform });
        return json({ items, limit, offset });
      }
      const detail = url.pathname.match(/^\/api\/listings\/([a-f0-9-]+)$/i);
      if (detail) {
        const row = await getListing(db, detail[1]);
        return row ? json(row) : json({ error: "not_found" }, 404);
      }
      if (url.pathname === "/api/jobs")
        return json({
          items: await listJobs(db, {
            limit: integerParam(url.searchParams, "limit", 20, 1, 100),
          }),
        });
      return json({ error: "not_found" }, 404);
    } catch (error) {
      return json(
        {
          error:
            error instanceof TypeError
              ? "invalid_parameters"
              : "service_unavailable",
        },
        error instanceof TypeError ? 400 : 503,
      );
    }
  };
}

async function main() {
  const port = Number(process.env.API_PORT ?? 8787);
  if (!Number.isInteger(port) || port < 1 || port > 65535)
    throw new Error("API_PORT无效");
  const db = connectDatabase();
  let handler;
  try {
    handler = createApi(db, { token: process.env.API_READ_TOKEN });
    await db.query("SELECT 1 FROM schema_migrations LIMIT 1");
  } catch (error) {
    await db.close();
    throw error;
  }
  const server = createServer(async (req, res) => {
    try {
      // Local origin is fixed; Host headers are never used for links or routing.
      const request = new Request(`http://127.0.0.1:${port}${req.url}`, {
        method: req.method,
        headers: req.headers,
      });
      const response = await handler(request);
      res.writeHead(response.status, Object.fromEntries(response.headers));
      res.end(await response.text());
    } catch {
      res.writeHead(400, { "Content-Type": "application/json" });
      res.end('{"error":"bad_request"}');
    }
  });
  server.on("error", async () => {
    console.error("只读API无法启动，请检查本地端口权限或端口占用。");
    await db.close();
    process.exitCode = 1;
  });
  server.listen(port, "127.0.0.1", () =>
    console.log(`只读车源 API：http://127.0.0.1:${port}（需 Bearer token）`),
  );
  const shutdown = () =>
    server.close(async () => {
      await db.close();
    });
  process.once("SIGINT", shutdown);
  process.once("SIGTERM", shutdown);
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href)
  main().catch(() => {
    console.error("启动失败，请检查 DATABASE_URL、API_READ_TOKEN 和迁移状态。");
    process.exitCode = 1;
  });
