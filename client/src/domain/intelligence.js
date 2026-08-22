// S4 design reminder: Explainable Arabic RTL opportunity intelligence is deterministic, derived from shared signals, and never creates CRM records or calls an AI provider.
import { businesses, getAttributionIntegrityReport, getDiscoveryIntegrityReport, getDiscoveryJob, getDiscoverySource, mockModel, scraperCrmPackages, scraperExportColumns, state } from "./data.js";

export const SCORING_VERSION = "S4-MOCK-v1";
export const dimensionContract = [
  { key:"activity", label:"قوة النشاط", max:25 },
  { key:"digitalOpportunity", label:"الفرصة الرقمية", max:30 },
  { key:"reachability", label:"قابلية التواصل", max:20 },
  { key:"serviceFit", label:"ملاءمة الخدمة", max:15 },
  { key:"dataQuality", label:"جودة البيانات", max:10 }
];

export const analysisStatusLabels = { not_analyzed:"لم تُحلل", analyzing:"جارٍ التحليل", analyzed:"تم التحليل", analysis_error:"تعذر التحليل", insufficient_data:"بيانات غير كافية" };
export const tierLabels = { high:"فرصة عالية", good:"فرصة جيدة", medium:"فرصة متوسطة", low:"فرصة منخفضة" };
export const intelligenceProcessingStages = [
  "قراءة بيانات النشاط",
  "تحليل السمعة والتقييمات",
  "فحص الحضور الرقمي",
  "تحليل قابلية التواصل",
  "اكتشاف فجوات النمو",
  "مطابقة الخدمات المناسبة",
  "حساب درجة الفرصة"
];

const byId = (items, id) => items.find((item) => item.id === id);
const duplicateIds = (items) => items.map((item) => item.id).filter((id, index, values) => values.indexOf(id) !== index);
const clamp = (value, minimum, maximum) => Math.max(minimum, Math.min(maximum, value));

export function getOpportunityTier(score) {
  if (score >= 80) return "high";
  if (score >= 65) return "good";
  if (score >= 40) return "medium";
  return "low";
}

export function getBusinessSignals(businessId) { return mockModel.signals.filter((signal) => signal.businessId === businessId); }
export function getOpportunityAnalysis(businessId) { return mockModel.opportunityAnalyses.find((analysis) => analysis.businessId === businessId); }
export function getOpportunity(businessId) { return mockModel.opportunities.find((opportunity) => opportunity.businessId === businessId); }
export function getIntelligenceStatus(businessId) { return getOpportunityAnalysis(businessId)?.status || "not_analyzed"; }

function dimensionsFor(signals) {
  return dimensionContract.map((dimension) => ({ ...dimension, score:signals.filter((signal) => signal.dimension === dimension.key).reduce((total, signal) => total + signal.points, 0) }));
}

function servicesFor(signals) {
  const gaps = new Set(signals.filter((signal) => signal.polarity === "gap" && signal.gapCode).map((signal) => signal.gapCode));
  return mockModel.serviceCatalog.filter((service) => service.gapCodes.some((gapCode) => gaps.has(gapCode))).map((service) => ({ ...service, signalIds:signals.filter((signal) => service.gapCodes.includes(signal.gapCode)).map((signal) => signal.id) }));
}

function reasonText(signal) {
  if (signal.polarity === "gap") return `فجوة: ${signal.value}`;
  if (signal.polarity === "positive") return `إشارة داعمة: ${signal.value}`;
  if (signal.polarity === "unknown") return `إشارة غير مكتملة: ${signal.value}`;
  return signal.value;
}

function approachFor(services, signals) {
  const gaps = new Set(signals.filter((signal) => signal.polarity === "gap").map((signal) => signal.gapCode));
  if (gaps.has("manual_booking") || gaps.has("missing_whatsapp") || gaps.has("appointment_friction")) return "ابدأ بمناقشة تقليل زمن الاستجابة وتحويل الاستفسارات إلى حجز ومتابعة أوضح، بدل تقديم الحل كأداة منفصلة.";
  if (gaps.has("weak_website")) return "ابدأ بمناقشة تحويل زوار الموقع إلى طلبات واضحة، ثم اربط الحاجة بتحسين تجربة الموقع.";
  if (gaps.has("weak_visibility")) return "ابدأ بسؤال عن أثر الظهور الرقمي على الطلبات الحالية، ثم اربط الحل بمصدر قياس واضح.";
  if (!services.length) return "لا تبدأ بعرض خدمة محددة؛ لا توجد فجوة مثبتة تستدعي أولوية مبيعات أعلى.";
  return "ابدأ بفهم أثر الفجوة التشغيلية قبل ربطها بالخدمة المقترحة.";
}

