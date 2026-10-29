# 真实车源接入契约 v1

此模块独立于前端的虚构样例。金额以人民币元、最多2位小数存储（PostgreSQL numeric(14,2)），未知为 null；公里数为整数，年月为 YYYY-MM，日期为 YYYY-MM-DD，时间为带时区的 ISO 8601。来源宣称不等于独立检测结论。没有历史记录不等于没有事故。

## 标准输入

`normalizeRecord(input)` 校验并返回白名单字段，拒绝未知字段与非法值。平台 ID 为 `dongchedi | yiche | guazi | autohome`。

```js
{
  schemaVersion: 1,
  source: {
    platform: 'guazi', externalId: 'c164433896123047',
    url: 'https://www.guazi.com/car-detail/c164433896123047.html',
    fetchedAt: '2026-10-30T00:00:00Z',
    method: 'public_page', // public_page | authorized_import | manual_capture
    authorizationReference: null // authorized_import 必填，内部授权凭据编号，不放密钥或个人资料
  },
  vehicle: {
    title: '车型标题', brand: null, model: null, trim: null, modelYear: null,
    registrationMonth: null, mileageKm: null, energy: null, transmission: null,
    seats: null, color: null, city: null
  },
  listing: {
    priceCny: null, serviceFeeCny: null, transferFeeCny: null,
    transferCount: null, status: 'unknown' // unknown | listed | delisted
  },
  coverage: {
    inspection: { status: 'not_disclosed', note: '本页未提供逐项检测报告' },
    insurance: { status: 'requires_authorization', note: '需授权保单资料' },
    claims: { status: 'requires_authorization', note: '需授权出险记录' },
    maintenance: { status: 'requires_authorization', note: '需授权维保记录' }
  },
  inspections: [], // {externalId, inspectedOn:null, provider:null, summary, items:[{name,result:'reported_ok'|'attention'|'not_tested'|'unknown',detail}]}
  insurancePolicies: [], // {externalId, insurer:null, policyType, startsOn:null, endsOn:null, premiumCny:null, coverageSummary}
  insuranceClaims: [], // {externalId, occurredOn:null, amountCny:null, summary}
  maintenanceEvents: [] // {externalId, servicedOn:null, mileageKm:null, provider:null, summary, costCny:null}
}
```

`coverage.*.status`：`available | not_disclosed | requires_authorization | unavailable`。available 必须有对应实际条目；有条目必须为 available。非 authorized_import 不允许导入保险、出险、维保事件，保险估算/原厂质保不能成为保单。授权导入是操作者对资料来源的明确声明，本系统不验证外部授权凭证的真实性。

## 模块边界

- `sources.mjs`：`SOURCES` 注册表；`validateSourceUrl(platform, url)` 返回规范 URL 字符串；`identifyListing(platform, url)` 返回 externalId。仅 HTTPS、明确详情路径、无用户名密码/片段，域名白名单。易车仅允许明确的 ucarId 查询；其它拒绝查询参数。
- `parsers.mjs`：`parsePublicPage({platform,url,body,contentType,fetchedAt})` 返回上述对象，或抛出带 `code` 的错误（unsupported_format / parse_missing / access_blocked）。保守解析本车明确结构数据，不猜测公开页面没有的报告；真实页面未经运行验证的适配器必须说明。
- `normalize.mjs`：导出 `normalizeRecord` 与 `recordHash`。同一事实不同 fetchedAt 的内容 hash 相同；source method 与授权编号属于事实来源，参与 hash。
- `database.mjs`：`connectDatabase()` 返回 `{query(text,values): {rows}, exec(text), transaction(callback), close()}`；交易中的 callback 接收同样 query/exec 接口。
- `repository.mjs`：`migrate(db)`；`ingestRecord(db, normalizedRecord, {jobId=null}={})` 返回 `{listingId,snapshotId,changed}`；`listListings(db,{limit=20,offset=0,platform=null}={})` 返回数组；`getListing(db,id)` 返回详情或 null；`startJob(db,{platform,url,mode})` 返回 job ID；`finishJob(db,id,{status,code=null,message=null,listingId=null})`；`listJobs(db,{limit=20}={})`。

车源按 platform+externalId 唯一，不因同车型、价格或脱敏 VIN 合并。每次成功抓取更新 last_seen_at，事实变化才产生快照。详情返回最新完整标准对象及 listingId、snapshotId、firstSeenAt、lastSeenAt；每份快照单独保存其记录与 coverage，避免旧报告错挂最新车源。历史不被覆盖删除。较旧 fetchedAt 不得覆盖较新的当前状态。作业状态 running / succeeded / failed，不在日志保存原始页面、Cookie、联系方式或数据库密码。

## 本次验收

公开 URL 校验、robots 尊重、限速/超时/体积上限/重定向校验；失败不生成伪车辆；归一化未知与缺失；授权记录校验；PostgreSQL 约束、事务回滚、重复导入与新旧快照顺序；只读分页 API；回归已有 33 项前端领域测试。数据库无可用服务时明确区分 PostgreSQL WASM 测试与真实服务联调。
