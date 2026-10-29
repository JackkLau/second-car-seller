import { fetchPublicPage } from "./fetcher.mjs";
import { parsePublicPage } from "./parsers.mjs";
import { normalizeRecord } from "./normalize.mjs";
import { validateSourceUrl } from "./sources.mjs";
import { startJob, finishJob, ingestRecord } from "./repository.mjs";
import { publicFailure } from "./errors.mjs";

export async function collectPublic({
  platform,
  url,
  fetchPage = fetchPublicPage,
}) {
  const canonical = validateSourceUrl(platform, url);
  const page = await fetchPage({ platform, url: canonical });
  return normalizeRecord(parsePublicPage({ ...page, platform }));
}

export async function ingestPublic(
  db,
  { platform, url, fetchPage = fetchPublicPage },
) {
  const canonical = validateSourceUrl(platform, url);
  const jobId = await startJob(db, {
    platform,
    url: canonical,
    mode: "public_page",
  });
  try {
    const record = await collectPublic({ platform, url: canonical, fetchPage });
    const result = await ingestRecord(db, record, { jobId });
    await finishJob(db, jobId, {
      status: "succeeded",
      listingId: result.listingId,
    });
    return { jobId, ...result };
  } catch (error) {
    await finishJob(db, jobId, { status: "failed", ...publicFailure(error) });
    throw error;
  }
}

export async function importRecord(db, input) {
  const record = normalizeRecord(input);
  // A saved JSON document is an explicit operator import, never proof that our
  // crawler ran. Live public_page evidence is created only by ingestPublic.
  if (!["manual_capture", "authorized_import"].includes(record.source.method)) {
    throw Object.assign(
      new Error("文件导入须使用 manual_capture 或 authorized_import"),
      { code: "invalid_record" },
    );
  }
  const jobId = await startJob(db, {
    platform: record.source.platform,
    url: record.source.url,
    mode: record.source.method,
  });
  try {
    const result = await ingestRecord(db, record, { jobId });
    await finishJob(db, jobId, {
      status: "succeeded",
      listingId: result.listingId,
    });
    return { jobId, ...result };
  } catch (error) {
    await finishJob(db, jobId, { status: "failed", ...publicFailure(error) });
    throw error;
  }
}
