# 仓库协作约定

## 文档

- 根 `README.md` 与 `backend/README.md` 只保留项目定位、运行要求、快速开始、重大状态和文档入口。不要追加详细功能清单或开发流水账。
- 用户功能与体验流程更新 `docs/FEATURES.md`；开发、结构和测试方法更新 `docs/DEVELOPMENT.md`；平台/数据库/API更新 `docs/DATA-INTEGRATION.md`；字段契约更新 `backend/CONTRACT.md`。
- 实现状态和测试证据更新 `VERIFICATION.md`，区分真实服务验证与示例/模拟测试。重大状态变化才摘要同步到 README。
- 修改功能时同步相关文档；路径与命令保持可移植，检查文档相对链接。完整维护约定见 `CONTRIBUTING.md`。
