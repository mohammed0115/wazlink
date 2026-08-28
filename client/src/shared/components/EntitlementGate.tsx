import type { ReactNode } from "react";
import type { CapabilityId } from "@services";
import { upgradeProjection } from "../../services/upgradeProjection";
import { go } from "../router/useHashRoute";

const statusLabels = {
  AVAILABLE: "متاح",
  LIMITED: "متاح ضمن الاستخدام الحالي",
  EXHAUSTED: "اكتمل الحد الحالي",
  LOCKED: "غير متاح في الباقة الحالية",
  UNKNOWN: "حالة التوفر غير معروفة",
} as const;

export function EntitlementGate({ capability, children }: { capability: CapabilityId; children: ReactNode }) {
  const context = upgradeProjection.getContext(capability);
  if (context.canUse) {
    return (
      <>
        {context.reason === "limited" && context.usage?.limit.kind === "finite" && (
          <p className="entitlement-inline-note" role="status">
            {context.capabilityLabel}: {context.usage.used} من {context.usage.limit.value} مستخدم · المتبقي {context.usage.remaining}
          </p>
        )}
        {children}
      </>
    );
  }
  const usage = context.usage;
  const usageText = usage?.limit.kind === "finite" ? `${usage.used} من ${usage.limit.value}` : usage?.limit.kind === "unlimited" ? "غير محدود" : "غير مشمول";
  return (
    <section className="entitlement-gate" aria-label="حالة توفر الميزة">
      <div>
        <span className={`entitlement-status ${context.status.toLowerCase()}`}>{statusLabels[context.status]}</span>
        <h3>{context.reason === "exhausted" ? "وصلت إلى حد الاستخدام" : context.reason === "locked" ? "هذه الميزة ضمن باقة أعلى" : "تعذر تأكيد توفر الميزة"}</h3>
        <p>{context.explanation}</p>
        {usage && <small>الاستخدام الحالي: {usageText}</small>}
      </div>
      {context.action && (
        <button className="button primary" type="button" onClick={() => go(context.action?.route || context.billingRoute)}>
          {context.action.label}
        </button>
      )}
    </section>
  );
}