export function getBusinessIntelligence(businessId) {
  const business = byId(businesses, businessId);
  if (!business) return null;
  const analysis = getOpportunityAnalysis(businessId);
  const signals = getBusinessSignals(businessId);
  const status = analysis?.status || "not_analyzed";
  const dimensions = dimensionsFor(signals);
  const score = status === "analyzed" ? dimensions.reduce((total, dimension) => total + dimension.score, 0) : null;
  const tier = score === null ? null : getOpportunityTier(score);
  const opportunity = getOpportunity(businessId);
  const services = status === "analyzed" ? servicesFor(signals) : [];
  const job = getDiscoveryJob(business.discoveryJobId);
  const source = job && getDiscoverySource(job.sourceId);
  const reasonSignals = opportunity?.reasonSignalIds?.map((id) => byId(mockModel.signals, id)).filter(Boolean) || signals.filter((signal) => signal.polarity === "gap");
  return {
    business, analysis, opportunity, signals, dimensions, score, tier, status, confidence:analysis?.confidence ?? 0,
    services, reasons:reasonSignals.map((signal) => ({ ...signal, text:reasonText(signal) })),
    positives:signals.filter((signal) => signal.polarity === "positive"),
    salesApproach:opportunity?.salesApproach || approachFor(services, signals), job, source,
    provenance:[source?.id, job?.id, business.id, ...(signals.map((signal) => signal.id)), analysis?.id, opportunity?.id].filter(Boolean)
  };
}

export function getIntelligenceSummary(businessIds) {
  const records = businessIds.map(getBusinessIntelligence).filter(Boolean);
  return {
    total:records.length,
    analyzed:records.filter((record) => record.status === "analyzed").length,
    high:records.filter((record) => record.tier === "high").length,
    good:records.filter((record) => record.tier === "good").length,
    insufficient:records.filter((record) => record.status === "insufficient_data").length
  };
}

export function beginBusinessAnalysis(businessId) {
  const analysis = getOpportunityAnalysis(businessId);
  if (!analysis || analysis.status === "insufficient_data") return null;
  analysis.status = "analyzing";
  return analysis;
}

export function completeBusinessAnalysis(businessId) {
  const analysis = getOpportunityAnalysis(businessId);
  if (!analysis || analysis.status === "insufficient_data") return null;
  analysis.status = "analyzed";
  analysis.scoringVersion = SCORING_VERSION;
  analysis.analyzedAt = "2026-08-15T12:25:00";
  if (!getOpportunity(businessId)) {
    const numericId = businessId.split("-")[1];
    const signals = getBusinessSignals(businessId);
    const services = servicesFor(signals);
    mockModel.opportunities.push({ id:`OPP-${numericId}`, analysisId:analysis.id, businessId, status:"open", reasonSignalIds:signals.filter((signal) => signal.polarity === "gap").map((signal) => signal.id), salesApproach:approachFor(services, signals) });
  }
  return getBusinessIntelligence(businessId);
}

