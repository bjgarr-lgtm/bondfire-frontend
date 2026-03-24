import React, { useEffect, useMemo, useState } from "react";

const DEFAULT_FORM = {
  type: "bondfire-form",
  version: 2,
  title: "Untitled form",
  description: "",
  fields: [
    { id: "field_1", type: "text", label: "Your name", required: false, options: [] },
    { id: "field_2", type: "paragraph", label: "Details", required: false, options: [] },
  ],
  responses: [],
};

function safeParse(value) {
  try {
    const parsed = JSON.parse(String(value || ""));
    if (parsed && parsed.type === "bondfire-form") return parsed;
  } catch {}
  return DEFAULT_FORM;
}

function normalizeField(field, idx) {
  const type = ["text", "paragraph", "choice", "checkbox", "date"].includes(String(field?.type || "")) ? field.type : "text";
  return {
    id: String(field?.id || `field_${idx + 1}`),
    type,
    label: String(field?.label || `Question ${idx + 1}`),
    required: !!field?.required,
    options: Array.isArray(field?.options) ? field.options.map((x) => String(x || "")).filter(Boolean) : [],
  };
}

function normalizeResponse(response, idx = 0) {
  const values = response && typeof response.values === "object" && response.values ? response.values : {};
  return {
    id: String(response?.id || `response_${idx + 1}`),
    submittedAt: Number(response?.submittedAt || Date.now()),
    values,
  };
}

function normalizeForm(input) {
  return {
    type: "bondfire-form",
    version: 2,
    title: String(input?.title || "Untitled form"),
    description: String(input?.description || ""),
    fields: Array.isArray(input?.fields) && input.fields.length ? input.fields.map(normalizeField) : DEFAULT_FORM.fields.map(normalizeField),
    responses: Array.isArray(input?.responses) ? input.responses.map(normalizeResponse) : [],
  };
}

function serialize(form) {
  return JSON.stringify(normalizeForm(form), null, 2);
}

function FieldPreview({ field, draft, onDraftChange, disabled = false }) {
  if (field.type === "paragraph") {
    return <textarea disabled={disabled} className="input" value={draft || ""} onChange={(e) => onDraftChange?.(e.target.value)} placeholder="Long answer" style={{ width: "100%", minHeight: 90, padding: 10, resize: "vertical" }} />;
  }
  if (field.type === "choice") {
    return (
      <div style={{ display: "grid", gap: 8 }}>
        {field.options.map((option, idx) => (
          <label key={`${field.id}-${idx}`} style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <input type="radio" disabled={disabled} checked={draft === option} onChange={() => onDraftChange?.(option)} name={field.id} />
            <span>{option}</span>
          </label>
        ))}
      </div>
    );
  }
  if (field.type === "checkbox") {
    const selected = Array.isArray(draft) ? draft : [];
    return (
      <div style={{ display: "grid", gap: 8 }}>
        {field.options.map((option, idx) => (
          <label key={`${field.id}-${idx}`} style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <input
              type="checkbox"
              disabled={disabled}
              checked={selected.includes(option)}
              onChange={(e) => onDraftChange?.(e.target.checked ? [...selected, option] : selected.filter((entry) => entry !== option))}
            />
            <span>{option}</span>
          </label>
        ))}
      </div>
    );
  }
  if (field.type === "date") return <input disabled={disabled} className="input" value={draft || ""} onChange={(e) => onDraftChange?.(e.target.value)} type="date" style={{ width: "100%", padding: 10 }} />;
  return <input disabled={disabled} className="input" value={draft || ""} onChange={(e) => onDraftChange?.(e.target.value)} type="text" placeholder="Short answer" style={{ width: "100%", padding: 10 }} />;
}

function formatResponseValue(value) {
  if (Array.isArray(value)) return value.join(", ");
  return String(value || "");
}

