# 见车 · 二手车获客与选车 MVP

围绕用车需求、车况证据和看车准备，连接车辆展示、个性化推荐与销售后续配合。

React + TypeScript + Vite · Node.js · PostgreSQL

[功能说明](docs/FEATURES.md) · [开发指南](docs/DEVELOPMENT.md) · [数据接入](docs/DATA-INTEGRATION.md) · [验收记录](VERIFICATION.md)

## 项目状态

当前为 **MVP 开发阶段**。前端使用虚构车源和本地预约演示；独立数据后端已实现采集、导入与存储流程，四个平台实网接入、真实历史资料和原生 PostgreSQL 联调仍待验收。具体完成情况见[验收记录](VERIFICATION.md)。

## 快速开始

需要 **Node.js ≥ 22.18.0** 和 npm。

```bash
git clone https://github.com/JackkLau/second-car-seller.git
cd second-car-seller
npm ci
npm run dev
```

打开终端显示的本地地址，默认 `http://localhost:5173`。体验前端不需要配置数据库。

接入真实数据时，按[数据接入指南](docs/DATA-INTEGRATION.md)配置 PostgreSQL 和服务端环境变量。

## 文档

| 主题                       | 入口                                                                       |
| -------------------------- | -------------------------------------------------------------------------- |
| 功能、体验流程与数据边界   | [功能说明](docs/FEATURES.md)                                               |
| 项目结构、开发与测试       | [开发指南](docs/DEVELOPMENT.md)                                            |
| 数据源、数据库、采集与 API | [数据接入指南](docs/DATA-INTEGRATION.md) · [数据契约](backend/CONTRACT.md) |
| 已实现、待实现及测试证据   | [验收记录](VERIFICATION.md)                                                |
| 交互与视觉约定             | [UX-CONTRACT.md](UX-CONTRACT.md) · [DESIGN.md](DESIGN.md)                  |
| 贡献与文档维护             | [贡献指南](CONTRIBUTING.md)                                                |

## 贡献

提交问题或改进前，请阅读[贡献指南](CONTRIBUTING.md)。README 只维护项目定位、运行要求、快速开始、重大状态和文档入口；详细功能与实现说明更新到对应文档。

## 许可与素材

项目代码尚未指定开源许可证。第三方软件声明见 [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md)；车型图片的来源、署名与许可见 [ASSETS.md](ASSETS.md)。