export function getIntelligenceIntegrityReport() {
  const checks = [];
  const add = (id, name, pass, detail) => checks.push({ id, name, pass, detail });
  const analyses = mockModel.opportunityAnalyses;
  const signals = mockModel.signals;
  const opportunities = mockModel.opportunities;
  add("A", "Signal Ownership", signals.every((signal) => Boolean(byId(businesses, signal.businessId))), "كل Signal تشير إلى Business موجودة");
  add("B", "Analysis Ownership", analyses.every((analysis) => Boolean(byId(businesses, analysis.businessId))), "كل Analysis تشير إلى Business موجودة");
  add("C", "Signal References", analyses.every((analysis) => analysis.signalIds.every((id) => { const signal = byId(signals, id); return signal && signal.businessId === analysis.businessId; })), "كل signalIds تعود لنفس Business");
  add("D", "Score Math", analyses.filter((analysis) => analysis.status === "analyzed").every((analysis) => { const record = getBusinessIntelligence(analysis.businessId); return record.dimensions.reduce((sum, dimension) => sum + dimension.score, 0) === record.score; }), "مجموع dimensions يساوي Score");
  add("E", "Score Bounds", analyses.filter((analysis) => analysis.status === "analyzed").every((analysis) => { const score = getBusinessIntelligence(analysis.businessId).score; return score >= 0 && score <= 100; }), "كل Score ضمن 0–100");
  add("F", "Tier Mapping", analyses.filter((analysis) => analysis.status === "analyzed").every((analysis) => { const record = getBusinessIntelligence(analysis.businessId); return record.tier === getOpportunityTier(record.score); }), "Tier مشتقة من Score");
  add("G", "Confidence Bounds", analyses.every((analysis) => analysis.confidence >= 0 && analysis.confidence <= 1), "Confidence ضمن 0–1");
  add("H", "Unknown Handling", analyses.filter((analysis) => analysis.status === "insufficient_data").every((analysis) => { const record = getBusinessIntelligence(analysis.businessId); return record.score === null && record.signals.every((signal) => signal.polarity === "unknown" || signal.points === 0); }), "Unknown لا تتحول إلى negative score");
  add("I", "Service Evidence", opportunities.every((opportunity) => { const record = getBusinessIntelligence(opportunity.businessId); return record.services.every((service) => service.signalIds.length > 0); }), "كل خدمة مشتقة من Gap Signal");
  add("J", "Discovery Provenance", analyses.every((analysis) => { const business = byId(businesses, analysis.businessId); const job = business && getDiscoveryJob(business.discoveryJobId); return Boolean(job && getDiscoverySource(job.sourceId)); }), "Business → Job → Source موجودة");
  add("K", "Analysis Stability", analyses.filter((analysis) => analysis.status === "analyzed").every((analysis) => { const first = getBusinessIntelligence(analysis.businessId); const second = getBusinessIntelligence(analysis.businessId); return first.score === second.score && first.tier === second.tier && JSON.stringify(first.reasons.map((reason) => reason.id)) === JSON.stringify(second.reasons.map((reason) => reason.id)); }), "نفس المدخلات تعطي النتيجة نفسها");
  add("L", "S3 Lifecycle Regression", getDiscoveryIntegrityReport().pass, "Results lifecycle محفوظة");
  add("M", "S3 Date Regression", ["JOB-1028","JOB-1030"].every((id) => getDiscoveryJob(id)?.createdAt?.startsWith("2026-08-15")), "Jobs اليوم تبقى قابلة للتطابق بالـmachine date");
  const attribution = getAttributionIntegrityReport();
  add("N", "S2 Attribution Regression", attribution.pass && attribution.attributionTotal - attribution.revenueSummary === 0, "Attributed Revenue − Revenue Summary = 0");
  add("O", "Unique IDs", [signals, analyses, opportunities].every((items) => duplicateIds(items).length === 0), "Signal / Analysis / Opportunity IDs فريدة");
  return { pass:checks.every((check) => check.pass), checks };
}

export function openIntelligenceBusiness(businessId) {
  state.selectedBusinessId = businessId;
  return getBusinessIntelligence(businessId);
}

const fmt = (value) => new Intl.NumberFormat("ar-SA").format(value ?? 0);
const percent = (value) => `${Math.round((value || 0) * 100)}%`;
const statusTone = (status) => ({ analyzed:"success", analyzing:"info", not_analyzed:"neutral", analysis_error:"danger", insufficient_data:"warning" }[status] || "neutral");
const tierTone = (tier) => ({ high:"success", good:"info", medium:"warning", low:"neutral" }[tier] || "neutral");
const mono = (value) => `<span class="mono ltr">${value}</span>`;

function statusBadge(status) { return `<span class="status s4-analysis-status ${statusTone(status)}">${analysisStatusLabels[status] || status}</span>`; }
function scoreDisplay(record) { return record.score === null ? `<span class="score-missing">—<small>غير متاح</small></span>` : `<span class="score-cell ${record.tier}"><b>${record.score}</b><small>${tierLabels[record.tier]}</small></span>`; }
function decisionRail(stage, job, source) { const current = stage === "results" ? 1 : 2; const steps=[{label:"بحث",detail:"طلب ومصدر"},{label:"نتائج",detail:"سجلات مكتشفة"},{label:"ذكاء",detail:"دليل وقرار"},{label:"وجهة",detail:"Excel أو CRM"}]; return `<section class="s4-decision-rail" aria-label="سكة قرار نمو"><div class="s4-rail-brand"><span class="s4-orbit-mark"><i></i><i></i><i></i></span><span><b>نمو</b><small>سكة القرار</small></span></div><ol>${steps.map((item,index)=>`<li class="${index < current ? "done" : ""} ${index === current ? "active" : ""}"><i>${String(index+1).padStart(2,"0")}</i><span><b>${item.label}</b><small>${item.detail}</small></span></li>`).join("")}</ol><div class="s4-rail-context"><span>السجل الحالي</span><b>${mono(job?.id || "—")}${source ? ` · ${source.name}` : ""}</b></div></section>`; }

