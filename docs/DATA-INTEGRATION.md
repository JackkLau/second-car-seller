# 真实车源接入与 PostgreSQL

本模块增加“给定公开详情 URL → robots/访问检查 → 本车字段提取 → 校验 → PostgreSQL 快照和明细 → 只读 API”的链路，以及有明确来源的人工摘录和授权 JSON 导入。

**当前是数据接入 MVP，不是四个平台已经全量接通。** 现有 SQL/事务测试使用 PGlite（PostgreSQL WASM），实网采集和原生 PostgreSQL 联调仍待验收；执行环境与失败原因见 [VERIFICATION.md](../VERIFICATION.md)。前端继续显示原有8台虚构车辆，尚未切换真实库存；不会给真实车源套上虚构检测报告。

## 各平台的实际状态

| 来源                  | 本次证据与代码                                                                     | 尚未完成                                                                |
| --------------------- | ---------------------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| 瓜子                  | 已阅读真实公开详情；支持本车标题/车况区域及绑定详情 URL 的 JSON-LD；保留已下架状态 | 原始 HTML / Markdown 实网抓取验证；库存分页/增量发现；APP检测报告       |
| 汽车之家 / 二手车之家 | 已阅读真实公开详情；支持本车标题/车辆档案区域及身份匹配的 JSON-LD                  | 原始 HTML 实网验证；库存发现；实际检测、保单、出险和维保接口            |
| 懂车帝                | URL白名单、作业追踪、仅绑定本车 URL 的标准 JSON-LD 适配                            | 尚无可验证的详情正文；不能声称真实适配成功；无官方历史接口接入          |
| 易车 / 淘车车         | 已核查易车关联入口；支持详情 ucarId URL 与身份匹配的 JSON-LD                       | 详情是动态页面，本次没有正文；开放车型库不能当作二手车库存/保险维保接口 |

每个平台都可导入符合 `CONTRACT.md` 的授权资料，但这不是平台合作接口已经签约或实现。没有购买记录、登录账号、发送合作申请或调用未公开接口。报告/历史资料仍需实际的数据授权与文档。

核查依据（2026-10-29 UTC，页面信息会变化）：

