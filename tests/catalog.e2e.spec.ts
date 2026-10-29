import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

const car = (page: Page, id: string) =>
  page.locator(`[data-testid="vehicle-card"][data-vehicle-id="${id}"]`);

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await expect(page.getByTestId("vehicle-card")).toHaveCount(8);
});

test("多关键词搜索、空结果和清除搜索均可操作", async ({ page }) => {
  const search = page.getByRole("searchbox", {
    name: "搜索品牌、车型或配置",
    exact: true,
  });
  await search.fill("宝马 3系");
  await expect(page.getByTestId("vehicle-card")).toHaveCount(1);
  await expect(car(page, "bmw-3")).toBeVisible();
  await page.reload();
  await expect(search).toHaveValue("宝马 3系");
  await expect(page.getByTestId("vehicle-card")).toHaveCount(1);
  await search.fill("不存在的车型 xyz");
  await expect(
    page.getByRole("heading", { name: "没有找到符合条件的车", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "清除搜索", exact: true }).click();
  await expect(search).toBeFocused();
  await expect(search).toHaveValue("");
  await expect(page.getByTestId("vehicle-card")).toHaveCount(8);
});

test("预算、城市、报告筛选及价格排序保持一致", async ({ page }) => {
  const filters = page.getByRole("complementary", {
    name: "车辆筛选",
    exact: true,
  });
  await filters.getByText("10万以下", { exact: true }).click();
  await expect(
    filters.getByRole("radio", { name: "10万以下", exact: true }),
  ).toBeChecked();
  await expect(page.getByTestId("vehicle-card")).toHaveCount(1);
  await expect(car(page, "vw-golf")).toBeVisible();
  await filters.getByLabel("车辆所在地", { exact: true }).selectOption("上海");
  await expect(page.getByTestId("vehicle-card")).toHaveCount(0);
  await expect(
    page.getByRole("heading", { name: "没有找到符合条件的车", exact: true }),
  ).toBeVisible();
  await filters.getByRole("button", { name: "重置筛选", exact: true }).click();
  await filters.getByText("只看有检测报告的车", { exact: true }).click();
  await expect(
    filters.getByRole("checkbox", { name: "只看有检测报告的车", exact: true }),
  ).toBeChecked();
  await expect(page.getByTestId("vehicle-card")).toHaveCount(7);
  await expect(car(page, "mini-cooper")).toHaveCount(0);
  await filters.getByRole("button", { name: "重置筛选", exact: true }).click();
  await page.getByLabel("车辆排序", { exact: true }).selectOption("price-asc");
  await expect(page.getByTestId("vehicle-card").first()).toHaveAttribute(
    "data-vehicle-id",
    "vw-golf",
  );
  await page.getByLabel("车辆排序", { exact: true }).selectOption("price-desc");
  await expect(page.getByTestId("vehicle-card").first()).toHaveAttribute(
    "data-vehicle-id",
    "mercedes-c",
  );
});

test("收藏在刷新后保留，取消收藏恢复空状态", async ({ page }) => {
  await car(page, "tesla-model3")
    .getByRole("button", { name: "收藏特斯拉Model 3", exact: true })
    .click();
  await page
    .getByRole("navigation", { name: "主导航", exact: true })
    .getByRole("button", { name: /^我的收藏/ })
    .click();
  await expect(page.getByTestId("vehicle-card")).toHaveCount(1);
  await page.reload();
  await expect(page.getByTestId("vehicle-card")).toHaveCount(1);
  await car(page, "tesla-model3")
    .getByRole("button", { name: "取消收藏特斯拉Model 3", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "还没有收藏车辆", exact: true }),
  ).toBeVisible();
  await page.reload();
  await expect(page.getByTestId("vehicle-card")).toHaveCount(0);
});

test("最多对比三台车，比较表展示可核对的费用", async ({ page }, testInfo) => {
  await car(page, "tesla-model3")
    .getByRole("button", { name: /^加入对比/ })
    .click();
  await expect(
    page.getByRole("button", { name: "开始对比", exact: true }),
  ).toBeDisabled();
  for (const id of ["bmw-3", "volvo-xc60"]) {
    await car(page, id)
      .getByRole("button", { name: /^加入对比/ })
      .click();
  }
  await car(page, "vw-golf")
    .getByRole("button", { name: /^加入对比/ })
    .click();
  await expect(
    page.getByText("最多对比3台车，请先移除一台。", { exact: true }),
  ).toBeVisible();
  const tray = page.getByRole("region", { name: "已选对比车辆", exact: true });
  await expect(tray.getByRole("button", { name: /^移除/ })).toHaveCount(3);
  await page.getByRole("button", { name: "开始对比", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "车辆对比", exact: true });
  const table = dialog.getByRole("table");
  await expect(table.getByRole("columnheader")).toHaveCount(4);
  await expect(table.getByRole("row", { name: /^已列费用合计/ })).toContainText(
    "¥171,100",
  );
  await expect(dialog.getByText(/不含保险及异地运输/)).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath("compare.png") });
});

test("费用与车况证据可查看，Escape 恢复触发器焦点", async ({
  page,
}, testInfo) => {
  const trigger = car(page, "tesla-model3").getByRole("button", {
    name: "查看车况",
    exact: true,
  });
  await trigger.click();
  const dialog = page.getByRole("dialog");
  await expect(
    dialog.getByRole("heading", { name: "车况档案", exact: true }),
  ).toBeVisible();
  await expect(dialog.getByText("¥171,100", { exact: true })).toBeVisible();
  await expect(dialog.getByText(/保险、异地运输等费用尚未计入/)).toBeVisible();
  await expect(dialog.getByText("本次示例未检出", { exact: true })).toHaveCount(
    3,
  );
  await expect(dialog.getByText(/未提供对应部位的实拍证据/)).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath("detail.png") });
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  await expect(trigger).toBeFocused();
});

