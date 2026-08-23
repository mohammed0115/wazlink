/**
 * محاكاة تحليل الفرص — S4-UX.
 *
 * منقولة عن `runIntelligenceSimulation()` في V1 بنفس المراحل والتوقيتات:
 * مراحل → كشف الدرجة → الثقة → الإشارات → التوصيات → اكتمال.
 * تحترم `prefers-reduced-motion` كما تفرض قواعد S8.
 * التحليل نفسه حتمي ويأتي من `completeBusinessAnalysis`؛ الأنيميشن عرض فقط.
 */
import {  getUiState } from "@services";
import { beginBusinessAnalysis, completeBusinessAnalysis, intelligenceProcessingStages } from "@domain/intelligence.js";
import { notifyStateChanged } from "../../shared/store/appStore";

export type ProcessingState = {
  mode: "single" | "batch";
  ids: string[];
  eligibleIds: string[];
  insufficientIds: string[];
  completedIds: string[];
  currentId: string;
  primaryId: string;
  stages: string[];
  stageIndex: number;
  phase: "stages" | "score" | "confidence" | "signals" | "recommendations" | "complete";
  outcome: "analysis" | "insufficient";
  revealScore: number;
  revealConfidence: number;
  revealedSignals: number;
};

let timer: number | null = null;

function clearTimer() {
  if (timer !== null) window.clearTimeout(timer);
  timer = null;
}

const prefersReducedMotion = () =>
  typeof window !== "undefined" && Boolean(window.matchMedia?.("(prefers-reduced-motion: reduce)").matches);

function schedule(callback: () => void, delay: number) {
  clearTimer();
  timer = window.setTimeout(callback, prefersReducedMotion() ? 20 : delay);
}

const setProcessing = (value: ProcessingState | null) => {
  (getUiState() as { intelligenceProcessing: ProcessingState | null }).intelligenceProcessing = value;
  notifyStateChanged();
};

export function runIntelligenceSimulation(
  ids: string[],
  toast: (message: string, tone?: "success" | "error" | "info") => void,
  toastLabel = "تم تحليل فرص Business المحددة",
  mode: "single" | "batch" = "single",
): void {
  const unique = [...new Set(ids.filter(Boolean))];
  if (!unique.length) {
    toast("اختر Business واحدة على الأقل للتحليل.", "error");
    return;
  }

  clearTimer();
  const eligible: string[] = [];
  const insufficient: string[] = [];
  for (const id of unique) {
    if (beginBusinessAnalysis(id)) eligible.push(id);
    else insufficient.push(id);
  }
  if (!eligible.length && !insufficient.length) {
    toast("لا توجد سجلات قابلة للتحليل ضمن الاختيار الحالي.", "error");
    return;
  }

  const processing: ProcessingState = {
    mode: mode === "batch" || unique.length > 1 ? "batch" : "single",
    ids: unique,
    eligibleIds: eligible,
    insufficientIds: insufficient,
    completedIds: [],
    currentId: eligible[0] || "",
    primaryId: eligible[0] || insufficient[0],
    stages: intelligenceProcessingStages,
    stageIndex: 0,
    phase: "stages",
    outcome: eligible.length ? "analysis" : "insufficient",
    revealScore: 0,
    revealConfidence: 0,
    revealedSignals: 0,
  };
  setProcessing(processing);

  const finish = () => {
    processing.phase = "complete";
    processing.revealScore = 1;
    processing.revealConfidence = 1;
    processing.revealedSignals = 99;
    notifyStateChanged();
    schedule(() => {
      setProcessing(null);
      toast(`${toastLabel} ضمن محاكاة محلية ثابتة.`, "success");
    }, 1050);
  };

  const reveal = () => {
    const steps = prefersReducedMotion() ? 1 : 5;
    let scoreTick = 0;

    const revealSignals = () => {
      processing.revealedSignals += 1;
      notifyStateChanged();
      if (processing.revealedSignals < 6) {
        schedule(revealSignals, 55);
        return;
      }
      processing.phase = "recommendations";
      notifyStateChanged();
      schedule(finish, 160);
    };

    const revealConfidence = () => {
      const tick = (processing.revealConfidence * steps) + 1;
      processing.phase = "confidence";
      processing.revealScore = 1;
      processing.revealConfidence = tick / steps;
      notifyStateChanged();
      if (tick < steps) {
        schedule(revealConfidence, 35);
        return;
      }
      processing.phase = "signals";
      processing.revealedSignals = 2;
      notifyStateChanged();
      schedule(revealSignals, 55);
    };

    const revealScore = () => {
      scoreTick += 1;
      processing.phase = "score";
      processing.revealScore = scoreTick / steps;
      notifyStateChanged();
      if (scoreTick < steps) {
        schedule(revealScore, 35);
        return;
      }
      processing.revealConfidence = 0;
      schedule(revealConfidence, 35);
    };

    revealScore();
  };

  const completeBatch = () => {
    const queue = [...processing.eligibleIds];
    const next = () => {
      const id = queue.shift();
      if (id) {
        processing.currentId = id;
        completeBusinessAnalysis(id);
        processing.completedIds.push(id);
        notifyStateChanged();
        schedule(next, 90);
        return;
      }
      processing.currentId = "";
      reveal();
    };
    next();
  };

  const runStages = () => {
    const stageLimit = processing.outcome === "insufficient" ? 2 : processing.stages.length - 1;
    if (processing.stageIndex < stageLimit) {
      processing.stageIndex += 1;
      notifyStateChanged();
      schedule(runStages, 180);
      return;
    }
    if (processing.outcome === "insufficient") {
      processing.phase = "complete";
      notifyStateChanged();
      schedule(() => {
        setProcessing(null);
        toast("فحص الاكتمال أكد أن البيانات غير كافية؛ لم تُمنح درجة.", "success");
      }, 450);
      return;
    }
    if (processing.mode === "batch") {
      completeBatch();
      return;
    }
    completeBusinessAnalysis(processing.primaryId);
    processing.completedIds = [processing.primaryId];
    reveal();
  };

  schedule(runStages, 180);
}
