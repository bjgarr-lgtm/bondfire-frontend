import React, { useEffect, useMemo, useState } from "react";

const DEFAULT_SHEET = {
  type: "bondfire-sheet",
  version: 2,
  activeSheetId: "sheet_1",
  sheets: [
    {
      id: "sheet_1",
      name: "Sheet1",
      rowCount: 20,
      columnCount: 8,
      cells: {},
    },
  ],
};

function columnLabel(index) {
  let n = Number(index) + 1;
  let out = "";
  while (n > 0) {
    const rem = (n - 1) % 26;
    out = String.fromCharCode(65 + rem) + out;
    n = Math.floor((n - 1) / 26);
  }
  return out;
}

function cellKey(rowIndex, colIndex) {
  return `${columnLabel(colIndex)}${rowIndex + 1}`;
}

function safeParse(value) {
  try {
    return JSON.parse(String(value || ""));
  } catch {
    return null;
  }
}

function normalizeLegacySheet(parsed) {
  const columns = Array.isArray(parsed?.columns) && parsed.columns.length ? parsed.columns.map((x, idx) => String(x || columnLabel(idx))) : ["A", "B", "C", "D"];
  const rows = Array.isArray(parsed?.rows) ? parsed.rows : [];
  const cells = {};
  rows.forEach((row, rowIndex) => {
    (Array.isArray(row) ? row : []).forEach((value, colIndex) => {
      if (String(value || "") !== "") cells[cellKey(rowIndex, colIndex)] = { input: String(value) };
    });
  });
  return {
    type: "bondfire-sheet",
    version: 2,
    activeSheetId: "sheet_1",
    sheets: [
      {
        id: "sheet_1",
        name: "Sheet1",
        rowCount: Math.max(rows.length || 0, 20),
        columnCount: Math.max(columns.length || 0, 8),
        cells,
      },
    ],
  };
}

function normalizeSheet(input) {
  if (!input || typeof input !== "object") return DEFAULT_SHEET;
  if (Array.isArray(input?.sheets) && input.sheets.length) {
    const sheets = input.sheets.map((sheet, idx) => ({
      id: String(sheet?.id || `sheet_${idx + 1}`),
      name: String(sheet?.name || `Sheet${idx + 1}`),
      rowCount: Math.max(1, Number(sheet?.rowCount || 20)),
      columnCount: Math.max(1, Number(sheet?.columnCount || 8)),
      cells: sheet && typeof sheet.cells === "object" && !Array.isArray(sheet.cells) ? Object.fromEntries(Object.entries(sheet.cells).map(([key, cell]) => [key, { input: String(cell?.input ?? cell ?? "") }])) : {},
    }));
    const activeSheetId = sheets.some((sheet) => sheet.id === input.activeSheetId) ? input.activeSheetId : sheets[0].id;
    return {
      type: "bondfire-sheet",
      version: 2,
      activeSheetId,
      sheets,
    };
  }
  return normalizeLegacySheet(input);
}

function serialize(sheetDoc) {
  return JSON.stringify(sheetDoc, null, 2);
}

function parseCellRef(ref) {
  const match = String(ref || "").toUpperCase().match(/^([A-Z]+)(\d+)$/);
  if (!match) return null;
  let col = 0;
  for (const char of match[1]) col = (col * 26) + (char.charCodeAt(0) - 64);
  return { row: Number(match[2]) - 1, col: col - 1 };
}

function expandRange(startRef, endRef) {
  const start = parseCellRef(startRef);
  const end = parseCellRef(endRef);
  if (!start || !end) return [];
  const rows = [start.row, end.row].sort((a, b) => a - b);
  const cols = [start.col, end.col].sort((a, b) => a - b);
  const out = [];
  for (let row = rows[0]; row <= rows[1]; row += 1) {
    for (let col = cols[0]; col <= cols[1]; col += 1) out.push(cellKey(row, col));
  }
  return out;
}

