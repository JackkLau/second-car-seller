# 开发指南

本指南包含本地运行、代码结构、验证方法与业务接入位置。产品行为见 [功能与体验](./FEATURES.md)，数据采集、PostgreSQL 配置和 API 见 [数据接入文档](./DATA-INTEGRATION.md)。

## 环境与启动

需要 Node.js **22.18.0 或以上**和 npm。在项目根目录执行：

```bash
npm ci
npm run dev
```

访问终端显示的地址，默认是 `http://localhost:5173`。

```bash
npm run build
npm run preview
```

`build` 先执行 TypeScript 检查，再生成 `dist/`；`preview` 默认在 `http://localhost:4173` 预览生产构建。开发与预览命令需要环境允许监听本地端口。

后端依赖独立安装：

```bash
npm run data:setup
```

真实数据库连接、迁移、采集和只读 API 的完整步骤见 [DATA-INTEGRATION.md](./DATA-INTEGRATION.md)。前端开发本身不要求启动 PostgreSQL。

## 技术与目录

前端采用 React 19、TypeScript、Vite 7、原生 CSS 和 lucide-react 图标。照片保存在 `public/images/`，当前前端运行时不依赖外部图片服务或远程字体。

后端使用 Node.js、Postgres.js 和 parse5；PGlite 用于本地 PostgreSQL WASM 测试，不代替原生 PostgreSQL 服务联调。

| 路径                                                  | 职责                                             |
| ----------------------------------------------------- | ------------------------------------------------ |
| `src/App.tsx`                                         | 页面布局、筛选状态、收藏、对比和弹窗协调         |
| `src/types.ts`                                        | 演示车辆、筛选、用车需求和看车清单类型           |
| `src/data/vehicles.ts`                                | 8台虚构示例车源                                  |
| `src/data/inspections.ts`                             | 逐车、逐项虚构检查记录                           |
| `src/lib/catalog.ts`                                  | 筛选、排序、URL 序列化和已列费用计算             |
| `src/lib/recommendations.ts`                          | 需求硬约束、偏好排序和可解释理由                 |
| `src/lib/visitPlan.ts`                                | 针对性看车项目、销售配合与待报价费用             |
| `src/lib/appointmentDates.ts`                         | 香港日历日期与实时预约窗口校验                   |
| `src/lib/*.test.ts`                                   | 前端领域行为测试                                 |
| `src/components/VehicleCard.tsx`、`Filters.tsx`       | 车辆卡片与桌面/手机筛选                          |
| `src/components/Modal.tsx`                            | 共用原生模态对话框                               |
| `src/components/VehicleDetails.tsx`、`Comparison.tsx` | 车辆详情与多车对比                               |
| `src/components/AppointmentDialog.tsx`                | 本地预约演示                                     |
| `src/components/NeedsProfile.tsx`                     | 可选用车需求与草稿应用                           |
| `src/components/InspectionRecords.tsx`                | 已查、待查与待核验记录分组                       |
| `src/components/VehicleGuidance.tsx`                  | 看车清单、销售步骤、费用及预约摘要               |
| `src/styles/`                                         | 视觉变量、响应式样式、需求与清单交互样式         |
| `backend/`                                            | 公开页面接入、标准资料导入、数据库仓储和只读 API |
| `backend/migrations/`                                 | PostgreSQL 迁移与数据约束                        |
| `backend/*.test.mjs`                                  | 解析、抓取边界、归一化、SQL 与 API 测试          |
| `public/images/`                                      | 本地照片与版权署名                               |
| `tests/`                                              | Playwright 交互和可访问性检查                    |

视觉约定见 [DESIGN.md](../DESIGN.md)，交互行为和数据边界见 [UX-CONTRACT.md](../UX-CONTRACT.md)，素材来源见 [ASSETS.md](../ASSETS.md)。

## 验证命令

在安装前后端依赖后，从项目根目录执行：

```bash
npm run typecheck
npm test
npm run data:test
npm run build
npm run format:check
```

| 命令                   | 验证范围                                                            |
| ---------------------- | ------------------------------------------------------------------- |
| `npm run typecheck`    | 前端 TypeScript 编译检查                                            |
| `npm test`             | 目录、推荐、检查清单和预约日期的领域行为                            |
| `npm run data:test`    | 后端解析、网络边界、资料校验、仓储和只读 API；数据库部分使用 PGlite |
| `npm run build`        | TypeScript 检查与 Vite 生产构建                                     |
| `npm run format:check` | 项目配置中指定文件的 Prettier 格式检查                              |
| `npm run test:e2e`     | Chromium 中的页面交互和自动可访问性检查                             |

浏览器测试：

```bash
npx playwright install chromium
npm run test:e2e
```

首次执行需要下载 Chromium。已有兼容浏览器时可通过 `PLAYWRIGHT_CHROMIUM_EXECUTABLE` 环境变量指定可执行文件。测试配置会自动启动或复用 `5173` 端口的开发服务器。

构建、领域测试、可控响应测试或 PostgreSQL WASM 测试通过，不能替代浏览器交互、平台实网采集或原生 PostgreSQL 多连接验证。最新已执行检查、失败原因和未完成项统一记录在 [VERIFICATION.md](../VERIFICATION.md)，本指南不重复维护测试数量。

## 接入真实业务

真实资料读取入口为 [backend/server.mjs](../backend/server.mjs)，数据库定义在 [backend/migrations](../backend/migrations)，标准输入契约见 [backend/CONTRACT.md](../backend/CONTRACT.md)。

前端接入应先适配可为空的数据字段与来源状态。不要将后端对象直接强制转换为演示 `Vehicle`，也不要给真实车源附加演示检测记录。读取 API 的 token 留在服务端，不放入浏览器代码或 `VITE_*` 环境变量。

预约业务入口为 [AppointmentDialog.tsx](../src/components/AppointmentDialog.tsx)。接通商家前保留演示说明；真正接入时需要服务端校验、可预约时段查询、去重与幂等、隐私告知和失败恢复。实际报价、检测安排与销售回传需要独立业务接口。

分析埋点可围绕列表曝光、详情、报告查看、咨询、预约和到店设置，不应记录手机号。

## 文档更新位置

功能变化更新 [FEATURES.md](./FEATURES.md)，开发命令和代码入口更新本指南，采集与数据库变化更新 [DATA-INTEGRATION.md](./DATA-INTEGRATION.md)，执行结果更新 [VERIFICATION.md](../VERIFICATION.md)。README 只维护项目定位、快速开始、关键状态与文档入口，避免回填详细功能清单和逐次测试记录。
