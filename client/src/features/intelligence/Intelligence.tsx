/**
 * ذكاء العملاء — S4.
 *
 * منقولة عن `renderIntelligence()`. تعرض الدرجة والأبعاد والإشارات والخدمات
 * وسلسلة الثقة. `unknown` ليست إشارة سلبية: السجل بلا أدلة كافية يظهر
 * بحالة `insufficient_data` بلا درجة مضللة.
 */
import { SCORING_VERSION, getBusinessIntelligence, tierLabels as rawTierLabels } from "@domain/intelligence.js";
import { go } from "../../shared/router/useHashRoute";
import { PageHead } from "../../shared/components/PageHead";
import {
  AnalysisStatusBadge,
  DecisionRail,
  DimensionRows,
  Mono,
  SignalCard,
  fmt,
  percent,
} from "./shared";

const tierLabels = rawTierLabels as Record<string, string>;

export function Intelligence({ businessId }: { businessId: string }) {
  const record = getBusinessIntelligence(businessId);

  const openEvidence = (signalId: string) => {
    go(`intelligence?business=${encodeURIComponent(businessId)}&modal=evidence&signalId=${encodeURIComponent(signalId)}`);
  };

  if (!record) {
    return (
      <PageHead
        kicker="ذكاء العملاء"
        title="لم نجد سجل Business"
        description="اختر نتيجة مكتملة من مساحة الاكتشاف لعرض تحليلها."
        actions={
          <button className="button primary" type="button" onClick={() => go("discovery/results")}>
            فتح النتائج
          </button>
        }
      />
    );
  }

  const { business, analysis, job, source } = record;
  const backToResults = (
    <button className="button" type="button" onClick={() => go(`discovery/results?job=${encodeURIComponent(job?.id || "")}`)}>
      العودة إلى النتائج
    </button>
  );
  const provenance = (
    <div className="s4-provenance-line">
      <Mono>{source?.id || "—"}</Mono> <i>←</i> <Mono>{job?.id || "—"}</Mono> <i>←</i> <Mono>{business.id}</Mono>
    </div>
  );

  if (record.status === "insufficient_data") {
    return (
      <>
        <PageHead
          kicker="ذكاء العملاء"
          title={business.name}
          description="لا يمكن تقييم الفرصة بثقة قبل توفر إشارات إضافية."
          actions={backToResults}
        />
        <DecisionRail stage="intelligence" job={job} source={source} />
        <section className="s4-insufficient-state-card card">
          <span className="status warning">بيانات غير كافية</span>
          <h2>نحتاج إشارات إضافية قبل تقييم الفرصة بثقة.</h2>
          <p>
            لا يعامل النظام التقييم أو الموقع أو بيانات الاتصال غير المعروفة كإشارات سلبية، ولذلك لا يمنح هذا السجل
            درجة رقمية مصطنعة.
          </p>
          {provenance}
          <div className="s4-signal-grid">
            {record.signals.map((signal: any) => (
              <SignalCard signal={signal} onEvidence={openEvidence} key={signal.id} />
            ))}
          </div>
        </section>
      </>
    );
  }

  if (record.status === "analysis_error") {
    return (
      <>
        <PageHead
          kicker="ذكاء العملاء"
          title={business.name}
          description="تعذر إكمال التحليل التجريبي لهذه Business، ولم تُعرض درجة أو خدمة كحقيقة."
          actions={backToResults}
        />
        <DecisionRail stage="intelligence" job={job} source={source} />
        <section className="s4-insufficient-state-card card s4-error-state-card">
          <span className="status danger">تعذر التحليل</span>
          <h2>لا نعرض نتيجة غير مكتملة على أنها فرصة.</h2>
          <p>
            أعد المحاولة محليًا لإعادة بناء التحليل من Signals نفسها. لا ينتج هذا الإجراء Lead أو CRM أو أي اتصال
            خارجي.
          </p>
          {provenance}
        </section>
      </>
    );
  }

  return (
    <>
      <PageHead
        kicker="ذكاء العملاء"
        title={business.name}
        description="ملف Opportunity تفسيري مبني على Signals محلية ثابتة؛ يمكن بدء مراجعة تحويل CRM صريحة بعد التحليل، ولا ينشئ Deal."
        actions={backToResults}
      />

      <div className="prototype-notice discovery-notice">
        <b>محاكاة Intelligence</b>
        <span>
          Scoring version: <Mono>{analysis?.scoringVersion || SCORING_VERSION}</Mono>. التحليل ثابت لنفس البيانات ولا
          يتصل بأي مزود ذكاء اصطناعي.
        </span>
      </div>

      <DecisionRail stage="intelligence" job={job} source={source} />

      <section className="s4-intelligence-hero card">
        <div className="s4-business-facts">
          <div><span>النشاط</span><b>{business.category}</b></div>
          <div><span>المدينة</span><b>{business.city}</b></div>
          <div>
            <span>التقييم</span>
            <b>{business.rating === null ? "غير معروف" : `★ ${business.rating} · ${fmt(business.reviews)} مراجعة`}</b>
          </div>
          <div>
            <span>المصدر</span>
            <b>
              {source?.name || "—"} · <Mono>{job?.id || "—"}</Mono>
            </b>
          </div>
        </div>

        {record.score === null ? (
          <div className="s4-score-panel insufficient">
            <b>—</b>
            <span>لا توجد درجة</span>
          </div>
        ) : (
          <div className={`s4-score-panel ${record.tier}`}>
            <b>{record.score}</b>
            <span>من 100</span>
            <small>{tierLabels[record.tier as string]}</small>
          </div>
        )}

        <div className="s4-opportunity-head">
          <span><AnalysisStatusBadge status={record.status} /></span>
          <b>{record.score === null ? "لا توجد فرصة مقيمة" : tierLabels[record.tier as string]}</b>
          <small>
            ثقة {percent(record.confidence)} · آخر تحليل {analysis?.analyzedAt ? "اليوم، 09:42" : "لم يتم بعد"}
          </small>
        </div>
      </section>

      <section className="s4-detail-grid">
        <article className="card s4-breakdown-card">
          <header className="card-head">
            <div>
              <h2>كيف حُسبت الدرجة؟</h2>
              <p>مجموع أبعاد قابلة للمراجعة، لا درجة سحرية.</p>
            </div>
            <button
              type="button"
              className="button ghost"
              onClick={() => go(`intelligence?business=${encodeURIComponent(business.id)}&modal=breakdown`)}
            >
              عرض المعادلة
            </button>
          </header>
          <div className="s4-dimension-list">
            <DimensionRows record={record} />
          </div>
          <footer>
            <span>الإجمالي</span>
            <b>{record.score ?? "—"} / 100</b>
          </footer>
        </article>

        <article className="card s4-reasons-card">
          <header className="card-head">
            <div>
              <h2>لماذا هذه فرصة؟</h2>
              <p>أسباب مرتبطة بإشارات قابلة للعرض.</p>
            </div>
          </header>
          {record.reasons.length ? (
            <div className="s4-reason-list">
              {record.reasons.map((reason: any, index: number) => (
                <div key={index}>
                  <i>!</i>
                  <span>{reason.text}</span>
                </div>
              ))}
            </div>
          ) : (
            <div className="s4-empty-note">
              لا توجد فجوة مثبتة، لذلك لا تحصل الشركة القوية رقميًا على أولوية عالية تلقائيًا.
            </div>
          )}
        </article>
      </section>

      <section className="card">
        <header className="card-head">
          <div>
            <h2>إشارات Business والأدلة</h2>
            <p>كل إشارة تعود إلى نفس السجل وتوضح ما نعرفه وما لا نعرفه.</p>
          </div>
        </header>
        <div className="s4-signal-grid">
          {record.signals.map((signal: any) => (
            <SignalCard signal={signal} onEvidence={openEvidence} key={signal.id} />
          ))}
        </div>
      </section>

      <section className="s4-detail-grid">
        <article className="card">
          <header className="card-head">
            <div>
              <h2>الفجوات والخدمات المقترحة</h2>
              <p>لا تعرض الخدمة إلا عندما ترتبط بفجوة مثبتة.</p>
            </div>
          </header>
          {record.services.length ? (
            <div className="s4-service-list">
              {record.services.map((service: any) => (
                <article key={service.name}>
                  <b>{service.name}</b>
                  <p>{service.description}</p>
                  <small>
                    مبني على{" "}
                    {service.signalIds.map((id: string, index: number) => (
                      <span key={id}>
                        {index ? "، " : ""}
                        <Mono>{id}</Mono>
                      </span>
                    ))}
                  </small>
                </article>
              ))}
            </div>
          ) : (
            <div className="s4-empty-note">لا توجد خدمة مقترحة؛ لا تظهر فجوة قابلة للتحويل إلى توصية خدمية.</div>
          )}
        </article>

        <article className="card s4-approach-card">
          <header className="card-head">
            <div>
              <h2>أسلوب التواصل المقترح</h2>
              <p>توصية Mock مرتبطة بالإشارات، لا رسالة مرسلة.</p>
            </div>
          </header>
          <p>{record.salesApproach}</p>
          <div className="future-action-note">
            <b>إضافة إلى CRM</b>
            <span>تفتح معاينة تحويل تحفظ المصدر وسياق Intelligence، ولا تنشئ Deal أو رسالة.</span>
            <button
              type="button"
              className="button primary"
              onClick={() => go(`intelligence?business=${encodeURIComponent(business.id)}&modal=conversion&businessId=${encodeURIComponent(business.id)}`)}
            >
              مراجعة الإضافة إلى CRM
            </button>
          </div>
        </article>
      </section>

      <section className="s4-provenance card">
        <header>
          <span>سلسلة الثقة</span>
          <b>المصدر ← Job ← Business ← Signals ← Analysis ← Opportunity</b>
        </header>
        <div>
          <Mono>{source?.id || "—"}</Mono>
          <i>←</i>
          <Mono>{job?.id || "—"}</Mono>
          <i>←</i>
          <Mono>{business.id}</Mono>
          <i>←</i>
          <span>
            {record.signals.map((signal: any) => (
              <span key={signal.id}>
                <Mono>{signal.id}</Mono>{" "}
              </span>
            ))}
          </span>
          <i>←</i>
          <Mono>{analysis?.id || "—"}</Mono>
          <i>←</i>
          <Mono>{record.opportunity?.id || "—"}</Mono>
        </div>
      </section>
    </>
  );
}

