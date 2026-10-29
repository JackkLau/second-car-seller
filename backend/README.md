# 见车数据后端

公开车源采集、授权资料导入、PostgreSQL 存储与鉴权只读 API。

**状态：**本地数据链路已验证；实网采集、真实历史资料接口与原生 PostgreSQL 服务联调仍待验收。

## 开始使用

从项目根目录运行：

```bash
npm run data:setup
cp backend/.env.example backend/.env
```

填写数据库连接和独立 API token 后，按[数据接入指南](../docs/DATA-INTEGRATION.md)启动数据库，再执行：

```bash
npm run data:migrate
npm run data:start
```

API 默认监听 `127.0.0.1:8787`。测试使用 `npm run data:test`。

## 文档

- [数据接入指南](../docs/DATA-INTEGRATION.md)：平台状态、采集/导入命令、数据库结构、API与限制。
- [数据契约](CONTRACT.md)：标准字段、来源、授权与缺失状态。
- [测试样本说明](fixtures/README.md)：重构页面与真实抓取证据的区别。
- [验收记录](../VERIFICATION.md)：测试结果和剩余工作。
