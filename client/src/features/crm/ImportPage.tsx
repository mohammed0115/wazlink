/**
 * CSV import — upload, map, preview, commit.
 *
 * The four steps mirror the backend's own contract exactly: `POST /imports`
 * stores the rows, `PUT .../mapping` names the target field for each column,
 * `POST .../dry-run` reports what a commit WOULD do and writes nothing, and
 * `POST .../commit` runs each row independently. Row-level outcomes are the
 * contract too: a failed row does not roll back a committed one, so the result
 * panel shows per-outcome counts and offers the errors CSV rather than
 * pretending the batch either fully succeeded or fully failed.
 *
 * Import never fabricates a Business, so it works with zero Discovery objects.
 */
import { useMemo, useState } from "react";
import { importsApi, type ImportBatchPayload } from "../../api";
import { useApiAction } from "../../api/hooks";
import { useAuth } from "../../shared/context/AuthProvider";
import { PageHead } from "../../shared/components/PageHead";
import { CrmNav } from "./components/CrmNav";
import { ApiErrorState, FormError } from "../../shared/components/ApiStates";
import { useToast } from "../../shared/store/toast";
import { fmtNumber } from "./components/primitives";

/** Target fields the backend accepts per import kind. `name` is required. */
const TARGET_FIELDS: Record<string, { key: string; label: string }[]> = {
  lead: [
    { key: "name", label: "الاسم (مطلوب)" },
    { key: "phone", label: "الجوال" },
    { key: "email", label: "البريد" },
  ],
  customer: [
    { key: "name", label: "الاسم (مطلوب)" },
    { key: "phone", label: "الجوال" },
    { key: "email", label: "البريد" },
  ],
  contact: [
    { key: "name", label: "الاسم (مطلوب)" },
    { key: "phone", label: "الجوال" },
    { key: "email", label: "البريد" },
  ],
};

const KIND_LABELS: Record<string, string> = {
  lead: "عملاء محتملون",
  customer: "عملاء",
  contact: "جهات اتصال",
};

interface DryRunReport {
  rows_total: number;
  would_create: number;
  would_fail: { row_number: number; error: string }[];
  wrote_nothing: boolean;
}

/** Read the header row so the mapping UI can offer real column names. */
function readHeaders(csv: string): string[] {
  const firstLine = csv.split(/\r?\n/, 1)[0] ?? "";
  if (!firstLine.trim()) return [];
  return firstLine.split(",").map((cell) => cell.trim().replace(/^"|"$/g, ""));
}

