import React, { useEffect, useMemo, useRef, useState } from "react";

const DEFAULT_ROW_HEIGHT = 38;
const DEFAULT_COL_WIDTH = 140;
const DEFAULT_ROW_COUNT = 100;
const DEFAULT_COL_COUNT = 26;

const DEFAULT_SHEET = {
  type: "bondfire-sheet",
  version: 3,
  activeSheetId: "sheet_1",
  sheets: [
    {
      id: "sheet_1",
      name: "Sheet1",
      rowCount: DEFAULT_ROW_COUNT,
      columnCount: DEFAULT_COL_COUNT,
      cells: {},
      columnWidths: {},
      rowHeights: {},
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
  const columns = Array.isArray(parsed?.columns) && parsed.columns.length
    ? parsed.columns.map((x, idx) => String(x || columnLabel(idx)))
    : Array.from({ length: DEFAULT_COL_COUNT }, (_, idx) => columnLabel(idx));
  const rows = Array.isArray(parsed?.rows) ? parsed.rows : [];
  const cells = {};
  rows.forEach((row, rowIndex) => {
    (Array.isArray(row) ? row : []).forEach((value, colIndex) => {
      if (String(value || "") !== "") cells[cellKey(rowIndex, colIndex)] = { input: String(value) };
    });
  });
  return {
    type: "bondfire-sheet",
    version: 3,
    activeSheetId: "sheet_1",
    sheets: [
      {
        id: "sheet_1",
        name: "Sheet1",
        rowCount: Math.max(rows.length || 0, DEFAULT_ROW_COUNT),
        columnCount: Math.max(columns.length || 0, DEFAULT_COL_COUNT),
        cells,
        columnWidths: {},
        rowHeights: {},
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
      rowCount: Math.max(1, Number(sheet?.rowCount || DEFAULT_ROW_COUNT)),
      columnCount: Math.max(1, Number(sheet?.columnCount || DEFAULT_COL_COUNT)),
      cells: sheet && typeof sheet.cells === "object" && !Array.isArray(sheet.cells)
        ? Object.fromEntries(Object.entries(sheet.cells).map(([key, cell]) => [key, { input: String(cell?.input ?? cell ?? "") }]))
        : {},
      columnWidths: sheet && typeof sheet.columnWidths === "object" && !Array.isArray(sheet.columnWidths)
        ? Object.fromEntries(Object.entries(sheet.columnWidths).map(([key, width]) => [key, Math.max(60, Number(width || DEFAULT_COL_WIDTH))]))
        : {},
      rowHeights: sheet && typeof sheet.rowHeights === "object" && !Array.isArray(sheet.rowHeights)
        ? Object.fromEntries(Object.entries(sheet.rowHeights).map(([key, height]) => [key, Math.max(24, Number(height || DEFAULT_ROW_HEIGHT))]))
        : {},
    }));
    const activeSheetId = sheets.some((sheet) => sheet.id === input.activeSheetId) ? input.activeSheetId : sheets[0].id;
    return { type: "bondfire-sheet", version: 3, activeSheetId, sheets };
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

function estimateWidth(sheet, colIndex) {
  const label = columnLabel(colIndex);
  let maxLen = label.length;
  Object.entries(sheet?.cells || {}).forEach(([key, cell]) => {
    if (String(key).startsWith(label)) {
      const raw = String(cell?.input || "");
      const shown = raw.startsWith("=") ? getDisplayValue(sheet, key) : raw;
      const longestLine = String(shown || "").split(/\n/).reduce((m, line) => Math.max(m, line.length), 0);
      maxLen = Math.max(maxLen, longestLine);
    }
  });
  return Math.max(80, Math.min(420, Math.round(maxLen * 9 + 28)));
}

function estimateHeight(value) {
  const text = String(value || "");
  const lines = Math.max(1, text.split(/\n/).length);
  return Math.max(30, Math.min(180, 22 + (lines * 18)));
}

export default function SpreadsheetFileView({ value, onChange, mode = "edit" }) {
  const doc = useMemo(() => normalizeSheet(safeParse(value)), [value]);
  const readOnly = mode === "preview";
  const [selectedCell, setSelectedCell] = useState("A1");
  const [editingCell, setEditingCell] = useState("A1");
  const [formulaDraft, setFormulaDraft] = useState("");
  const inputRefs = useRef({});

  const activeSheet = doc.sheets.find((sheet) => sheet.id === doc.activeSheetId) || doc.sheets[0];
  const selectedInput = String(activeSheet?.cells?.[selectedCell]?.input || "");
  const selectedRef = parseCellRef(selectedCell) || { row: 0, col: 0 };

  useEffect(() => {
    setFormulaDraft(selectedInput);
  }, [selectedInput, selectedCell]);

  useEffect(() => {
    if (!readOnly && editingCell && inputRefs.current[editingCell]) {
      const node = inputRefs.current[editingCell];
      node.focus();
      node.select?.();
    }
  }, [editingCell, activeSheet?.id, readOnly]);

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

  const setSheetProp = (patch) => patchActiveSheet((sheet) => ({ ...sheet, ...patch }));
  const addRow = (count = 10) => setSheetProp({ rowCount: activeSheet.rowCount + count });
  const addColumn = (count = 5) => setSheetProp({ columnCount: activeSheet.columnCount + count });

  const addSheet = () => {
    const id = `sheet_${Date.now()}`;
    commit({
      ...doc,
      activeSheetId: id,
      sheets: [...doc.sheets, {
        id,
        name: `Sheet${doc.sheets.length + 1}`,
        rowCount: DEFAULT_ROW_COUNT,
        columnCount: DEFAULT_COL_COUNT,
        cells: {},
        columnWidths: {},
        rowHeights: {},
      }],
    });
    setSelectedCell("A1");
    setEditingCell("A1");
  };

  const renameActiveSheet = () => {
    const nextName = window.prompt("Sheet name", activeSheet?.name || "Sheet");
    if (!nextName) return;
    patchActiveSheet((sheet) => ({ ...sheet, name: String(nextName).trim() || sheet.name }));
  };

  const setColumnWidth = (colIndex, width) => patchActiveSheet((sheet) => ({
    ...sheet,
    columnWidths: { ...sheet.columnWidths, [columnLabel(colIndex)]: Math.max(60, Number(width || DEFAULT_COL_WIDTH)) },
  }));

  const setRowHeight = (rowIndex, height) => patchActiveSheet((sheet) => ({
    ...sheet,
    rowHeights: { ...sheet.rowHeights, [String(rowIndex + 1)]: Math.max(24, Number(height || DEFAULT_ROW_HEIGHT)) },
  }));

  const autoFitColumn = (colIndex) => setColumnWidth(colIndex, estimateWidth(activeSheet, colIndex));
  const autoFitRow = (rowIndex) => setRowHeight(rowIndex, estimateHeight(activeSheet?.cells?.[cellKey(rowIndex, selectedRef.col)]?.input || ""));

  const columnLabels = Array.from({ length: activeSheet.columnCount }, (_, idx) => columnLabel(idx));
  const rowIndices = Array.from({ length: activeSheet.rowCount }, (_, idx) => idx);

  const selectCell = (cell) => {
    setSelectedCell(cell);
    setEditingCell(cell);
  };

  const moveSelection = (deltaRow, deltaCol) => {
    const nextRow = Math.max(0, Math.min(activeSheet.rowCount - 1, selectedRef.row + deltaRow));
    const nextCol = Math.max(0, Math.min(activeSheet.columnCount - 1, selectedRef.col + deltaCol));
    const next = cellKey(nextRow, nextCol);
    setSelectedCell(next);
    setEditingCell(next);
  };

  const commitFormulaBar = () => {
    if (readOnly) return;
    setCellInput(selectedCell, formulaDraft);
  };

  const selectedColWidth = Number(activeSheet.columnWidths?.[columnLabel(selectedRef.col)] || DEFAULT_COL_WIDTH);
  const selectedRowHeight = Number(activeSheet.rowHeights?.[String(selectedRef.row + 1)] || DEFAULT_ROW_HEIGHT);

  return (
    <div style={{ display: "grid", gap: 12 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
          {!readOnly ? (
            <>
              <button className="btn" type="button" onClick={() => addRow(25)}>Add 25 rows</button>
              <button className="btn" type="button" onClick={() => addColumn(5)}>Add 5 columns</button>
              <button className="btn" type="button" onClick={renameActiveSheet}>Rename sheet</button>
            </>
          ) : null}
        </div>
        <div className="helper">{activeSheet.rowCount} rows · {activeSheet.columnCount} columns</div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "84px minmax(0,1fr)", gap: 8, alignItems: "center" }}>
        <div style={{ fontWeight: 700 }}>{selectedCell}</div>
        <input
          className="input"
          value={formulaDraft}
          disabled={readOnly}
          onChange={(e) => setFormulaDraft(e.target.value)}
          onFocus={() => setEditingCell(selectedCell)}
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

      {!readOnly ? (
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
          <div className="helper">Column {columnLabel(selectedRef.col)} width</div>
          <input className="input" type="number" min="60" max="420" value={selectedColWidth} onChange={(e) => setColumnWidth(selectedRef.col, e.target.value)} style={{ width: 90, padding: "8px 10px" }} />
          <button className="btn" type="button" onClick={() => autoFitColumn(selectedRef.col)}>Auto-fit column</button>
          <div className="helper">Row {selectedRef.row + 1} height</div>
          <input className="input" type="number" min="24" max="180" value={selectedRowHeight} onChange={(e) => setRowHeight(selectedRef.row, e.target.value)} style={{ width: 90, padding: "8px 10px" }} />
          <button className="btn" type="button" onClick={() => autoFitRow(selectedRef.row)}>Auto-fit row</button>
        </div>
      ) : null}

      <div style={{ overflow: "auto", border: "1px solid #1f1f1f", borderRadius: 12, background: "rgba(255,255,255,0.015)" }}>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: `52px ${columnLabels.map((label) => `${Number(activeSheet.columnWidths?.[label] || DEFAULT_COL_WIDTH)}px`).join(" ")}`,
            minWidth: "max-content",
          }}
        >
          <div style={{ position: "sticky", left: 0, top: 0, zIndex: 4, borderBottom: "1px solid #222", borderRight: "1px solid #222", background: "#0f1012", minHeight: 40 }} />
          {columnLabels.map((label, colIndex) => (
            <button
              key={label}
              type="button"
              onClick={() => setSelectedCell(cellKey(selectedRef.row, colIndex))}
              onDoubleClick={() => autoFitColumn(colIndex)}
              style={{
                position: "sticky",
                top: 0,
                zIndex: 3,
                border: "none",
                borderBottom: "1px solid #222",
                borderRight: "1px solid #222",
                background: selectedRef.col === colIndex ? "rgba(24,129,242,0.18)" : "#0f1012",
                color: "#fff",
                minHeight: 40,
                fontWeight: 800,
                cursor: "pointer",
              }}
            >
              {label}
            </button>
          ))}

          {rowIndices.flatMap((rowIndex) => {
            const rowKey = String(rowIndex + 1);
            const rowHeight = Number(activeSheet.rowHeights?.[rowKey] || DEFAULT_ROW_HEIGHT);
            const rowHeader = (
              <button
                key={`row_header_${rowKey}`}
                type="button"
                onClick={() => setSelectedCell(cellKey(rowIndex, selectedRef.col))}
                onDoubleClick={() => autoFitRow(rowIndex)}
                style={{
                  position: "sticky",
                  left: 0,
                  zIndex: 2,
                  border: "none",
                  borderBottom: "1px solid #1d1d1d",
                  borderRight: "1px solid #222",
                  background: selectedRef.row === rowIndex ? "rgba(24,129,242,0.18)" : "#0f1012",
                  color: "#fff",
                  height: rowHeight,
                  fontWeight: 800,
                  cursor: "pointer",
                }}
              >
                {rowIndex + 1}
              </button>
            );
            const cells = columnLabels.map((label, colIndex) => {
              const key = cellKey(rowIndex, colIndex);
              const input = String(activeSheet?.cells?.[key]?.input || "");
              const display = input.startsWith("=") ? getDisplayValue(activeSheet, key) : input;
              const selected = selectedCell === key;
              return (
                <div key={key} style={{ borderBottom: "1px solid #1d1d1d", borderRight: "1px solid #1d1d1d", height: rowHeight, background: selected ? "rgba(24,129,242,0.08)" : "transparent" }}>
                  {readOnly ? (
                    <div style={{ padding: "8px 10px", whiteSpace: "pre-wrap", overflow: "hidden", textOverflow: "ellipsis", height: "100%" }}>{display}</div>
                  ) : (
                    <input
                      ref={(node) => { inputRefs.current[key] = node; }}
                      className="input"
                      value={selected && editingCell === key ? input : (selected ? input : display)}
                      onFocus={() => { setSelectedCell(key); setEditingCell(key); setFormulaDraft(input); }}
                      onClick={() => { setSelectedCell(key); setEditingCell(key); }}
                      onChange={(e) => { setSelectedCell(key); setEditingCell(key); setFormulaDraft(e.target.value); setCellInput(key, e.target.value); }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          moveSelection(1, 0);
                        } else if (e.key === "Tab") {
                          e.preventDefault();
                          moveSelection(0, e.shiftKey ? -1 : 1);
                        } else if (e.key === "ArrowDown") {
                          e.preventDefault();
                          moveSelection(1, 0);
                        } else if (e.key === "ArrowUp") {
                          e.preventDefault();
                          moveSelection(-1, 0);
                        } else if (e.key === "ArrowLeft" && e.currentTarget.selectionStart === 0 && e.currentTarget.selectionEnd === 0) {
                          e.preventDefault();
                          moveSelection(0, -1);
                        } else if (e.key === "ArrowRight" && e.currentTarget.selectionStart === e.currentTarget.value.length && e.currentTarget.selectionEnd === e.currentTarget.value.length) {
                          e.preventDefault();
                          moveSelection(0, 1);
                        }
                      }}
                      style={{
                        width: "100%",
                        height: "100%",
                        border: selected ? "1px solid #1881f2" : "1px solid transparent",
                        borderRadius: 0,
                        background: "transparent",
                        padding: "8px 10px",
                        boxShadow: "none",
                        outline: "none",
                      }}
                    />
                  )}
                </div>
              );
            });
            return [rowHeader, ...cells];
          })}
        </div>
      </div>

      <div style={{ display: "flex", gap: 8, overflowX: "auto", paddingBottom: 2 }}>
        {doc.sheets.map((sheet) => (
          <button
            key={sheet.id}
            className="btn"
            type="button"
            onClick={() => { commit({ ...doc, activeSheetId: sheet.id }); setSelectedCell("A1"); setEditingCell("A1"); }}
            style={{ background: sheet.id === activeSheet.id ? "rgba(255,255,255,0.12)" : undefined }}
          >
            {sheet.name}
          </button>
        ))}
        {!readOnly ? <button className="btn" type="button" onClick={addSheet}>＋ Sheet</button> : null}
      </div>
    </div>
  );
}
