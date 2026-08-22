/**
 * Placeholder — قاعدة «لا روابط ميتة» في `ROUTES.md`.
 * كل مسار معروف غير منفذ يعرض اسم الشاشة ورقم الشحنة ومسار عودة.
 */
import { navItems } from "@domain/data.js";
import { go } from "../router/useHashRoute";
import { PageHead } from "./PageHead";

const shipments: Record<string, string> = {
  discovery: "S3", "discovery-jobs": "S3", "discovery/jobs": "S3", results: "S3", "discovery/results": "S3",
  intelligence: "S4", "lead-profile": "S4", crm: "S5", "crm/leads": "S5", leads: "S5", contacts: "S5",
  companies: "S5", pipeline: "S6", deals: "S6", tasks: "S9", appointments: "S9", inbox: "S7",
  whatsapp: "S7", calls: "S7", copilot: "S8", agent: "S8", automation: "S9", analytics: "S10",
  integrations: "S11", billing: "S11", settings: "S11",
};

export function Placeholder({ route }: { route: string }) {
  const item = (navItems as { id: string; label: string }[]).find((entry) => entry.id === route);
  const title = item?.label || "هذه الشاشة";
  const shipment = shipments[route] || "S1";

  return (
    <>
      <PageHead
        kicker="خريطة المنتج"
        title={title}
        description={`هذه واجهة مخططة ومثبتة معماريًا ضمن ${shipment}. سيبدأ تنفيذها بعد اعتماد CTO للشحنة المناسبة.`}
        actions={
          <button className="button primary" type="button" onClick={() => go("dashboard")}>
            العودة للرئيسية
          </button>
        }
      />
      <section className="placeholder-card">
        <span>{shipment}</span>
        <div>
          <h2>{title}</h2>
          <p>
            لا توجد وظيفة إنتاجية هنا في S0. المسار والتنقل والكيان الأساسي محفوظة في خريطة الشاشات ونموذج الكيانات.
          </p>
        </div>
        <button className="button" type="button" onClick={() => go("ui-kit")}>
          فتح مكتبة الواجهة
        </button>
      </section>
    </>
  );
}
