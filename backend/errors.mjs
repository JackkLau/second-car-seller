const MESSAGES = {
  invalid_record: "车辆资料不符合标准输入，请核对字段、日期、来源及授权编号。",
  invalid_url: "仅支持配置中的平台 HTTPS 车辆详情地址。",
  invalid_source_url: "仅支持配置中的平台 HTTPS 车辆详情地址。",
  invalid_request: "抓取参数无效。",
  unsupported_source: "未配置该数据来源。",
  unsupported_format: "页面格式暂不支持，未导入车辆。",
  parse_missing: "未找到可明确归属本车的必要字段，未导入车辆。",
  access_blocked: "上游访问受限或需要验证，抓取已停止。",
  robots_denied: "来源 robots 规则禁止该路径，抓取已停止。",
  robots_unavailable: "无法确认来源 robots 规则，抓取已停止。",
  rate_limited: "上游要求限流，抓取已停止。",
  timeout: "请求超时，未自动重试。",
  fetch_timeout: "请求超时，未自动重试。",
  response_too_large: "响应超过大小上限，抓取已停止。",
  network_error: "网络连接失败；检查 DNS 与网络后手动重试。",
  unsafe_redirect: "重定向超出允许的详情地址，抓取已停止。",
  redirect_rejected: "重定向超出允许的本车详情地址，抓取已停止。",
  http_error: "上游未返回可用页面，未导入车辆。",
  database_unconfigured: "尚未配置 DATABASE_URL。",
};
export function publicFailure(error) {
  const code = Object.hasOwn(MESSAGES, error?.code)
    ? error.code
    : "operation_failed";
  return {
    code,
    message:
      MESSAGES[code] ?? "操作失败；请检查数据库服务、迁移状态与输入配置。",
  };
}
