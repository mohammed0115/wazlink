/**
 * يولّد لقطات نصية من مصادر React ليقرأها فحص النزاهة.
 *
 * بعد حذف طبقة Vanilla لم تعد التأكيدات النصية تجد قوالب HTML، فصارت
 * تقرأ مصادر المكوّنات المقابلة. يعيد هذا السكربت بناء اللقطات قبل الفحص.
 */
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";

const SRC = new URL("../../client/src/", import.meta.url);
const OUT = new URL("../../.ui-sources/", import.meta.url);

async function walk(dir) {
  const out = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const child = new URL(`${entry.name}${entry.isDirectory() ? "/" : ""}`, dir);
    if (entry.isDirectory()) out.push(...(await walk(child)));
    else if (/\.(tsx?|ts)$/.test(entry.name)) out.push(child);
  }
  return out;
}

const read = async (urls) => (await Promise.all(urls.map((u) => readFile(u, "utf8")))).join("\n");

await mkdir(OUT, { recursive: true });

const all = (await walk(SRC)).filter((u) => !u.pathname.includes("/domain/"));
await writeFile(new URL("all.txt", OUT), await read(all), "utf8");

for (const feature of await readdir(new URL("features/", SRC))) {
  const files = await walk(new URL(`features/${feature}/`, SRC));
  await writeFile(new URL(`${feature}.txt`, OUT), await read(files), "utf8");
}

// أسماء متوافقة مع الفحوص التاريخية
const alias = {
  "payment-checkout.txt": "settings",
  "scraper-reference.txt": "landing",
  "pipeline.txt": "sales",
};
for (const [name, feature] of Object.entries(alias)) {
  const files = await walk(new URL(`features/${feature}/`, SRC));
  await writeFile(new URL(name, OUT), await read(files), "utf8");
}