function evaluateFormula(input, getter, stack = new Set()) {
  const raw = String(input || "").trim();
  if (!raw.startsWith("=")) return raw;
  const expr = raw.slice(1).trim();
  const fnMatch = expr.match(/^(SUM|AVG|MIN|MAX)\(([^)]+)\)$/i);
  if (fnMatch) {
    const fn = fnMatch[1].toUpperCase();
    const refs = fnMatch[2].split(",").flatMap((token) => {
      const part = token.trim();
      if (part.includes(":")) {
        const [start, end] = part.split(":");
        return expandRange(start, end);
      }
      return [part];
    });
    const nums = refs.map((ref) => Number(getter(String(ref).toUpperCase(), stack) || 0)).filter((value) => Number.isFinite(value));
    if (!nums.length) return "";
    if (fn === "SUM") return String(nums.reduce((sum, value) => sum + value, 0));
    if (fn === "AVG") return String(nums.reduce((sum, value) => sum + value, 0) / nums.length);
    if (fn === "MIN") return String(Math.min(...nums));
    if (fn === "MAX") return String(Math.max(...nums));
  }
  const replaced = expr.replace(/\b([A-Z]+\d+)\b/g, (_, ref) => {
    const value = getter(ref.toUpperCase(), stack);
    const num = Number(value);
    return Number.isFinite(num) ? String(num) : "0";
  });
  if (!/^[0-9+\-*/().\s]+$/.test(replaced)) return "#ERR";
  try {
    const result = Function(`"use strict"; return (${replaced});`)();
    return Number.isFinite(result) ? String(result) : "#ERR";
  } catch {
    return "#ERR";
  }
}

function getDisplayValue(sheet, key, stack = new Set()) {
  const input = String(sheet?.cells?.[key]?.input || "");
  if (!input.startsWith("=")) return input;
  if (stack.has(key)) return "#CYCLE";
  const nextStack = new Set(stack);
  nextStack.add(key);
  return evaluateFormula(input, (ref, nestedStack) => getDisplayValue(sheet, ref, nestedStack || nextStack), nextStack);
}