- [瓜子真实详情](https://www.guazi.com/car-detail/c164433896123047.html)：理想L9，37.37万元，100公里，2026-03上牌，成都，0次过户，**已下架**。页面保险6647元是年度成本估算；原厂在保不是保险保单。
- [汽车之家真实详情](https://wap.che168.com/dealer/559088/59932190.html)：极氪009，35.54万元，不含过户费，2023-11上牌，11.23万公里，杭州，0次过户。首付和通用保障均不作为本车售价/检查记录。
- [易车开放平台](https://open.yiche.com/doc)：公开文档涉及车型、参数、经销商等；没有据此确认二手库存及VIN历史记录接口。
- [易车关联二手车入口](https://yiche.taocheche.com.cn/home?city=beijing)、[详情候选](https://beta.m.taocheche.com/apps/detail/index.html?ucarId=378056784)、[懂车帝详情候选](https://www.dongchedi.com/usedcar/357014057)：未获得可验证详情数据。
- [瓜子官方FAQ](https://www.guazi.com/question/rmwt/6a9f680dcec065002d48c251.html)：检测报告在APP查看，平台使用保险/维保数据；不等于提供公开接口。
- [瓜子robots](https://www.guazi.com/robots.txt)、[汽车之家合作入口](https://www.autohome.com.cn/about/lianxi.html)。

## 启动 PostgreSQL

需要 Node.js >=22.18.0、npm、可用的 PostgreSQL 17 服务；Docker Compose 是可选的本地启动方式。以下命令在项目根目录运行：

```bash
npm run data:setup
cp backend/.env.example backend/.env
```

在 `.env` 中替换两个示例密钥并使 DATABASE_URL 的密码与 POSTGRES_PASSWORD 一致。含特殊字符的数据库密码必须按 URI 规则编码；真实密码、token和授权凭证不要放进代码或聊天记录。API启动会拒绝默认 token 示例。

```bash
docker compose --env-file backend/.env -f backend/compose.yaml up -d
npm run data:migrate
npm run data:start
```

已有 PostgreSQL 时只填写 DATABASE_URL，然后执行迁移和启动。远端数据库按服务要求使用证书验证的 TLS 连接。Compose把数据库只绑定到127.0.0.1，并保存在具名卷中；`down` 默认不删除数据，勿随意加 `-v`。应用不会自动创建生产数据库或覆盖已有数据。

## 抓取、导入与失败处理

```bash
# 只抓取/解析，不连接数据库；真实页面可能失败，不会回退虚构数据。
npm run data:fetch -- guazi https://www.guazi.com/car-detail/c164433896123047.html --dry-run
npm run data:fetch -- autohome https://wap.che168.com/dealer/559088/59932190.html --dry-run

# 去掉 --dry-run 后写入已迁移的数据库并记录作业。
npm run data:fetch -- autohome https://wap.che168.com/dealer/559088/59932190.html

# 下面是一条已阅读公开页面后的人工事实摘录；不是爬虫成功结果，也不保证仍在售。
npm run data:import -- examples/autohome-manual.json --dry-run
```

根命令通过 npm 切换到 backend 执行，文件参数相对 backend。校验后入库：

```bash
npm run data:import -- examples/autohome-manual.json
```

需要导入真实检测/保险/出险/维保时，按 [CONTRACT.md](../backend/CONTRACT.md) 构造单车完整 JSON，设置 `source.method=authorized_import` 及内部授权凭据编号 `authorizationReference`。系统记录授权声明，不代替授权审核。不要填个人联系方式、身份证、完整保单号或密钥；这些不在结构化字段白名单内，自由文本也应先移除个人资料。文件最大2MiB。

文件导入不允许标成 `public_page` 冒充爬虫运行；人工摘录用 `manual_capture`。历史资料不公开时四个 coverage 域分别记 `not_disclosed` / `requires_authorization` / `unavailable`，只有实际条目才允许 `available`。当前没有“零次事故已核验”的特殊状态，空数组始终不证明没有记录。

抓取每进程每域名至少间隔2秒，尊重 robots 与 Crawl-delay；请求15秒超时、详情5MiB上限、robots256KiB上限。robots明确404按标准处理为缺失，其余无法确认则停止。401/403/429、验证页和不允许的重定向均停止，不自动重试、不发送登录Cookie、不使用代理绕过。只允许同平台同车辆的详情重定向。

当前单条CLI适合串行单worker；没有全量搜索、并发采集、定时调度和自动重试。进程崩溃时可能留下 running 作业，需运维复核；后续计划补充持久队列与超时回收。

## 数据库结构

| 表                                    | 用途与关键约束                                                               |
| ------------------------------------- | ---------------------------------------------------------------------------- |
| data_sources                          | 四个平台的登记信息                                                           |
| listings                              | 以 source_id + external_id 唯一；首次/最后观察时间，当前快照指针             |
| listing_snapshots                     | 不可变事实快照；基础字段、价格、来源URL/方式、授权引用、内容hash、校验后JSON |
| record_coverage                       | 检测、保险、出险、维保各自的获取状态和原因                                   |
| inspection_reports / inspection_items | 检测日期、机构、摘要、逐项原始声明；reported_ok不是独立安全认证              |
| insurance_policies                    | 险种、保险机构、起止日期、保费和保障摘要；不保存估算与原厂质保               |
| insurance_claims                      | 出险日期、金额与事件摘要                                                     |
| maintenance_events                    | 维保时间、里程、机构、项目摘要和金额                                         |
| ingestion_jobs                        | requested URL、模式、开始/结束时间、成功/失败代码及车源关联                  |
| schema_migrations                     | 已执行迁移及校验和，防止已执行SQL被静默改写                                  |

金额为人民币元的 `numeric(14,2)`，未知为 null，输入最多2位小数；35.54万元应换算355400元。公里为整数，首次上牌按月保存。空缺不会补0、免费、检查通过或“无事故”。fetchedAt 超出当前时间5分钟会被拒，内容hash与系统时钟无关。

相同事实重复导入刷新观察时间，不增重复快照；变化新增快照；较旧观察不能覆盖当前；同时间不同事实保留先入库的当前指针并保存另一快照。同车型/脱敏VIN不进行跨平台自动合并。本阶段尚未采集完整VIN和建立跨平台同车匹配。

报告和事件都绑定到具体快照。后续公开抓取缺失历史资料时，不把旧报告自动当作最新报告；历史仍在数据库，当前API返回当前快照，历史查询界面和跨来源资料融合待实现。只保存白名单事实，不存整页HTML、Cookie或原始上游报错。

迁移仅新增本模块表，不提供破坏性自动回滚。恢复旧版本应使用数据库备份及新增修复迁移；不要编辑已应用的SQL文件。

## 只读 API

监听 `127.0.0.1:8787`，所有端点要求 `Authorization: Bearer <API_READ_TOKEN>`，没有浏览器跨域开放或匿名写入端点：

| GET 路径                                          | 返回                                              |
| ------------------------------------------------- | ------------------------------------------------- |
| /healthz                                          | 数据库连接就绪检查                                |
| /api/sources                                      | 平台能力及尚未验证的接入边界                      |
| /api/listings?platform=autohome&limit=20&offset=0 | 当前车源完整标准对象；limit1–100                  |
| /api/listings/:listingId                          | 当前快照、来源、资料获取状态、实际记录；不存在404 |
| /api/jobs?limit=20                                | 最近任务与安全的失败原因                          |

前端后续应经服务端代理读取该API，不能把 API_READ_TOKEN 放在 VITE_* 或浏览器代码中。真实车源需要独立的 nullable DTO、未知费用和缺失报告状态后才能用于推荐；不要直接强制转换成旧的演示 Vehicle 类型。

## 验证与下一步

```bash
npm run data:test
npm test
npm run typecheck
npm run build
npm run format:check
```

数据测试执行解析边界、网络失败、金额精度、授权与缺失状态、迁移、快照、幂等、回滚、并发调用顺序、只读API鉴权等。数据库测试使用 PGlite，网络测试使用可控响应；`backend/fixtures/*-reconstructed.html` 是短重构样本，不是平台原始HTML。人工摘录样例测试验证的是入库和读取链路。

验收剩余项按依赖顺序：①提供可连接的PostgreSQL并执行迁移/读写/多连接并发测试；②在允许网络下验证公开原始HTML和robots，修正变化并保留证据；③取得各平台/服务商的库存、检测和历史资料授权及正式接口文档；④增加库存发现、调度、报告对象存储/权限、VIN核验；⑤接入前端真实库存、按需推荐和销售实际回传。最新执行结果见 [VERIFICATION.md](../VERIFICATION.md)。
