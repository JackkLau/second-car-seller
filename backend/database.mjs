import postgres from "postgres";

function adapter(sql) {
  return {
    async query(text, values = []) {
      return { rows: await sql.unsafe(text, values) };
    },
    async exec(text) {
      await sql.unsafe(text).simple();
    },
    async transaction(callback) {
      return sql.begin((tx) => callback(adapter(tx)));
    },
  };
}

export function connectDatabase(env = process.env) {
  if (!env.DATABASE_URL)
    throw Object.assign(new Error("请在 backend/.env 配置 DATABASE_URL"), {
      code: "database_unconfigured",
    });
  let url;
  try {
    url = new URL(env.DATABASE_URL);
  } catch {
    throw new Error("DATABASE_URL 格式无效");
  }
  if (!["postgres:", "postgresql:"].includes(url.protocol))
    throw new Error("DATABASE_URL 必须为 PostgreSQL 连接地址");
  // Driver handles sslmode in the URL. Never disable certificate validation.
  const sql = postgres(env.DATABASE_URL, {
    max: 5,
    connect_timeout: 10,
    idle_timeout: 20,
    onnotice: () => {},
  });
  return { ...adapter(sql), close: () => sql.end({ timeout: 5 }) };
}