export default function SpreadsheetFileView({ value, onChange, mode = "edit" }) {
  const doc = useMemo(() => normalizeSheet(safeParse(value)), [value]);
  const readOnly = mode === "preview";
  const [selectedCell, setSelectedCell] = useState("A1");
  const [editingCell, setEditingCell] = useState(null);
  const [formulaDraft, setFormulaDraft] = useState("");

  const activeSheet = doc.sheets.find((sheet) => sheet.id === doc.activeSheetId) || doc.sheets[0];
  const selectedInput = String(activeSheet?.cells?.[selectedCell]?.input || "");

  useEffect(() => {
    setFormulaDraft(selectedInput);
  }, [selectedInput, selectedCell]);

  const commit = (nextDoc) => onChange?.(serialize(nextDoc));

  const patchActiveSheet = (updater) => {
    const nextSheets = doc.sheets.map((sheet) => (sheet.id === activeSheet.id ? updater(sheet) : sheet));
    commit({ ...doc, sheets: nextSheets });
  };

  const setCellInput = (cell, nextInput) => {
    patchActiveSheet((sheet) => {
      const nextCells = { ...sheet.cells };
      if (String(nextInput || "") === "") delete nextCells[cell];
      else nextCells[cell] = { input: String(nextInput) };
      return { ...sheet, cells: nextCells };
    });
  };

  const addRow = () => patchActiveSheet((sheet) => ({ ...sheet, rowCount: sheet.rowCount + 1 }));
  const addColumn = () => patchActiveSheet((sheet) => ({ ...sheet, columnCount: sheet.columnCount + 1 }));
  const addSheet = () => {
    const id = `sheet_${Date.now()}`;
    const next = {
      ...doc,
      activeSheetId: id,
      sheets: [...doc.sheets, { id, name: `Sheet${doc.sheets.length + 1}`, rowCount: 20, columnCount: 8, cells: {} }],
    };
    commit(next);
  };
  const renameActiveSheet = () => {
    const nextName = window.prompt("Sheet name", activeSheet?.name || "Sheet");
    if (!nextName) return;
    patchActiveSheet((sheet) => ({ ...sheet, name: String(nextName).trim() || sheet.name }));
  };

  const columnLabels = Array.from({ length: activeSheet.columnCount }, (_, idx) => columnLabel(idx));
  const rowIndices = Array.from({ length: activeSheet.rowCount }, (_, idx) => idx);

  const commitFormulaBar = () => {
    setCellInput(selectedCell, formulaDraft);
    setEditingCell(null);
  };

  return (
    <div style={{ display: "grid", gap: 12 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
          {!readOnly ? (
            <>
              <button className="btn" type="button" onClick={addRow}>Add row</button>
              <button className="btn" type="button" onClick={addColumn}>Add column</button>
              <button className="btn" type="button" onClick={addSheet}>New sheet</button>
              <button className="btn" type="button" onClick={renameActiveSheet}>Rename sheet</button>
            </>
          ) : null}
        </div>
        <div className="helper">{activeSheet.rowCount} rows · {activeSheet.columnCount} columns</div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "92px minmax(0,1fr)", gap: 8, alignItems: "center" }}>
        <div style={{ fontWeight: 700 }}>{selectedCell}</div>
        <input
          className="input"
          value={formulaDraft}
          disabled={readOnly}
          onChange={(e) => setFormulaDraft(e.target.value)}
          onBlur={commitFormulaBar}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              commitFormulaBar();
            }
          }}
          placeholder="Value or formula, like =SUM(A1:B4)"
          style={{ padding: "10px 12px" }}
        />
      </div>

      <div style={{ overflow: "auto", border: "1px solid #1f1f1f", borderRadius: 14, background: "rgba(255,255,255,0.02)", maxHeight: "72vh" }}>
        <table style={{ width: "100%", borderCollapse: "separate", borderSpacing: 0, tableLayout: "fixed", minWidth: Math.max(720, activeSheet.columnCount * 132) }}>
          <thead>
            <tr>
              <th style={{ position: "sticky", top: 0, left: 0, zIndex: 4, background: "#121212", borderBottom: "1px solid #242424", width: 52, minWidth: 52, padding: "10px 8px" }}>#</th>
              {columnLabels.map((label) => (
                <th key={label} style={{ position: "sticky", top: 0, zIndex: 3, background: "#121212", borderBottom: "1px solid #242424", padding: "10px 8px", textAlign: "left", fontWeight: 800 }}>{label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rowIndices.map((rowIndex) => (
              <tr key={rowIndex}>
                <th style={{ position: "sticky", left: 0, zIndex: 2, background: "#121212", borderBottom: "1px solid #202020", padding: "8px 10px", textAlign: "right", fontWeight: 700 }}>{rowIndex + 1}</th>
                {columnLabels.map((_, colIndex) => {
                  const key = cellKey(rowIndex, colIndex);
                  const cell = activeSheet.cells[key];
                  const raw = String(cell?.input || "");
                  const display = getDisplayValue(activeSheet, key);
                  const isSelected = selectedCell === key;
                  const isEditing = editingCell === key;
                  return (
                    <td
                      key={key}
                      onClick={() => { setSelectedCell(key); setEditingCell(null); }}
                      onDoubleClick={() => { if (!readOnly) { setSelectedCell(key); setEditingCell(key); } }}
                      style={{ borderBottom: "1px solid #1b1b1b", borderRight: "1px solid #1b1b1b", padding: 0, background: isSelected ? "rgba(66, 153, 225, 0.08)" : "transparent", outline: isSelected ? "2px solid rgba(66, 153, 225, 0.6)" : "none", outlineOffset: -2, height: 42 }}
                    >
                      {isEditing && !readOnly ? (
                        <input
                          autoFocus
                          className="input"
                          value={raw}
                          onChange={(e) => setCellInput(key, e.target.value)}
                          onBlur={() => setEditingCell(null)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") setEditingCell(null);
                            if (e.key === "Escape") { setEditingCell(null); setFormulaDraft(raw); }
                          }}
                          style={{ width: "100%", height: "100%", border: "none", borderRadius: 0, background: "transparent", padding: "10px 12px" }}
                        />
                      ) : (
                        <div style={{ padding: "10px 12px", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", minHeight: 42, fontVariantNumeric: "tabular-nums" }}>{display}</div>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        {doc.sheets.map((sheet) => {
          const active = sheet.id === doc.activeSheetId;
          return (
            <button
              key={sheet.id}
              className="btn"
              type="button"
              onClick={() => commit({ ...doc, activeSheetId: sheet.id })}
              style={{ background: active ? "rgba(255,255,255,0.12)" : undefined, fontWeight: active ? 800 : 500 }}
            >
              {sheet.name}
            </button>
          );
        })}
      </div>
    </div>
  );
}
