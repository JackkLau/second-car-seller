import { readFile, stat } from "node:fs/promises";
import { connectDatabase } from "./database.mjs";
import { migrate } from "./repository.mjs";
import { collectPublic, ingestPublic, importRecord } from "./ingestion.mjs";
import { normalizeRecord, assertObservationTime } from "./normalize.mjs";
import { SOURCES } from "./sources.mjs";
import { publicFailure } from "./errors.mjs";

const usage = `用法（在 backend 目录运行）：
  node --env-file-if-exists=.env cli.mjs sources
  node --env-file-if-exists=.env cli.mjs migrate
  node --env-file-if-exists=.env cli.mjs fetch <platform> <详情URL> [--dry-run]
  node --env-file-if-exists=.env cli.mjs import <标准JSON文件> [--dry-run]
  --dry-run 只抓取/校验并输出标准资料，不连接或写入数据库。`;

let db;
try {
  const [command, ...raw] = process.argv.slice(2);
  const dry = raw.includes("--dry-run");
  const args = raw.filter((x) => x !== "--dry-run");
  if (command === "sources" && args.length === 0)
    console.log(JSON.stringify(SOURCES, null, 2));
  else if (command === "migrate" && args.length === 0 && !dry) {
    db = connectDatabase();
    await migrate(db);
    console.log(JSON.stringify({ status: "migrated" }));
  } else if (command === "fetch" && args.length === 2) {
    const [platform, url] = args;
    if (dry)
      console.log(
        JSON.stringify(await collectPublic({ platform, url }), null, 2),
      );
    else {
      db = connectDatabase();
      console.log(JSON.stringify(await ingestPublic(db, { platform, url })));
    }
  } else if (command === "import" && args.length === 1) {
    if ((await stat(args[0])).size > 2 * 1024 * 1024)
      throw Object.assign(new Error("资料文件超过2MB"), {
        code: "response_too_large",
      });
    const record = normalizeRecord(JSON.parse(await readFile(args[0], "utf8")));
    assertObservationTime(record);
    if (!["manual_capture", "authorized_import"].includes(record.source.method))
      throw Object.assign(new Error("不允许以文件冒充抓取"), {
        code: "invalid_record",
      });
    if (dry) console.log(JSON.stringify(record, null, 2));
    else {
      db = connectDatabase();
      console.log(JSON.stringify(await importRecord(db, record)));
    }
  } else {
    console.error(usage);
    process.exitCode = 2;
  }
} catch (error) {
  console.error(JSON.stringify(publicFailure(error)));
  process.exitCode = 1;
} finally {
  if (db) await db.close();
}