function filteredRecords(jobId) {
  const filters = state.resultFilters;
  const job = getDiscoveryJob(jobId);
  const records = (job?.resultBusinessIds || []).map(getBusinessIntelligence).filter(Boolean);
  const rows = records.filter((record) => {
    const business = record.business;
    const text = `${business.name} ${business.category} ${business.city}`;
    const hasGap = record.signals.some((signal) => signal.gapCode === filters.gap);
    return (!filters.search || text.includes(filters.search))
      && (filters.category === "all" || business.category === filters.category)
      && (filters.city === "all" || business.city === filters.city)
      && (filters.rating === "all" || (business.rating ?? 0) >= Number(filters.rating))
      && (filters.reviews === "all" || (business.reviews ?? 0) >= Number(filters.reviews))
      && (filters.website === "all" || (filters.website === "yes" ? Boolean(business.website) : !business.website))
      && (filters.phone === "all" || (filters.phone === "yes" ? Boolean(business.phone) : !business.phone))
      && (filters.opportunityTier === "all" || (filters.opportunityTier === "not_analyzed" ? ["not_analyzed","insufficient_data"].includes(record.status) : record.tier === filters.opportunityTier))
      && (filters.minScore === "all" || (record.score !== null && record.score >= Number(filters.minScore)))
      && (filters.confidence === "all" || record.confidence >= Number(filters.confidence))
      && (filters.gap === "all" || hasGap)
      && (filters.intelligenceStatus === "all" || record.status === filters.intelligenceStatus)
      && (!filters.highOpportunity || record.score >= 80);
  });
  const sorters = {
    score:(a,b) => (b.score ?? -1) - (a.score ?? -1),
    confidence:(a,b) => b.confidence - a.confidence,
    reviews:(a,b) => (b.business.reviews ?? -1) - (a.business.reviews ?? -1),
    rating:(a,b) => (b.business.rating ?? -1) - (a.business.rating ?? -1),
    name:(a,b) => a.business.name.localeCompare(b.business.name, "ar"),
    newest:() => 0
  };
  return [...rows].sort(sorters[filters.sort] || sorters.newest);
}

function intelligenceFilterControls(jobId, records) {
  const filters = state.resultFilters;
  const categories = [...new Set(records.map((record) => record.business.category))];
  const cities = [...new Set(records.map((record) => record.business.city))];
  return `<div class="results-filter-grid s4-filter-grid"><label class="search-field"><span>⌕</span><input data-result-filter="search" value="${filters.search}" placeholder="ابحث في الشركة أو النشاط أو المدينة"/></label><select data-result-filter="opportunityTier"><option value="all">كل مستويات الفرصة</option><option value="high">فرصة عالية</option><option value="good">فرصة جيدة</option><option value="medium">فرصة متوسطة</option><option value="low">فرصة منخفضة</option><option value="not_analyzed">غير محللة / غير كافية</option></select><select data-result-filter="minScore"><option value="all">أي درجة</option><option value="80">80+ نقطة</option><option value="65">65+ نقطة</option><option value="40">40+ نقطة</option></select><select data-result-filter="confidence"><option value="all">أي ثقة</option><option value="0.8">80%+ ثقة</option><option value="0.7">70%+ ثقة</option><option value="0.5">50%+ ثقة</option></select><select data-result-filter="gap"><option value="all">كل الفجوات</option><option value="weak_website">الموقع</option><option value="weak_visibility">الظهور</option><option value="manual_booking">الحجز اليدوي</option><option value="missing_whatsapp">واتساب</option></select><select data-result-filter="intelligenceStatus"><option value="all">كل حالات التحليل</option><option value="analyzed">تم التحليل</option><option value="not_analyzed">لم تُحلل</option><option value="analyzing">جارٍ التحليل</option><option value="insufficient_data">بيانات غير كافية</option></select><select data-result-filter="sort"><option value="newest">الأحدث اكتشافًا</option><option value="score">أعلى درجة فرصة</option><option value="confidence">أعلى ثقة</option><option value="reviews">الأكثر مراجعات</option><option value="rating">الأعلى تقييمًا</option><option value="name">الاسم</option></select></div><div class="s4-secondary-filter-row"><button type="button" class="button ${filters.highOpportunity ? "primary" : "ghost"}" data-intelligence-action="toggle-high-opportunity">أفضل الفرص <span>80+ نقطة</span></button><select data-result-filter="category"><option value="all">كل الأنشطة</option>${categories.map((category) => `<option value="${category}" ${filters.category === category ? "selected" : ""}>${category}</option>`).join("")}</select><select data-result-filter="city"><option value="all">كل المدن</option>${cities.map((city) => `<option value="${city}" ${filters.city === city ? "selected" : ""}>${city}</option>`).join("")}</select><small>الفلاتر تخص العينة المحمّلة فقط من ${mono(jobId)}.</small></div>`;
}

