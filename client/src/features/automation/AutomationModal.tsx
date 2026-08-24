/**
 * نافذة إنشاء قاعدة أتمتة — S9.
 * الحقول والمعاملات من `automationConditionFieldCatalog` المركزي فقط:
 * لا expressions ولا JavaScript ولا templates تنفيذية.
 */
import { useState, type FormEvent, type MouseEvent } from "react";
import { automationActionCatalog as rawActions, automationConditionFieldCatalog as rawFields, automationOperatorLabels as rawOperators, automationTriggerCatalog as rawTriggers, createAutomationRule } from "@services";
import { getAutomationRulePreview } from "@domain/automation.js";
import { go, useHashRoute } from "../../shared/router/useHashRoute";
import { mutate } from "../../shared/store/appStore";
import { useToast } from "../../shared/store/toast";
import { useModalDismiss } from "../../shared/components/useModalDismiss";

type Row = Record<string, any>;

const fieldCatalog = rawFields as Row[];
const triggerCatalog = rawTriggers as Row[];
const actionCatalog = rawActions as Row[];
const operatorLabels = rawOperators as Record<string, string>;

export function AutomationModal() {
  const toast = useToast();
  const { path } = useHashRoute();
  const [values, setValues] = useState({
    triggerType: "lead_created",
    conditionField: "lead.priority",
    conditionOperator: "equals",
    conditionValue: "high",
    actionType: "AUTOACT-1001",
    approvalPolicy: "auto_safe",
  });

  const isCreateRule = new URLSearchParams(window.location.hash.split("?")[1] || "").get("modal") === "create-rule";
  const close = () => {
    go(path || "automation");
  };
  const panelRef = useModalDismiss(close);
  if (!isCreateRule) return null;

  const onBackdrop = (event: MouseEvent<HTMLDivElement>) => {
    if (event.target === event.currentTarget) close();
  };

  const preview = getAutomationRulePreview(values);
  const activeField = fieldCatalog.find((field) => field.field === values.conditionField) || fieldCatalog[0];

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const result = mutate(() =>
      createAutomationRule({
        name: String(data.get("name") || ""),
        triggerType: values.triggerType,
        actionIds: [values.actionType],
        approvalPolicy: values.approvalPolicy,
        status: "enabled",
        conditions: [
          { field: values.conditionField, operator: values.conditionOperator, value: values.conditionValue },
        ],
      }),
    );
    close();
    toast(result ? "أُنشئت القاعدة محليًا؛ لن تعمل قبل تشغيل صريح." : "تعذر إنشاء القاعدة.", result ? "success" : "error");
  }

  return (
    <div className="s9-modal-backdrop" onClick={onBackdrop}>
      <section ref={panelRef as never} tabIndex={-1} className="s9-modal" role="dialog" aria-modal="true" aria-labelledby="s9RuleTitle">
        <header>
          <div>
            <p className="eyebrow">قاعدة جديدة</p>
            <h2 id="s9RuleTitle">عندما يحدث… إذا… افعل…</h2>
          </div>
          <button className="modal-close" type="button" onClick={close} aria-label="إغلاق">×</button>
        </header>

        <form onSubmit={submit}>
          <div className="form-grid">
            <label className="form-field wide">
              اسم الأتمتة
              <input name="name" required placeholder="مثال: متابعة عميل جديد" />
            </label>
            <label className="form-field">
              <span>عندما يحدث</span>
              <select
                value={values.triggerType}
                onChange={(e) => setValues({ ...values, triggerType: e.target.value })}
              >
                {triggerCatalog.map((trigger) => (
                  <option value={trigger.id} key={trigger.id}>{trigger.label}</option>
                ))}
              </select>
            </label>
            <label className="form-field">
              <span>إذا كان الحقل</span>
              <select
                value={values.conditionField}
                onChange={(e) => setValues({ ...values, conditionField: e.target.value })}
              >
                {fieldCatalog.map((field) => (
                  <option value={field.field} key={field.field}>{field.label}</option>
                ))}
              </select>
            </label>
            <label className="form-field">
              <span>المعامل</span>
              <select
                value={values.conditionOperator}
                onChange={(e) => setValues({ ...values, conditionOperator: e.target.value })}
              >
                {(activeField?.operators || []).map((operator: string) => (
                  <option value={operator} key={operator}>{operatorLabels[operator] || operator}</option>
                ))}
              </select>
            </label>
            <label className="form-field">
              <span>القيمة</span>
              <input
                value={values.conditionValue}
                placeholder="high"
                onChange={(e) => setValues({ ...values, conditionValue: e.target.value })}
              />
            </label>
            <label className="form-field">
              <span>افعل</span>
              <select value={values.actionType} onChange={(e) => setValues({ ...values, actionType: e.target.value })}>
                {actionCatalog.map((action) => (
                  <option value={action.id} key={action.id}>{action.label}</option>
                ))}
              </select>
            </label>
            <label className="form-field">
              <span>سياسة التنفيذ</span>
              <select
                value={values.approvalPolicy}
                onChange={(e) => setValues({ ...values, approvalPolicy: e.target.value })}
              >
                <option value="auto_safe">آمن تلقائيًا</option>
                <option value="approval_required">يتطلب موافقة</option>
                <option value="manual_only">يدوي فقط</option>
              </select>
            </label>
          </div>

          <div className="s9-rule-preview">
            <b>{preview.sentence}</b>
            <small>{preview.policyNote}</small>
          </div>

          <footer>
            <button className="button" type="button" onClick={close}>إلغاء</button>
            <button className="button primary" type="submit">إنشاء القاعدة</button>
          </footer>
        </form>
      </section>
    </div>
  );
}
