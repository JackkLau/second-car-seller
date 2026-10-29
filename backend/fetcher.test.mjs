import assert from "node:assert/strict";
import test from "node:test";
import { createPublicFetcher, robotsAllows } from "./fetcher.mjs";

const url = "https://www.guazi.com/car-detail/c164433896123047.html";
const html = "<html><h1>车辆详情</h1></html>";
const response = (body, status = 200, type = "text/plain", extra = {}) =>
  new Response(body, { status, headers: { "content-type": type, ...extra } });
function harness(responses, options = {}) {
  const calls = [];
  const delays = [];
  let now = Date.parse("2026-10-30T00:00:00Z");
  const fetcher = createPublicFetcher({
    fetchImpl: async (target, init) => {
      calls.push({ target, init });
      const value = responses.shift();
      if (typeof value === "function") return value(target, init);
      if (value instanceof Error) throw value;
      return value;
    },
    now: () => now,
    sleepImpl: async (ms) => {
      delays.push(ms);
      now += ms;
    },
    ...options,
  });
  return { fetcher, calls, delays };
}

test("robots uses longest match, wildcard query, end anchors and Allow on ties", () => {
  const robots =
    "User-agent: *\nAllow: /\nDisallow: /*?*\nDisallow: /car-detail/\nAllow: /car-detail/*.html$";
  assert.equal(robotsAllows(robots, url), true);
  assert.equal(robotsAllows(robots, `${url}?tracking=1`), false);
  assert.equal(
    robotsAllows(
      "User-agent: *\nDisallow: /a\nAllow: /a",
      "https://a.test/abc",
    ),
    true,
  );
  assert.equal(robotsAllows("User-agent: *\nDisallow:", url), true);
});

test("robots uses most-specific case-insensitive agent and combines matching groups", () => {
  const rules =
    "User-agent: *\nDisallow: /\n\nUser-agent: cardisplaybot\nAllow: /car-detail/\n\nUser-agent: CARDISPLAYBOT\nDisallow: /car-detail/private";
  assert.equal(robotsAllows(rules, url), true);
  assert.equal(
    robotsAllows(rules, "https://www.guazi.com/car-detail/private"),
    false,
  );
  assert.equal(robotsAllows("User-agent: AnotherBot\nDisallow: /", url), true);
});

test("robots compares escaped paths consistently without treating regex syntax as a pattern", () => {
  assert.equal(
    robotsAllows(
      "User-agent: *\nDisallow: /%62locked",
      "https://example.test/blocked",
    ),
    false,
  );
  assert.equal(
    robotsAllows("User-agent: *\nDisallow: /a.b", "https://example.test/axb"),
    true,
  );
  assert.equal(
    robotsAllows(
      "User-agent: *\nDisallow: /车辆",
      "https://example.test/%E8%BD%A6%E8%BE%86",
    ),
    false,
  );
  assert.equal(
    robotsAllows(
      "User-agent: *\nDisallow: /a*b*c$",
      "https://example.test/a-b-c/more",
    ),
    true,
  );
  assert.equal(
    robotsAllows(
      "User-agent: *\nDisallow: /a*b*c",
      "https://example.test/a-b-c/more",
    ),
    false,
  );
});

test("successful fetch checks robots, identifies bot honestly and enforces spacing", async () => {
  const h = harness([
    response("User-agent: *\nAllow: /"),
    response(html, 200, "text/html; charset=utf-8"),
  ]);
  const result = await h.fetcher({ platform: "guazi", url });
  assert.equal(result.body, html);
  assert.equal(result.url, url);
  assert.equal(result.contentType, "text/html");
  assert.equal(result.fetchedAt, "2026-10-30T00:00:02.000Z");
  assert.deepEqual(h.delays, [2000]);
  assert.equal(h.calls[0].target, "https://www.guazi.com/robots.txt");
  assert.equal(h.calls[1].init.headers["User-Agent"], "CardisplayBot/0.1");
  assert.equal(h.calls[1].init.redirect, "manual");
  assert.equal(h.calls[1].init.credentials, "omit");
});

test("invalid source URL is rejected before any request", async () => {
  const h = harness([]);
  await assert.rejects(
    h.fetcher({
      platform: "guazi",
      url: "https://localhost/car-detail/c1.html",
    }),
  );
  assert.equal(h.calls.length, 0);
});

test("robots denial prevents detail request; unavailable robots fail closed", async () => {
  for (const blocked of [
    response("User-agent: *\nDisallow: /car-detail/"),
    response("Unavailable", 503),
    new Error("secret-token"),
  ]) {
    const h = harness([blocked]);
    await assert.rejects(h.fetcher({ platform: "guazi", url }), (error) => {
      assert.ok(["robots_denied", "robots_unavailable"].includes(error.code));
      assert.ok(!error.message.includes("secret-token"));
      return true;
    });
    assert.equal(h.calls.length, 1);
  }
});