function summaryCards(job, records) {
  const summary = getIntelligenceSummary(records.map((record) => record.business.id));
  return `<section class="s4-opportunity-summary" aria-label="ملخص ذكاء النتائج"><article><span>ملخص Job</span><b>${fmt(job.deduplicatedCount)}</b><small>نتيجة نهائية في العملية</small></article><article><span>العينة المحمّلة</span><b>${fmt(summary.total)}</b><small>سجلات Business ظاهرة</small></article><article><span>تم تحليلها</span><b>${fmt(summary.analyzed)}</b><small>تحليل حتمي محلي</small></article><article><span>فرص عالية</span><b>${fmt(summary.high)}</b><small>درجة 80 فأعلى</small></article><article><span>فرص جيدة</span><b>${fmt(summary.good)}</b><small>درجة 65–79</small></article><article><span>بيانات غير كافية</span><b>${fmt(summary.insufficient)}</b><small>بلا درجة مضللة</small></article></section>`;
}

function analysisAction(record) {
  const id = record.business.id;
  if (record.status === "analyzing") return `<button type="button" class="button compact" disabled>جارٍ التحليل…</button>`;
  if (["not_analyzed","analysis_error"].includes(record.status)) return `<button type="button" class="button compact primary" data-intelligence-action="analyze-one" data-business="${id}">${record.status === "analysis_error" ? "إعادة محاولة التحليل" : "تحليل الفرصة"}</button>`;
  if (record.status === "insufficient_data") return `<button type="button" class="button compact" data-route="intelligence?business=${id}" data-business="${id}">عرض سبب عدم الكفاية</button>`;
  return `<div class="s5-results-actions"><button type="button" class="button compact" data-route="intelligence?business=${id}" data-business="${id}">فتح الذكاء</button><button type="button" class="button compact ghost" data-crm-action="open-conversion" data-business="${id}">إضافة إلى CRM</button></div>`;
}


function dimensionRows(record) { return record.dimensions.map((dimension) => `<div><span>${dimension.label}</span><b>${dimension.score} <small>/ ${dimension.max}</small></b></div>`).join(""); }
function signalCard(signal) { const tone = signal.polarity === "gap" ? "gap" : signal.polarity === "positive" ? "positive" : signal.polarity === "unknown" ? "unknown" : "neutral"; return `<article class="s4-signal-card ${tone}"><header><span>${signal.polarity === "gap" ? "فجوة مثبتة" : signal.polarity === "positive" ? "إشارة داعمة" : signal.polarity === "unknown" ? "بيانات غير معروفة" : "سياق محايد"}</span><b>${signal.value}</b></header><p>${signal.key.replaceAll("_", " ")}</p><button type="button" class="button ghost compact" data-intelligence-action="open-evidence" data-signal="${signal.id}">عرض الدليل</button></article>`; }



function processingStageList(processing) {
  return `<ol class="s4-processing-stage-list">${processing.stages.map((label, index) => {
    const phase = index < processing.stageIndex ? "completed" : index === processing.stageIndex && processing.phase === "stages" ? "processing" : "pending";
    const mark = phase === "completed" ? "✓" : phase === "processing" ? "◉" : "○";
    return `<li class="${phase}"><i>${mark}</i><span>${label}</span><small>${phase === "completed" ? "مكتملة" : phase === "processing" ? "جارٍ التحليل" : "بانتظار الدور"}</small></li>`;
  }).join("")}</ol>`;
}

