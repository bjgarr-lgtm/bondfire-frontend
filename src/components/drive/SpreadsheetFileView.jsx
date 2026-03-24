import React, { useMemo } from "react";

const DEFAULT_SHEET = {
  type: "bondfire-sheet",
  version: 1,
  columns: ["A", "B", "C", "D"],
  rows: [
    ["", "", "", ""],
    ["", "", "", ""],
    ["", "", "", ""],
  ],
};

function safeParse(value) {
  try {
    const parsed = JSON.parse(String(value || ""));
    if (parsed && parsed.type === "bondfire-sheet") return parsed;
  } catch {}
  return DEFAULT_SHEET;
}

function normalizeSheet(input) {
  const columns = Array.isArray(input?.columns) && input.columns.length ? input.columns.map((x, idx) => String(x || String.fromCharCode(65 + idx))) : DEFAULT_SHEET.columns;
  const rows = Array.isArray(input?.rows) && input.rows.length
    ? input.rows.map((row) => columns.map((_, idx) => String(Array.isArray(row) ? row[idx] ?? "" : "")))
    : DEFAULT_SHEET.rows.map((row) => [...row]);
  return { type: "bondfire-sheet", version: 1, columns, rows };
}

function serialize(sheet) {
  return JSON.stringify(normalizeSheet(sheet), null, 2);
}

function cellName(colIdx, rowIdx) {
  return `${String.fromCharCode(65 + colIdx)}${rowIdx + 1}`;
}

export default function SpreadsheetFileView({ value, onChange, mode = "edit" }) {
  const sheet = useMemo(() => normalizeSheet(safeParse(value)), [value]);
  const readOnly = mode === "preview";

  const commit = (next) => onChange?.(serialize(next));

  const setCell = (rowIdx, colIdx, nextValue) => {
    const rows = sheet.rows.map((row, r) => row.map((cell, c) => (r === rowIdx && c === colIdx ? nextValue : cell)));
    commit({ ...sheet, rows });
  };

  const setColumnName = (colIdx, nextValue) => {
    const columns = sheet.columns.map((col, idx) => (idx === colIdx ? nextValue || `Column ${idx + 1}` : col));
    commit({ ...sheet, columns });
  };

  const addRow = () => commit({ ...sheet, rows: [...sheet.rows, sheet.columns.map(() => "")] });
  const addColumn = () => {
    const nextLabel = String.fromCharCode(65 + sheet.columns.length);
    commit({
      ...sheet,
      columns: [...sheet.columns, nextLabel],
      rows: sheet.rows.map((row) => [...row, ""]),
    });
  };

  return (
    <div style={{ maxWidth: 1180, margin: "0 auto", background: "rgba(255,255,255,0.02)", border: "1px solid #1f1f1f", borderRadius: 12, padding: 14, minHeight: "72vh", overflow: "auto" }}>
      {!readOnly ? (
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
          <button className="btn" type="button" onClick={addRow}>Add row</button>
          <button className="btn" type="button" onClick={addColumn}>Add column</button>
        </div>
      ) : null}
      <table style={{ width: "100%", borderCollapse: "collapse", tableLayout: "fixed" }}>
        <thead>
          <tr>
            <th style={{ width: 56, padding: 8, borderBottom: "1px solid rgba(255,255,255,0.12)", opacity: 0.65 }}>#</th>
            {sheet.columns.map((column, idx) => (
              <th key={`${column}-${idx}`} style={{ padding: 8, borderBottom: "1px solid rgba(255,255,255,0.12)", textAlign: "left" }}>
                {readOnly ? (
                  <div style={{ fontWeight: 700 }}>{column}</div>
                ) : (
                  <input
                    className="input"
                    value={column}
                    onChange={(e) => setColumnName(idx, e.target.value)}
                    style={{ width: "100%", minWidth: 84, padding: "6px 8px" }}
                  />
                )}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sheet.rows.map((row, rowIdx) => (
            <tr key={`row-${rowIdx}`}>
              <td style={{ padding: 8, borderBottom: "1px solid rgba(255,255,255,0.08)", opacity: 0.65, fontFamily: "ui-monospace, monospace" }}>{rowIdx + 1}</td>
              {sheet.columns.map((_, colIdx) => (
                <td key={cellName(colIdx, rowIdx)} style={{ padding: 6, borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
                  {readOnly ? (
                    <div style={{ minHeight: 32, whiteSpace: "pre-wrap" }}>{row[colIdx] || <span style={{ opacity: 0.35 }}> </span>}</div>
                  ) : (
                    <input
                      className="input"
                      value={row[colIdx] || ""}
                      onChange={(e) => setCell(rowIdx, colIdx, e.target.value)}
                      placeholder={cellName(colIdx, rowIdx)}
                      style={{ width: "100%", minWidth: 84, padding: "6px 8px" }}
                    />
                  )}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