test("a definite 404 robots file permits a public detail, HTML robots fails closed", async () => {
  const missing = harness([
    response("not found", 404),
    response(html, 200, "text/html"),
  ]);
  assert.equal((await missing.fetcher({ platform: "guazi", url })).body, html);
  const disguised = harness([response("<html>Login</html>", 200, "text/html")]);
  await assert.rejects(disguised.fetcher({ platform: "guazi", url }), {
    code: "robots_unavailable",
  });
  assert.equal(disguised.calls.length, 1);
  const captcha = harness([
    response("Please complete CAPTCHA", 200, "text/plain"),
  ]);
  await assert.rejects(captcha.fetcher({ platform: "guazi", url }), {
    code: "robots_unavailable",
  });
  assert.equal(captcha.calls.length, 1);
});

test("401, 403 and 429 stop without retry or invented vehicle body", async () => {
  for (const status of [401, 403, 429]) {
    const h = harness([
      response("User-agent: *\nAllow: /"),
      response("challenge", status),
    ]);
    await assert.rejects(h.fetcher({ platform: "guazi", url }), {
      code: status === 429 ? "rate_limited" : "access_blocked",
    });
    assert.equal(h.calls.length, 2);
  }
});

test("redirects cannot leave the source origin or target non-detail endpoints", async () => {
  for (const location of [
    "https://example.com/car-detail/c1.html",
    "/login",
    "http://www.guazi.com/car-detail/c1.html",
    "https://user:password@www.guazi.com/car-detail/c1.html",
  ]) {
    const h = harness([
      response("User-agent: *\nAllow: /"),
      response(null, 302, "text/plain", { location }),
    ]);
    await assert.rejects(h.fetcher({ platform: "guazi", url }), {
      code: "redirect_rejected",
    });
    assert.equal(h.calls.length, 2);
  }
});

test("same-origin allowed redirects recheck robots rules for their destination", async () => {
  const h = harness([
    response(
      "User-agent: *\nAllow: /\nDisallow: /car-detail/c164433896123047.md",
    ),
    response(null, 302, "text/plain", {
      location: "/car-detail/c164433896123047.md",
    }),
  ]);
  await assert.rejects(h.fetcher({ platform: "guazi", url }), {
    code: "robots_denied",
  });
  assert.equal(h.calls.length, 2);
});

test("same-listing HTML to Markdown redirects preserve identity, pacing and final URL", async () => {
  const h = harness([
    response("User-agent: *\nAllow: /\nCrawl-delay: 3"),
    response(null, 302, "text/plain", {
      location: "/car-detail/c164433896123047.md",
    }),
    response("# 本车详情", 200, "text/markdown"),
  ]);
  const result = await h.fetcher({ platform: "guazi", url });
  assert.equal(
    result.url,
    "https://www.guazi.com/car-detail/c164433896123047.md",
  );
  assert.equal(result.contentType, "text/markdown");
  assert.deepEqual(h.delays, [3000, 3000]);
});

test("same-origin redirects to a different listing ID are rejected before fetching", async () => {
  const h = harness([
    response("User-agent: *\nAllow: /"),
    response(null, 302, "text/plain", { location: "/car-detail/c999.html" }),
    response(html, 200, "text/html"),
  ]);
  await assert.rejects(h.fetcher({ platform: "guazi", url }), {
    code: "redirect_rejected",
  });
  assert.equal(h.calls.length, 2);
});

test("robots redirects may not reach a login or another origin", async () => {
  for (const location of ["/login", "https://other.test/robots.txt"]) {
    const h = harness([response(null, 302, "text/plain", { location })]);
    await assert.rejects(h.fetcher({ platform: "guazi", url }), {
      code: "redirect_rejected",
    });
    assert.equal(h.calls.length, 1);
  }
});

test("rejects unsupported detail types and declared oversized bodies", async () => {
  const unsupported = harness([
    response("User-agent: *\nAllow: /"),
    response("{}", 200, "application/json"),
  ]);
  await assert.rejects(unsupported.fetcher({ platform: "guazi", url }), {
    code: "unsupported_format",
  });
  const huge = harness([
    response("User-agent: *\nAllow: /"),
    response("x", 200, "text/html", {
      "content-length": String(5 * 1024 * 1024 + 1),
    }),
  ]);
  await assert.rejects(huge.fetcher({ platform: "guazi", url }), {
    code: "response_too_large",
  });
});

test("rejects oversized streamed bodies without content-length", async () => {
  const stream = new ReadableStream({
    start(controller) {
      controller.enqueue(new Uint8Array(5 * 1024 * 1024 + 1));
      controller.close();
    },
  });
  const h = harness([
    response("User-agent: *\nAllow: /"),
    response(stream, 200, "text/html"),
  ]);
  await assert.rejects(h.fetcher({ platform: "guazi", url }), {
    code: "response_too_large",
  });
});

test("a stalled request times out, aborts its signal and sanitizes transport errors", async () => {
  let signal;
  const stalled = harness([
    response("User-agent: *\nAllow: /"),
    (_, init) => {
      signal = init.signal;
      return new Promise(() => {});
    },
  ]);
  await assert.rejects(
    stalled.fetcher({ platform: "guazi", url, timeoutMs: 10 }),
    { code: "fetch_timeout" },
  );
  assert.equal(signal.aborted, true);
  const error = harness([
    response("User-agent: *\nAllow: /"),
    new Error("password=secret"),
  ]);
  await assert.rejects(
    error.fetcher({ platform: "guazi", url }),
    (err) => err.code === "network_error" && !err.message.includes("secret"),
  );
});