function processingBatchList(processing) {
  if (processing.mode !== "batch") return "";
  return `<section class="s4-batch-list"><header><b>تحليل ${fmt(processing.ids.length)} شركات</b><span>${fmt(processing.completedIds.length)} / ${fmt(processing.ids.length)} مكتملة</span></header><div>${processing.ids.map((id) => {
    const record = getBusinessIntelligence(id);
    const phase = processing.insufficientIds.includes(id) ? "insufficient" : processing.completedIds.includes(id) ? "completed" : processing.currentId === id ? "processing" : "pending";
    const label = phase === "completed" ? "مكتملة" : phase === "processing" ? "جارٍ التحليل" : phase === "insufficient" ? "بيانات غير كافية" : "بانتظار الدور";
    return `<article class="${phase}"><i>${phase === "completed" ? "✓" : phase === "processing" ? "◉" : phase === "insufficient" ? "?" : "○"}</i><span>${record?.business.name || id}</span><small>${label}</small></article>`;
  }).join("")}</div></section>`;
}

function processingReveal(processing) {
  const record = getBusinessIntelligence(processing.primaryId);
  if (processing.mode === "batch" && ["recommendations", "complete"].includes(processing.phase)) {
    const records = processing.ids.map(getBusinessIntelligence).filter(Boolean);
    const count = (predicate) => records.filter(predicate).length;
    return `<section class="s4-processing-outcome batch-complete"><span class="status success">اكتمل التحليل</span><h3>${fmt(processing.ids.length)} شركات تم تحليلها أو فحصها ضمن الدفعة.</h3><div class="s4-batch-summary"><span><b>${fmt(count((item) => item.tier === "high"))}</b> فرص عالية</span><span><b>${fmt(count((item) => item.tier === "good"))}</b> فرص جيدة</span><span><b>${fmt(count((item) => item.tier === "medium"))}</b> فرص متوسطة</span><span><b>${fmt(count((item) => item.tier === "low"))}</b> فرص منخفضة</span><span><b>${fmt(count((item) => item.status === "insufficient_data"))}</b> بيانات غير كافية</span></div><p>جميع الأعداد مشتقة من Business الظاهرة ونتائج Intelligence الحالية، وليست أرقام عرض مستقلة.</p></section>`;
  }
  if (!record || processing.outcome === "insufficient") return `<section class="s4-processing-outcome insufficient"><span class="status warning">بيانات غير كافية</span><h3>فحص اكتمال البيانات لم يجد أدلة كافية لمنح درجة.</h3><p>لم تتغير Signals أو Score؛ تظهر البيانات غير المعروفة بصفتها غير معروفة فقط.</p></section>`;
  if (processing.phase === "stages") return "";
  const score = Math.round((record.score || 0) * (processing.revealScore ?? 0));
  const confidence = Math.round((record.confidence || 0) * 100 * (processing.revealConfidence ?? 0));
  const showTier = ["tier", "confidence", "signals", "recommendations", "complete"].includes(processing.phase);
  const showConfidence = ["confidence", "signals", "recommendations", "complete"].includes(processing.phase);
  const signalCount = processing.phase === "signals" ? processing.revealedSignals || 1 : ["recommendations", "complete"].includes(processing.phase) ? record.signals.length : 0;
  const showRecommendations = ["recommendations", "complete"].includes(processing.phase);
  return `<section class="s4-processing-reveal" aria-label="كشف نتيجة التحليل"><div class="s4-processing-score"><b>${score}</b><span>من 100</span></div><div class="s4-processing-result-copy">${showTier ? `<strong>${tierLabels[record.tier]}</strong>` : `<strong>حساب الدرجة من الإشارات</strong>`}${showConfidence ? `<span>الثقة ${confidence}%</span>` : `<span>النتيجة مشتقة من Intelligence Engine</span>`}</div>${signalCount ? `<div class="s4-reveal-signals">${record.signals.slice(0, signalCount).map((signal) => `<span class="${signal.polarity}">${signal.polarity === "gap" ? "!" : signal.polarity === "positive" ? "✓" : "?"} ${signal.value}</span>`).join("")}</div>` : ""}${showRecommendations ? `<div class="s4-reveal-recommendations"><span>الفجوة الرئيسية: <b>${record.reasons[0]?.value || "لا توجد فجوة مثبتة"}</b></span><span>الخدمة المقترحة: <b>${record.services[0]?.name || "لا توجد خدمة مقترحة"}</b></span><span>أسلوب التواصل جاهز للمراجعة</span></div>` : ""}</section>`;
}