export function ImportPage() {
  const toast = useToast();
  const { can } = useAuth();
  const [targetKind, setTargetKind] = useState("lead");
  const [csv, setCsv] = useState("");
  const [batch, setBatch] = useState<ImportBatchPayload | null>(null);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [report, setReport] = useState<DryRunReport | null>(null);

  const headers = useMemo(() => readHeaders(csv), [csv]);

  const createBatch = useApiAction(() => importsApi.create(targetKind, csv));
  const saveMapping = useApiAction((batchRef: string) => importsApi.setMapping(batchRef, mapping));
  const dryRun = useApiAction((batchRef: string) => importsApi.dryRun(batchRef));
  const commit = useApiAction((batchRef: string, version: number) =>
    importsApi.commit(batchRef, version),
  );

  if (!can("import.manage")) {
    return (
      <>
        <PageHead kicker="إدارة العملاء" title="استيراد CSV" />
        <section className="card crm-state-card" role="alert">
          <span className="status warning">لا تملك صلاحية</span>
          <h2>الاستيراد متاح لأدوار الإدارة فقط.</h2>
        </section>
      </>
    );
  }

  const mappedTargets = Object.values(mapping);
  const nameMapped = mappedTargets.includes("name");

  return (
    <>
      <PageHead
        kicker="إدارة العملاء"
        title="استيراد CSV"
        description="استيراد حقيقي إلى قاعدة البيانات. لا يُنشئ أي منشأة وهمية ولا يحتاج إلى الاكتشاف."
      />
      <CrmNav />

      <section className="card import-steps">
        <b>١ — اختر الملف والنوع</b>
        <ol>
          <li>ارفع ملف CSV يحتوي على صف عناوين.</li>
          <li>اربط كل عمود بالحقل المقابل — حقل الاسم إلزامي.</li>
          <li>شغّل المعاينة: لا تكتب أي شيء في قاعدة البيانات.</li>
          <li>نفّذ الاستيراد؛ الصفوف الناجحة تبقى حتى لو فشل غيرها.</li>
        </ol>
        <div className="form-grid">
          <div className="form-field">
            <label htmlFor="importKind">نوع السجلات</label>
            <select
              id="importKind"
              value={targetKind}
              onChange={(event) => {
                setTargetKind(event.target.value);
                setBatch(null);
                setReport(null);
              }}
            >
              {Object.entries(KIND_LABELS).map(([key, label]) => (
                <option value={key} key={key}>
                  {label}
                </option>
              ))}
            </select>
          </div>
          <div className="form-field">
            <label htmlFor="importFile">ملف CSV</label>
            <input
              id="importFile"
              type="file"
              accept=".csv,text/csv"
              onChange={async (event) => {
                const file = event.target.files?.[0];
                if (!file) return;
                setCsv(await file.text());
                setBatch(null);
                setReport(null);
                setMapping({});
              }}
            />
          </div>
        </div>
        <FormError error={createBatch.error} />
        <div className="crm-create-actions">
          <button
            className="button primary"
            type="button"
            disabled={createBatch.pending || !csv.trim()}
            onClick={async () => {
              const created = await createBatch.run();
              if (!created) return;
              setBatch(created);
              setReport(null);
              toast(`تم تحميل ${created.rows_total} صفًا.`, "success");
            }}
          >
            {createBatch.pending ? "جارٍ التحميل…" : "تحميل الملف"}
          </button>
          {headers.length > 0 ? (
            <span className="crm-create-hint">
              الأعمدة المكتشفة: {headers.join("، ")}
            </span>
          ) : null}
        </div>
      </section>

      {batch ? (
        <section className="card import-steps">
          <b>٢ — ربط الأعمدة</b>
          <div className="form-grid">
            {headers.map((header) => (
              <div className="form-field" key={header}>
                <label htmlFor={`map-${header}`}>{header}</label>
                <select
                  id={`map-${header}`}
                  value={mapping[header] ?? ""}
                  onChange={(event) =>
                    setMapping((current) => {
                      const next = { ...current };
                      if (event.target.value) next[header] = event.target.value;
                      else delete next[header];
                      return next;
                    })
                  }
                >
                  <option value="">تجاهل هذا العمود</option>
                  {(TARGET_FIELDS[targetKind] || []).map((field) => (
                    <option value={field.key} key={field.key}>
                      {field.label}
                    </option>
                  ))}
                </select>
              </div>
            ))}
          </div>
          <FormError error={saveMapping.error} />
          <div className="crm-create-actions">
            <button
              className="button primary"
              type="button"
              disabled={saveMapping.pending || !nameMapped}
              onClick={async () => {
                const updated = await saveMapping.run(batch.batch_ref);
                if (!updated) return;
                setBatch(updated);
                toast("حُفظ الربط.", "success");
              }}
            >
              حفظ الربط
            </button>
            {!nameMapped ? (
              <span className="crm-create-hint">يجب ربط عمود واحد بحقل الاسم.</span>
            ) : null}
          </div>
        </section>
      ) : null}

      {batch && batch.status !== "pending" ? (
        <section className="card import-steps">
          <b>٣ — معاينة قبل التنفيذ</b>
          <FormError error={dryRun.error} />
          <div className="crm-create-actions">
            <button
              className="button ghost"
              type="button"
              disabled={dryRun.pending}
              onClick={async () => {
                const result = await dryRun.run(batch.batch_ref);
                if (!result) return;
                setReport(result as unknown as DryRunReport);
              }}
            >
              {dryRun.pending ? "جارٍ الفحص…" : "تشغيل المعاينة"}
            </button>
          </div>
          {report ? (
            <>
              <div className="import-outcomes">
                <span>إجمالي الصفوف: {fmtNumber(report.rows_total)}</span>
                <span>ستُنشأ: {fmtNumber(report.would_create)}</span>
                <span>ستفشل: {fmtNumber(report.would_fail.length)}</span>
              </div>
              <p className="crm-create-hint">المعاينة لا تكتب أي سجل في قاعدة البيانات.</p>
              {report.would_fail.length > 0 ? (
                <div className="table-wrap">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>الصف</th>
                        <th>السبب</th>
                      </tr>
                    </thead>
                    <tbody>
                      {report.would_fail.slice(0, 20).map((row) => (
                        <tr key={row.row_number}>
                          <td>{row.row_number}</td>
                          <td>{row.error}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : null}
            </>
          ) : null}
        </section>
      ) : null}

      {batch && report ? (
        <section className="card import-steps">
          <b>٤ — تنفيذ الاستيراد</b>
          <FormError error={commit.error} />
          <div className="crm-create-actions">
            <button
              className="button primary"
              type="button"
              disabled={commit.pending}
              onClick={async () => {
                const committed = await commit.run(batch.batch_ref, batch.version);
                if (!committed) return;
                setBatch(committed);
                toast("نُفّذ الاستيراد.", "success");
              }}
            >
              {commit.pending ? "جارٍ التنفيذ…" : "تنفيذ الاستيراد"}
            </button>
            <button
              className="button ghost"
              type="button"
              onClick={async () => {
                const blob = await importsApi.errorsCsv(batch.batch_ref);
                const url = URL.createObjectURL(blob);
                const anchor = document.createElement("a");
                anchor.href = url;
                anchor.download = `${batch.batch_ref}-errors.csv`;
                anchor.click();
                URL.revokeObjectURL(url);
              }}
            >
              تنزيل تقرير الأخطاء
            </button>
          </div>
          <div className="import-outcomes">
            <span>الحالة: {batch.status}</span>
            {Object.entries(batch.outcomes || {}).map(([outcome, count]) => (
              <span key={outcome}>
                {outcome}: {fmtNumber(count)}
              </span>
            ))}
          </div>
        </section>
      ) : null}

      {createBatch.error && createBatch.error.kind === "server" ? (
        <ApiErrorState error={createBatch.error} />
      ) : null}
    </>
  );
}