test("未检测车源保留未知状态，不能伪装成检测通过", async ({ page }) => {
  await car(page, "mini-cooper")
    .getByRole("button", { name: "查看车况", exact: true })
    .click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByText("尚未检测", { exact: true })).toBeVisible();
  for (const id of ["structure", "flood", "fire"]) {
    await expect(dialog.getByTestId(`inspection-record-${id}`)).toContainText(
      "待检测",
    );
    await expect(
      dialog.getByTestId(`inspection-record-${id}`),
    ).not.toContainText("本次示例未检出");
  }
  await expect(dialog.getByText("本次示例未检出", { exact: true })).toHaveCount(
    0,
  );
});

test("预约验证、生成与完成流程，不发送或保存手机号", async ({ page }) => {
  const posts: string[] = [];
  page.on("request", (request) => {
    if (request.method() === "POST") posts.push(request.url());
  });
  const trigger = car(page, "tesla-model3").getByRole("button", {
    name: "预约看车",
    exact: true,
  });
  await trigger.click();
  const dialog = page.getByRole("dialog", { name: "预约看车", exact: true });
  const submit = dialog.getByRole("button", {
    name: "生成预约示例",
    exact: true,
  });
  await submit.click();
  await expect(
    dialog.getByText("请选择一个看车日期。", { exact: true }),
  ).toBeVisible();
  await expect(dialog.getByLabel("联系手机号")).toHaveAttribute(
    "aria-invalid",
    "true",
  );
  await expect(dialog.getByRole("radio").first()).toBeFocused();
  await dialog.getByRole("radio").first().check();
  await dialog.getByRole("radio", { name: "09:00–11:00", exact: true }).check();
  await dialog.getByLabel("联系手机号").fill("13800000000");
  await dialog
    .getByRole("checkbox", { name: "我已了解这是一份演示预约", exact: true })
    .check();
  await submit.click();
  await expect(
    dialog.getByRole("button", { name: "正在生成…", exact: true }),
  ).toBeDisabled();
  const result = page.getByRole("dialog", {
    name: "预约示例已生成",
    exact: true,
  });
  await expect(result.getByText("138****0000", { exact: true })).toBeVisible();
  await expect(
    result.getByText(/没有发送给商家，也不会产生电话联系/),
  ).toBeVisible();
  expect(posts).toEqual([]);
  const storage = await page.evaluate(() =>
    JSON.stringify({ ...localStorage, ...sessionStorage }),
  );
  expect(storage).not.toContain("13800000000");
  expect(storage).not.toContain("138****0000");
  await result
    .getByRole("button", { name: "完成，继续选车", exact: true })
    .click();
  await expect(result).toBeHidden();
  await expect(trigger).toBeFocused();
});

test("页面和打开的详情没有 WCAG A/AA 自动检查问题", async ({ page }) => {
  const audit = () =>
    new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
      .analyze();
  expect((await audit()).violations).toEqual([]);
  await car(page, "tesla-model3")
    .getByRole("button", { name: "查看车况", exact: true })
    .click();
  expect((await audit()).violations).toEqual([]);
  await page.keyboard.press("Escape");
  await car(page, "tesla-model3")
    .getByRole("button", { name: "预约看车", exact: true })
    .click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "生成预约示例", exact: true })
    .click();
  expect((await audit()).violations).toEqual([]);
});

test("桌面页面图片完整加载并生成视觉检查截图", async ({ page }, testInfo) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.reload();
  await expect(page.getByTestId("vehicle-card")).toHaveCount(8);
  await page.getByTestId("vehicle-card").last().scrollIntoViewIfNeeded();
  await expect
    .poll(() =>
      page
        .locator("img")
        .evaluateAll((images) =>
          images.every(
            (image) =>
              (image as HTMLImageElement).complete &&
              (image as HTMLImageElement).naturalWidth > 0,
          ),
        ),
    )
    .toBe(true);
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
  await page.screenshot({
    path: testInfo.outputPath("desktop.png"),
    fullPage: true,
  });
  await page.screenshot({ path: testInfo.outputPath("desktop-viewport.png") });
  expect(errors).toEqual([]);
});

test("手机筛选抽屉可以按预算筛出车辆并回到结果", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole("button", { name: "筛选", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "筛选车辆", exact: true });
  await dialog.getByText("10万以下", { exact: true }).click();
  await expect(
    dialog.getByRole("radio", { name: "10万以下", exact: true }),
  ).toBeChecked();
  await dialog.getByRole("button", { name: "查看1台车", exact: true }).click();
  await expect(dialog).toBeHidden();
  await expect(page.getByTestId("vehicle-card")).toHaveCount(1);
  await expect(car(page, "vw-golf")).toBeVisible();
});

test("390px 手机布局无整页横向溢出，预约操作保持可达", async ({
  page,
}, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await expect
    .poll(() =>
      page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth + 1,
      ),
    )
    .toBe(true);
  await page.screenshot({
    path: testInfo.outputPath("mobile.png"),
    fullPage: true,
  });
  await page.screenshot({ path: testInfo.outputPath("mobile-viewport.png") });
  await car(page, "tesla-model3")
    .getByRole("button", { name: "预约看车", exact: true })
    .click();
  const dialog = page.getByRole("dialog", { name: "预约看车", exact: true });
  await expect(dialog).toBeVisible();
  await dialog
    .getByRole("button", { name: "生成预约示例", exact: true })
    .scrollIntoViewIfNeeded();
  await expect(
    dialog.getByRole("button", { name: "生成预约示例", exact: true }),
  ).toBeInViewport();
  await page.screenshot({
    path: testInfo.outputPath("mobile-appointment.png"),
  });
});
