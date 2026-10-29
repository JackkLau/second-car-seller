# 贡献指南

开发环境、目录结构和验证命令见[开发指南](docs/DEVELOPMENT.md)。提交问题时请说明预期行为、实际行为和复现步骤；提交代码时说明改动目的与验证结果。

## 文档维护约定

README 是项目入口，保持简短。仅在以下关键信息变化时修改：项目定位、运行要求、快速开始、重大完成状态、文档入口及许可信息。

| 变化内容                               | 更新位置                                                                  |
| -------------------------------------- | ------------------------------------------------------------------------- |
| 用户可见功能、操作流程、费用和隐私边界 | [docs/FEATURES.md](docs/FEATURES.md)                                      |
| 开发命令、项目结构、测试方法           | [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md)                                |
| 平台接入、数据库、抓取/导入和API       | [docs/DATA-INTEGRATION.md](docs/DATA-INTEGRATION.md)                      |
| 数据字段、来源状态与校验规则           | [backend/CONTRACT.md](backend/CONTRACT.md)                                |
| 已实现/未实现、测试证据与验证限制      | [VERIFICATION.md](VERIFICATION.md)                                        |
| 用户交互或视觉规范                     | [UX-CONTRACT.md](UX-CONTRACT.md) / [DESIGN.md](DESIGN.md)                 |
| 第三方依赖与图片署名                   | [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md) / [ASSETS.md](ASSETS.md) |

新增功能直接更新对应文档，不向根 README 或 backend/README 追加长功能清单、实现细节、逐次开发日志。各主题尽量维护一个权威说明，其他位置用相对链接引用。

代码与文档在同一次提交中同步。命令必须能从其声明的目录运行，不写维护者机器的固定路径；修改文件位置后检查链接。功能状态只陈述已有证据，区分示例数据、人工摘录、模拟响应测试和真实服务验证。

## 提交前检查

依据改动运行相应检查。文档改动至少检查格式、链接、命令与功能描述一致性；代码改动按[开发指南](docs/DEVELOPMENT.md)运行相关测试。不能执行的检查应记录原因，不写成通过。

不要提交依赖目录、构建产物、测试报告、真实环境变量、token、数据库备份或未脱敏用户资料。保留现有第三方软件及图片署名；不要擅自改变项目许可证。

## 本次结构参考

README 的定位说明、快速开始和文档导航参考了 [Vite](https://github.com/vitejs/vite/blob/main/README.md)、[FastAPI](https://github.com/fastapi/fastapi/blob/master/README.md) 和 [Immich](https://github.com/immich-app/immich/blob/main/README.md) 的组织方式。根据本项目阶段保留必要状态说明，不复制其品牌、徽章、功能宣称或许可选择。
