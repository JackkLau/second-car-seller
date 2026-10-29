import { expect, test, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

const car = (page: Page, id: string) =>
  page.locator(`[data-testid="vehicle-card"][data-vehicle-id="${id}"]`);
const openNeeds = async (page: Page) => {
  await page.getByText("按我的需求选车", { exact: true }).click();
  return page.getByRole("region", { name: "用车需求", exact: true });
};

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await expect(page.getByTestId("vehicle-card")).toHaveCount(8);
});

test("应用需求后重新推荐，座位不符不会被偏好抵消，清除可恢复", async ({
  page,
}) => {
  const profile = await openNeeds(page);
  await profile.getByLabel("主要用途", { exact: true }).selectOption("family");
  await profile
    .getByLabel("已列费用预算上限", { exact: true })
    .selectOption("200000");
  await profile
    .getByLabel("常乘人数（含驾驶员）", { exact: true })
    .selectOption("3-5");
  await profile.getByRole("button", { name: "应用用车需求" }).click();
  await expect(page.getByTestId("vehicle-card").first()).toHaveAttribute(
    "data-vehicle-id",
    "toyota-camry",
  );
  await expect(page.getByTestId("vehicle-card")).toHaveCount(8);
  await expect(car(page, "mini-cooper")).toContainText("不满足至少5座");
  await openNeeds(page);
  await profile
    .getByLabel("常乘人数（含驾驶员）", { exact: true })
    .selectOption("6+");
  await profile.getByRole("button", { name: "应用用车需求" }).click();
  await expect(
    page.getByText("当前结果没有满足预算和座位要求的车", { exact: true }),
  ).toBeVisible();
  await expect(page.locator(".card-recommendation.needs-mismatch")).toHaveCount(
    8,
  );
  await openNeeds(page);
  await profile.getByRole("button", { name: "清除用车需求" }).click();
  await expect(page.locator(".card-recommendation")).toHaveCount(0);
  await expect(page.getByTestId("vehicle-card").first()).toHaveAttribute(
    "data-vehicle-id",
    "tesla-model3",
  );
});

test("已查轮胎不遮盖待检制动，费用保留待报价", async ({ page }) => {
  await car(page, "vw-golf")
    .getByRole("button", { name: "查看车况", exact: true })
    .click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByTestId("inspection-record-tires")).toContainText(
    "已查 · 需关注",
  );
  await expect(dialog.getByTestId("inspection-record-brakes")).toContainText(
    "待检测",
  );
  await expect(dialog.getByText(/尚缺专项记录：.*制动系统/)).toBeVisible();
  const costs = dialog.getByRole("region", {
    name: "后续可能涉及的费用",
    exact: true,
  });
  await expect(costs.getByText("待报价", { exact: true })).toHaveCount(5);
  await expect(costs).toContainText("未计入“已列费用合计”");
});

test("专项清单随所选车辆进入预约，成功页保留且不发送", async ({ page }) => {
  const requests: string[] = [];
  page.on("request", (request) => {
    if (request.method() !== "GET") requests.push(request.url());
  });
  await car(page, "tesla-model3")
    .getByRole("button", { name: "查看车况", exact: true })
    .click();
  let dialog = page.getByRole("dialog");
  await dialog.getByRole("checkbox", { name: /核验电池与电驱资料/ }).check();
  await dialog.getByRole("checkbox", { name: /体验停车与视野/ }).check();
  await dialog
    .getByRole("button", { name: "带着清单选时间", exact: true })
    .click();
  dialog = page.getByRole("dialog", { name: "预约看车", exact: true });
  const plan = dialog.getByRole("region", {
    name: "看车沟通清单",
    exact: true,
  });
  await expect(plan.getByRole("listitem")).toHaveCount(2);
  await expect(plan).toContainText("核验电池与电驱资料");
  await expect(plan).toContainText("销售配合");
  await expect(plan).toContainText("未发送给销售");
  await dialog
    .getByRole("button", { name: "返回车况，调整检测清单", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toHaveCount(1);
  await expect(
    page
      .getByRole("dialog")
      .getByRole("checkbox", { name: /核验电池与电驱资料/ }),
  ).toBeChecked();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "带着清单选时间", exact: true })
    .click();
  dialog = page.getByRole("dialog", { name: "预约看车", exact: true });
  await dialog.getByRole("radio").first().check();
  await dialog.getByRole("radio", { name: "09:00–11:00", exact: true }).check();
  await dialog.getByLabel("联系手机号").fill("13800000000");
  await dialog
    .getByRole("checkbox", { name: "我已了解这是一份演示预约", exact: true })
    .check();
  await dialog
    .getByRole("button", { name: "生成预约示例", exact: true })
    .click();
  const success = page.getByRole("dialog", {
    name: "预约示例已生成",
    exact: true,
  });
  await expect(
    success
      .getByRole("region", { name: "看车沟通清单", exact: true })
      .getByRole("listitem"),
  ).toHaveCount(2);
  await expect(success).toContainText("138****0000");
  expect(requests).toEqual([]);
  await success
    .getByRole("button", { name: "完成，继续选车", exact: true })
    .click();
  await car(page, "bmw-3")
    .getByRole("button", { name: "预约看车", exact: true })
    .click();
  await expect(
    page
      .getByRole("dialog")
      .getByRole("region", { name: "看车沟通清单", exact: true }),
  ).toContainText("尚未勾选专项项目");
});

