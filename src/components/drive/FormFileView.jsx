import React, { useMemo } from "react";

const DEFAULT_FORM = {
  type: "bondfire-form",
  version: 1,
  title: "Untitled form",
  description: "",
  fields: [
    { id: "field_1", type: "text", label: "Your name", required: false, options: [] },
    { id: "field_2", type: "paragraph", label: "Details", required: false, options: [] },
  ],
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

function normalizeForm(input) {
  return {
    type: "bondfire-form",
    version: 1,
    title: String(input?.title || "Untitled form"),
    description: String(input?.description || ""),
    fields: Array.isArray(input?.fields) && input.fields.length ? input.fields.map(normalizeField) : DEFAULT_FORM.fields.map(normalizeField),
  };
}

function serialize(form) {
  return JSON.stringify(normalizeForm(form), null, 2);
}

function FieldPreview({ field }) {
  if (field.type === "paragraph") return <textarea disabled className="input" placeholder="Long answer" style={{ width: "100%", minHeight: 90, padding: 10, resize: "vertical" }} />;
  if (field.type === "choice") {
    return <div style={{ display: "grid", gap: 8 }}>{field.options.map((option, idx) => <label key={`${field.id}-${idx}`} style={{ display: "flex", gap: 8, alignItems: "center" }}><input type="radio" disabled name={field.id} /><span>{option}</span></label>)}</div>;
  }
  if (field.type === "checkbox") {
    return <div style={{ display: "grid", gap: 8 }}>{field.options.map((option, idx) => <label key={`${field.id}-${idx}`} style={{ display: "flex", gap: 8, alignItems: "center" }}><input type="checkbox" disabled /><span>{option}</span></label>)}</div>;
  }
  if (field.type === "date") return <input disabled className="input" type="date" style={{ width: "100%", padding: 10 }} />;
  return <input disabled className="input" type="text" placeholder="Short answer" style={{ width: "100%", padding: 10 }} />;
}

export default function FormFileView({ value, onChange, mode = "edit" }) {
  const form = useMemo(() => normalizeForm(safeParse(value)), [value]);
  const readOnly = mode === "preview";

  const commit = (next) => onChange?.(serialize(next));
  const setFormProp = (key, nextValue) => commit({ ...form, [key]: nextValue });
  const setField = (fieldId, patch) => commit({ ...form, fields: form.fields.map((field) => (field.id === fieldId ? { ...field, ...patch } : field)) });
  const removeField = (fieldId) => commit({ ...form, fields: form.fields.filter((field) => field.id !== fieldId) });
  const addField = (type) => commit({ ...form, fields: [...form.fields, normalizeField({ id: `field_${Date.now()}`, type, label: type === "choice" ? "Multiple choice" : type === "checkbox" ? "Checkboxes" : "Untitled question", options: type === "choice" || type === "checkbox" ? ["Option 1", "Option 2"] : [] }, form.fields.length)] });

  return (
    <div style={{ maxWidth: 1080, margin: "0 auto", display: "grid", gap: 14 }}>
      {!readOnly ? (
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button className="btn" type="button" onClick={() => addField("text")}>Add text</button>
          <button className="btn" type="button" onClick={() => addField("paragraph")}>Add paragraph</button>
          <button className="btn" type="button" onClick={() => addField("choice")}>Add choice</button>
          <button className="btn" type="button" onClick={() => addField("checkbox")}>Add checkbox</button>
          <button className="btn" type="button" onClick={() => addField("date")}>Add date</button>
        </div>
      ) : null}

      <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid #1f1f1f", borderRadius: 12, padding: 16 }}>
        {readOnly ? (
          <>
            <h2 style={{ marginTop: 0, marginBottom: 8 }}>{form.title}</h2>
            {form.description ? <div className="helper" style={{ whiteSpace: "pre-wrap", marginBottom: 16 }}>{form.description}</div> : null}
          </>
        ) : (
          <div style={{ display: "grid", gap: 10 }}>
            <input className="input" value={form.title} onChange={(e) => setFormProp("title", e.target.value)} placeholder="Form title" style={{ fontSize: 22, fontWeight: 800, padding: "10px 12px" }} />
            <textarea className="input" value={form.description} onChange={(e) => setFormProp("description", e.target.value)} placeholder="Form description" style={{ minHeight: 74, padding: 10, resize: "vertical" }} />
          </div>
        )}
      </div>

      {form.fields.map((field, idx) => (
        <div key={field.id} style={{ background: "rgba(255,255,255,0.02)", border: "1px solid #1f1f1f", borderRadius: 12, padding: 16 }}>
          {readOnly ? (
            <div style={{ display: "grid", gap: 12 }}>
              <div style={{ fontWeight: 700 }}>{idx + 1}. {field.label} {field.required ? <span style={{ color: "#ff9a9a" }}>*</span> : null}</div>
              <FieldPreview field={field} />
            </div>
          ) : (
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
                <FieldPreview field={field} />
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
