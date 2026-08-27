import type { ReactNode } from "react";
import { entitlementService } from "@services";
import type { CapabilityId } from "@services";
import { go } from "../router/useHashRoute";

const statusLabels = {
  AVAILABLE: "متاح",
  LIMITED: "متاح ضمن الاستخدام الحالي",
  EXHAUSTED: "اكتمل الحد الحالي",
  LOCKED: "غير متاح في الباقة الحالية",
} as const;

export function EntitlementGate({ capability, children }: { capability: CapabilityId; children: ReactNode }) {
  const decision = entitlementService.evaluate(capability);
  if (decision.allowed) return <>{children}</>;
  const usage = decision.usage;
  const usageText = usage?.limit.kind === "finite" ? `${usage.used} من ${usage.limit.value}` : usage?.limit.kind === "unlimited" ? "غير محدود" : "غير مشمول";
  return (
    <section className="entitlement-gate" aria-label="حالة توفر الميزة">
      <div>
        <span className={`entitlement-status ${decision.status.toLowerCase()}`}>{statusLabels[decision.status]}</span>
        <h3>{decision.reason === "usage_exhausted" ? "وصلت إلى حد الاستخدام" : "هذه الميزة ضمن باقة أعلى"}</h3>
        <p>{decision.reason === "usage_exhausted" ? `الاستخدام الحالي: ${usageText}. يمكنك الترقية لرفع الحد.` : "يمكنك استكشاف الباقات المتاحة لمعرفة الخطة المناسبة."}</p>
      </div>
      {decision.upgradeTarget && (
        <button className="button primary" type="button" onClick={() => go("settings/billing")}>
          عرض خيارات الترقية
        </button>
      )}
    </section>
  );
}