test("更改需求保留当前筛选和各车已选清单，刷新清除需求与清单", async ({
  page,
}) => {
  await car(page, "tesla-model3")
    .getByRole("button", { name: "查看车况", exact: true })
    .click();
  await page
    .getByRole("dialog")
    .getByRole("checkbox", { name: /体验停车与视野/ })
    .check();
  await page.keyboard.press("Escape");
  await page
    .getByRole("searchbox", { name: "搜索品牌、车型或配置", exact: true })
    .fill("特斯拉");
  const profile = await openNeeds(page);
  await profile.getByLabel("补能条件", { exact: true }).selectOption("home");
  await profile.getByRole("button", { name: "应用用车需求" }).click();
  await expect(page.getByTestId("vehicle-card")).toHaveCount(1);
  await car(page, "tesla-model3")
    .getByRole("button", { name: "查看车况", exact: true })
    .click();
  await expect(
    page.getByRole("dialog").getByRole("checkbox", { name: /体验停车与视野/ }),
  ).toBeChecked();
  await page.reload();
  await expect(page.getByTestId("vehicle-card")).toHaveCount(1);
  await expect(page.locator(".card-recommendation")).toHaveCount(0);
  await car(page, "tesla-model3")
    .getByRole("button", { name: "查看车况", exact: true })
    .click();
  await expect(
    page.getByRole("dialog").getByRole("checkbox", { name: /体验停车与视野/ }),
  ).not.toBeChecked();
});

test("预约跨日后提交会拒绝缓存中的过期日期", async ({ page }) => {
  await page.clock.setFixedTime(new Date("2026-10-29T23:59:00+08:00"));
  await page.reload();
  await car(page, "tesla-model3")
    .getByRole("button", { name: "预约看车", exact: true })
    .click();
  const dialog = page.getByRole("dialog", { name: "预约看车", exact: true });
  await dialog.getByRole("radio").first().check();
  await dialog.getByRole("radio", { name: "09:00–11:00", exact: true }).check();
  await dialog.getByLabel("联系手机号").fill("13800000000");
  await dialog
    .getByRole("checkbox", { name: "我已了解这是一份演示预约", exact: true })
    .check();
  await page.clock.setFixedTime(new Date("2026-10-31T10:00:00+08:00"));
  await dialog
    .getByRole("button", { name: "生成预约示例", exact: true })
    .click();
  await expect(
    dialog.getByText("日期已过期或不在未来七天内，请重新选择。", {
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    page.getByRole("dialog", { name: "预约示例已生成", exact: true }),
  ).toHaveCount(0);
});

test("手机需求表单和检测清单可达，无新增自动可访问性问题", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const profile = await openNeeds(page);
  await profile.getByLabel("主要用途", { exact: true }).selectOption("family");
  const audit = () =>
    new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
      .analyze();
  expect((await audit()).violations).toEqual([]);
  await profile.getByRole("button", { name: "应用用车需求" }).click();
  await car(page, "vw-golf")
    .getByRole("button", { name: "查看车况", exact: true })
    .click();
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("checkbox", { name: /补齐待检测项目/ }).check();
  await dialog
    .getByRole("button", { name: "带着清单选时间", exact: true })
    .scrollIntoViewIfNeeded();
  await expect(
    dialog.getByRole("button", { name: "带着清单选时间", exact: true }),
  ).toBeInViewport();
  expect((await audit()).violations).toEqual([]);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth + 1,
    ),
  ).toBe(true);
});