export default function FormFileView({ value, onChange, mode = "edit", readOnlyPreview = false }) {
  const form = useMemo(() => normalizeForm(safeParse(value)), [value]);
  const readOnly = mode === "preview" && readOnlyPreview;
  const fillMode = mode === "preview" && !readOnlyPreview;
  const [draft, setDraft] = useState({});
  const [submitState, setSubmitState] = useState("");

  useEffect(() => {
    setDraft({});
    setSubmitState("");
  }, [value, mode]);

  const commit = (next) => onChange?.(serialize(next));
  const setFormProp = (key, nextValue) => commit({ ...form, [key]: nextValue });
  const setField = (fieldId, patch) => commit({ ...form, fields: form.fields.map((field) => (field.id === fieldId ? { ...field, ...patch } : field)) });
  const removeField = (fieldId) => commit({ ...form, fields: form.fields.filter((field) => field.id !== fieldId) });
  const addField = (type) => commit({ ...form, fields: [...form.fields, normalizeField({ id: `field_${Date.now()}`, type, label: type === "choice" ? "Multiple choice" : type === "checkbox" ? "Checkboxes" : "Untitled question", options: type === "choice" || type === "checkbox" ? ["Option 1", "Option 2"] : [] }, form.fields.length)] });

  const submitResponse = () => {
    const missing = form.fields.filter((field) => {
      if (!field.required) return false;
      const current = draft[field.id];
      if (field.type === "checkbox") return !Array.isArray(current) || current.length === 0;
      return !String(current || "").trim();
    });
    if (missing.length) {
      setSubmitState(`Please complete required field${missing.length > 1 ? "s" : ""} before submitting.`);
      return;
    }
    const nextForm = {
      ...form,
      responses: [
        ...form.responses,
        normalizeResponse({
          id: `response_${Date.now()}`,
          submittedAt: Date.now(),
          values: form.fields.reduce((acc, field) => {
            acc[field.id] = field.type === "checkbox" ? (Array.isArray(draft[field.id]) ? draft[field.id] : []) : (draft[field.id] ?? "");
            return acc;
          }, {}),
        }, form.responses.length),
      ],
    };
    commit(nextForm);
    setDraft({});
    setSubmitState("Response submitted.");
  };

  return (
    <div style={{ maxWidth: 1080, margin: "0 auto", display: "grid", gap: 14 }}>
      {mode === "edit" ? (
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button className="btn" type="button" onClick={() => addField("text")}>Add text</button>
          <button className="btn" type="button" onClick={() => addField("paragraph")}>Add paragraph</button>
          <button className="btn" type="button" onClick={() => addField("choice")}>Add choice</button>
          <button className="btn" type="button" onClick={() => addField("checkbox")}>Add checkbox</button>
          <button className="btn" type="button" onClick={() => addField("date")}>Add date</button>
          <span className="helper" style={{ alignSelf: "center" }}>{form.responses.length} response{form.responses.length === 1 ? "" : "s"}</span>
        </div>
      ) : null}

      <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid #1f1f1f", borderRadius: 12, padding: 16 }}>
        {mode === "edit" ? (
          <div style={{ display: "grid", gap: 10 }}>
            <input className="input" value={form.title} onChange={(e) => setFormProp("title", e.target.value)} placeholder="Form title" style={{ fontSize: 22, fontWeight: 800, padding: "10px 12px" }} />
            <textarea className="input" value={form.description} onChange={(e) => setFormProp("description", e.target.value)} placeholder="Form description" style={{ minHeight: 74, padding: 10, resize: "vertical" }} />
          </div>
        ) : (
          <>
            <h2 style={{ marginTop: 0, marginBottom: 8 }}>{form.title}</h2>
            {form.description ? <div className="helper" style={{ whiteSpace: "pre-wrap", marginBottom: 16 }}>{form.description}</div> : null}
            {fillMode ? <div className="helper">Responses are collected into this form document. No realtime circus, just durable submissions.</div> : null}
          </>
        )}
      </div>

      {form.fields.map((field, idx) => (
        <div key={field.id} style={{ background: "rgba(255,255,255,0.02)", border: "1px solid #1f1f1f", borderRadius: 12, padding: 16 }}>
          {mode === "edit" ? (
            <div style={{ display: "grid", gap: 10 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                <input className="input" value={field.label} onChange={(e) => setField(field.id, { label: e.target.value })} placeholder="Question" style={{ flex: 1, minWidth: 220, padding: "8px 10px" }} />
                <select className="input" value={field.type} onChange={(e) => setField(field.id, { type: e.target.value, options: e.target.value === "choice" || e.target.value === "checkbox" ? (field.options.length ? field.options : ["Option 1", "Option 2"]) : [] })} style={{ width: 160, padding: "8px 10px" }}>
                  <option value="text">Text</option>
                  <option value="paragraph">Paragraph</option>
                  <option value="choice">Choice</option>
                  <option value="checkbox">Checkbox</option>
                  <option value="date">Date</option>
                </select>
                <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13 }}>
                  <input type="checkbox" checked={field.required} onChange={(e) => setField(field.id, { required: e.target.checked })} />
                  Required
                </label>
                <button className="btn" type="button" onClick={() => removeField(field.id)} style={{ color: "#ff9a9a" }}>Delete</button>
              </div>
              {field.type === "choice" || field.type === "checkbox" ? (
                <textarea
                  className="input"
                  value={field.options.join("\n")}
                  onChange={(e) => setField(field.id, { options: e.target.value.split(/\r?\n/).map((x) => x.trim()).filter(Boolean) })}
                  placeholder="One option per line"
                  style={{ minHeight: 88, padding: 10, resize: "vertical" }}
                />
              ) : null}
              <div style={{ paddingTop: 6 }}>
                <FieldPreview field={field} draft={field.type === "checkbox" ? [] : ""} disabled />
              </div>
            </div>
          ) : (
            <div style={{ display: "grid", gap: 12 }}>
              <div style={{ fontWeight: 700 }}>{idx + 1}. {field.label} {field.required ? <span style={{ color: "#ff9a9a" }}>*</span> : null}</div>
              <FieldPreview field={field} draft={draft[field.id]} onDraftChange={(next) => setDraft((prev) => ({ ...prev, [field.id]: next }))} disabled={readOnly} />
            </div>
          )}
        </div>
      ))}

      {fillMode ? (
        <div style={{ display: "grid", gap: 10 }}>
          <div style={{ display: "flex", justifyContent: "flex-end" }}>
            <button className="btn" type="button" onClick={submitResponse}>Submit response</button>
          </div>
          {submitState ? <div className="helper" style={{ color: submitState.startsWith("Please") ? "#ffb199" : "#9be7c4" }}>{submitState}</div> : null}
        </div>
      ) : null}

      {mode === "edit" ? (
        <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid #1f1f1f", borderRadius: 12, padding: 16 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, marginBottom: 12 }}>
            <div style={{ fontWeight: 800 }}>Responses</div>
            <span className="helper">{form.responses.length} collected</span>
          </div>
          {!form.responses.length ? (
            <div className="helper">No responses yet.</div>
          ) : (
            <div style={{ display: "grid", gap: 12 }}>
              {form.responses.slice().reverse().map((response) => (
                <div key={response.id} style={{ border: "1px solid rgba(255,255,255,0.08)", borderRadius: 10, padding: 12, display: "grid", gap: 8 }}>
                  <div className="helper">{new Date(response.submittedAt).toLocaleString()}</div>
                  {form.fields.map((field) => (
                    <div key={`${response.id}-${field.id}`} style={{ display: "grid", gap: 4 }}>
                      <div style={{ fontWeight: 700 }}>{field.label}</div>
                      <div style={{ whiteSpace: "pre-wrap" }}>{formatResponseValue(response.values?.[field.id]) || <span className="helper">No answer</span>}</div>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}
