/**
 * قارئ مصادر طبقة العرض (React).
 *
 * بعد حذف طبقة Vanilla، صارت فحوص النزاهة تتحقق من ترميز React بدل
 * قوالب HTML النصية. هذا المساعد يوفر نصوص المصادر لتلك التأكيدات
 * من دون أن يعرف كل فحص بنية المجلدات.
 */
import { readFile, readdir } from "node:fs/promises";

const SRC = new URL("../../client/src/", import.meta.url);

async function walk(dir) {
  const out = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const child = new URL(`${entry.name}${entry.isDirectory() ? "/" : ""}`, dir);
    if (entry.isDirectory()) out.push(...(await walk(child)));
    else if (/\.(tsx?|ts)$/.test(entry.name)) out.push(child);
  }
  return out;
}

/** كل مصادر طبقة العرض مدمجة — يقابل `appSource` في فحوص V1. */
export async function readUiSource() {
  const files = (await walk(SRC)).filter((url) => !url.pathname.includes("/domain/"));
  return (await Promise.all(files.map((url) => readFile(url, "utf8")))).join("\n");
}

/** مصادر ميزة واحدة، مثل `dashboard` أو `inbox` أو `settings`. */
export async function readFeature(name) {
  const dir = new URL(`features/${name}/`, SRC);
  const files = await walk(dir);
  return (await Promise.all(files.map((url) => readFile(url, "utf8")))).join("\n");
}

/** مصدر مشترك واحد بالمسار النسبي من `client/src`. */
export async function readSrc(relative) {
  return readFile(new URL(relative, SRC), "utf8");
}

/**
 * يزيل التعليقات قبل مسح الحدود.
 *
 * بوابات «لا نقل خارجي» تفحص **الكود** لا النثر؛ وتعليق توثيقي يقول
 * «لا Meta/Twilio» يجب ألا يُقرأ كاستخدام لها.
 */
export function stripComments(source) {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .replace(/(^|[^:])\/\/.*$/gm, "$1");
}
