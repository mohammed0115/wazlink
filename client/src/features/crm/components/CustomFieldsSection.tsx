/**
 * Typed custom fields.
 *
 * Values are rendered and edited BY DECLARED TYPE, from the workspace's own
 * `FieldDefinition` rows — never as a free-form JSON blob, which would push
 * validation onto whoever happens to read the value later. The server still
 * validates and remains the authority; this only builds the right input.
 */
import { useMemo, useState } from "react";
import { customFieldsApi, type CustomFieldValue, type FieldDefinition } from "../../../api";
import { useApiAction, useApiResource } from "../../../api/hooks";
import { useAuth } from "../../../shared/context/AuthProvider";
import { FormError } from "../../../shared/components/ApiStates";
import { useToast } from "../../../shared/store/toast";
import { PartySection } from "./primitives";

function renderValue(field: CustomFieldValue): string {
  if (field.value === null || field.value === undefined || field.value === "") return "—";
  if (field.field_type === "boolean") return field.value ? "نعم" : "لا";
  return String(field.value);
}

function FieldInput({
  definition,
  value,
  onChange,
}: {
  definition: FieldDefinition;
  value: string;
  onChange: (next: string) => void;
}) {
  const id = `cf-${definition.key}`;
  switch (definition.field_type) {
    case "boolean":
      return (
        <label className="check">
          <input
            id={id}
            type="checkbox"
            checked={value === "true"}
            onChange={(event) => onChange(event.target.checked ? "true" : "false")}
          />{" "}
          {definition.label}
        </label>
      );
    case "number":
      return (
        <input
          id={id}
          className="ltr"
          type="number"
          value={value}
          onChange={(event) => onChange(event.target.value)}
        />
      );
    case "date":
      return (
        <input
          id={id}
          className="ltr"
          type="date"
          value={value}
          onChange={(event) => onChange(event.target.value)}
        />
      );
    case "select":
      return (
        <select id={id} value={value} onChange={(event) => onChange(event.target.value)}>
          <option value="">—</option>
          {(definition.options || []).map((option) => (
            <option value={option} key={option}>
              {option}
            </option>
          ))}
        </select>
      );
    default:
      return <input id={id} value={value} onChange={(event) => onChange(event.target.value)} />;
  }
}

/** Convert a form string back to the JSON type the definition declares. */
function toTypedValue(definition: FieldDefinition, raw: string): unknown {
  if (raw === "") return null;
  if (definition.field_type === "boolean") return raw === "true";
  if (definition.field_type === "number") {
    const numeric = Number(raw);
    return Number.isNaN(numeric) ? raw : numeric;
  }
  return raw;
}

export function CustomFieldsSection({
  subjectType,
  values,
  onSave,
  onSaved,
}: {
  subjectType: "lead" | "customer";
  values: CustomFieldValue[] | undefined;
  onSave: (values: Record<string, unknown>) => Promise<unknown>;
  onSaved: () => void;
}) {
  const toast = useToast();
  const { can } = useAuth();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<Record<string, string>>({});

  // Definitions are admin-managed; a non-admin still SEES values, but the
  // editor needs the schema, so the fetch is gated on that permission.
  const definitions = useApiResource(
    (signal) => customFieldsApi.list(subjectType, signal),
    [subjectType],
    { enabled: can("customfield.manage") },
  );

  const save = useApiAction(async () => {
    const typed: Record<string, unknown> = {};
    for (const definition of definitions.data?.items ?? []) {
      if (definition.key in draft) typed[definition.key] = toTypedValue(definition, draft[definition.key]);
    }
    return onSave(typed);
  });

  const current = useMemo(() => {
    const map: Record<string, string> = {};
    for (const field of values ?? []) {
      map[field.key] = field.value === null || field.value === undefined ? "" : String(field.value);
    }
    return map;
  }, [values]);

  const editable = can("customfield.manage") && (definitions.data?.items.length ?? 0) > 0;

  return (
    <PartySection
      title="حقول مخصصة"
      present={values !== undefined}
      isEmpty={!editing && (values ?? []).length === 0}
      emptyText={
        editable ? "لا توجد قيم بعد. يمكنك إضافتها من زر التعديل." : "لا توجد حقول مخصصة معرّفة."
      }
      action={
        editable ? (
          <button
            className="button ghost compact"
            type="button"
            onClick={() => {
              setDraft(current);
              setEditing((value) => !value);
            }}
          >
            {editing ? "إلغاء" : "تعديل"}
          </button>
        ) : null
      }
    >
      {editing ? (
        <>
          {(definitions.data?.items ?? []).map((definition) => (
            <div className="form-field" key={definition.field_ref}>
              {definition.field_type === "boolean" ? null : (
                <label htmlFor={`cf-${definition.key}`}>
                  {definition.label}
                  {definition.required ? " *" : ""}
                </label>
              )}
              <FieldInput
                definition={definition}
                value={draft[definition.key] ?? ""}
                onChange={(next) => setDraft((state) => ({ ...state, [definition.key]: next }))}
              />
            </div>
          ))}
          <FormError error={save.error} />
          <button
            className="button primary compact"
            type="button"
            disabled={save.pending}
            onClick={async () => {
              const result = await save.run();
              if (result === null) return;
              setEditing(false);
              toast("حُفظت الحقول المخصصة.", "success");
              onSaved();
            }}
          >
            حفظ
          </button>
        </>
      ) : (
        (values ?? []).map((field) => (
          <div className="party-row" key={field.key}>
            <span className="grow">
              <b>{field.label}</b>
              <small>{renderValue(field)}</small>
            </span>
          </div>
        ))
      )}
    </PartySection>
  );
}
