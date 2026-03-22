
import React from "react";
import { useParams } from "react-router-dom";

const PRESETS = {
	flyer: { label: "Flyer", width: 1080, height: 1350 },
	square: { label: "Square Post", width: 1080, height: 1080 },
	story: { label: "Story", width: 1080, height: 1920 },
	banner: { label: "Banner", width: 1600, height: 900 },
};

function storageKey(orgId) {
	return `bf_studio_docs_${orgId}`;
}

function uid() {
	return `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function makeDoc(preset = "flyer") {
	return {
		id: uid(),
		name: `Untitled ${PRESETS[preset]?.label || "Design"}`,
		preset,
		width: PRESETS[preset]?.width || 1080,
		height: PRESETS[preset]?.height || 1350,
		elements: [],
		updatedAt: Date.now(),
	};
}

function readDocs(orgId) {
	if (!orgId) return [];
	try {
		const raw = localStorage.getItem(storageKey(orgId));
		const parsed = JSON.parse(raw || "[]");
		return Array.isArray(parsed) ? parsed : [];
	} catch {
		return [];
	}
}

function saveDocs(orgId, docs) {
	localStorage.setItem(storageKey(orgId), JSON.stringify(docs));
}

function clone(obj) {
	return JSON.parse(JSON.stringify(obj));
}

function downloadBlob(filename, blob) {
	const url = URL.createObjectURL(blob);
	const a = document.createElement("a");
	a.href = url;
	a.download = filename;
	a.click();
	setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export default function Studio() {
	const { orgId } = useParams();
	const [docs, setDocs] = React.useState(() => readDocs(orgId));
	const [currentId, setCurrentId] = React.useState(() => readDocs(orgId)[0]?.id || null);
	const [selectedId, setSelectedId] = React.useState(null);
	const [draggingId, setDraggingId] = React.useState(null);
	const [dragOffset, setDragOffset] = React.useState({ x: 0, y: 0 });
	const [history, setHistory] = React.useState([]);
	const [future, setFuture] = React.useState([]);

	React.useEffect(() => {
		const nextDocs = readDocs(orgId);
		setDocs(nextDocs);
		setCurrentId(nextDocs[0]?.id || null);
		setSelectedId(null);
		setHistory([]);
		setFuture([]);
	}, [orgId]);

	const currentDoc = React.useMemo(() => docs.find((d) => d.id === currentId) || null, [docs, currentId]);
	const selected = React.useMemo(() => currentDoc?.elements?.find((el) => el.id === selectedId) || null, [currentDoc, selectedId]);

	const commitDocs = React.useCallback((updater) => {
		setDocs((prev) => {
			const next = typeof updater === "function" ? updater(prev) : updater;
			saveDocs(orgId, next);
			return next;
		});
	}, [orgId]);

	const snapshot = React.useCallback(() => {
		setHistory((prev) => [...prev, clone(docs)]);
		setFuture([]);
	}, [docs]);

	const ensureDoc = React.useCallback((preset = "flyer") => {
		if (currentDoc) return currentDoc.id;
		const doc = makeDoc(preset);
		const next = [doc];
		setDocs(next);
		saveDocs(orgId, next);
		setCurrentId(doc.id);
		return doc.id;
	}, [currentDoc, orgId]);

	const createDoc = (preset = "flyer") => {
		snapshot();
		const doc = makeDoc(preset);
		commitDocs((prev) => [doc, ...prev]);
		setCurrentId(doc.id);
		setSelectedId(null);
	};

	const duplicateDoc = () => {
		if (!currentDoc) return;
		snapshot();
		const nextDoc = clone(currentDoc);
		nextDoc.id = uid();
		nextDoc.name = `${currentDoc.name} Copy`;
		nextDoc.updatedAt = Date.now();
		commitDocs((prev) => [nextDoc, ...prev]);
		setCurrentId(nextDoc.id);
		setSelectedId(null);
	};

	const updateDoc = (patch) => {
		if (!currentDoc) return;
		commitDocs((prev) => prev.map((doc) => doc.id === currentDoc.id ? { ...doc, ...patch, updatedAt: Date.now() } : doc));
	};

	const updateElement = (elementId, patch) => {
		if (!currentDoc) return;
		commitDocs((prev) => prev.map((doc) => {
			if (doc.id !== currentDoc.id) return doc;
			return {
				...doc,
				updatedAt: Date.now(),
				elements: doc.elements.map((el) => el.id === elementId ? { ...el, ...patch } : el),
			};
		}));
	};

	const addText = () => {
		const docId = ensureDoc("flyer");
		snapshot();
		const id = uid();
		commitDocs((prev) => prev.map((doc) => doc.id !== docId ? doc : {
			...doc,
			updatedAt: Date.now(),
			elements: [...doc.elements, {
				id,
				type: "text",
				text: "new text",
				x: 80,
				y: 80,
				width: 320,
				height: 80,
				rotation: 0,
				opacity: 1,
				fontSize: 36,
				fontWeight: 700,
				lineHeight: 1.1,
				letterSpacing: 0,
				align: "left",
				color: "#ffffff",
			}]
		}));
		setCurrentId(docId);
		setSelectedId(id);
	};

	const addShape = () => {
		const docId = ensureDoc("flyer");
		snapshot();
		const id = uid();
		commitDocs((prev) => prev.map((doc) => doc.id !== docId ? doc : {
			...doc,
			updatedAt: Date.now(),
			elements: [...doc.elements, {
				id,
				type: "shape",
				x: 120,
				y: 120,
				width: 240,
				height: 160,
				rotation: 0,
				opacity: 1,
				fill: "#ef4444",
				stroke: "#ffffff",
				strokeWidth: 0,
				radius: 16,
			}]
		}));
		setCurrentId(docId);
		setSelectedId(id);
	};

	const addImage = () => {
		const input = document.createElement("input");
		input.type = "file";
		input.accept = "image/*";
		input.onchange = () => {
			const file = input.files?.[0];
			if (!file) return;
			const reader = new FileReader();
			reader.onload = () => {
				const docId = ensureDoc("flyer");
				snapshot();
				const id = uid();
				commitDocs((prev) => prev.map((doc) => doc.id !== docId ? doc : {
					...doc,
					updatedAt: Date.now(),
					elements: [...doc.elements, {
						id,
						type: "image",
						x: 140,
						y: 140,
						width: 320,
						height: 240,
						rotation: 0,
						opacity: 1,
						fit: "cover",
						src: String(reader.result || ""),
					}]
				}));
				setCurrentId(docId);
				setSelectedId(id);
			};
			reader.readAsDataURL(file);
		};
		input.click();
	};

	const removeSelected = () => {
		if (!currentDoc || !selectedId) return;
		snapshot();
		commitDocs((prev) => prev.map((doc) => doc.id !== currentDoc.id ? doc : {
			...doc,
			updatedAt: Date.now(),
			elements: doc.elements.filter((el) => el.id !== selectedId),
		}));
		setSelectedId(null);
	};

	const duplicateSelected = () => {
		if (!currentDoc || !selected) return;
		snapshot();
		const dupe = { ...clone(selected), id: uid(), x: selected.x + 24, y: selected.y + 24 };
		commitDocs((prev) => prev.map((doc) => doc.id !== currentDoc.id ? doc : {
			...doc,
			updatedAt: Date.now(),
			elements: [...doc.elements, dupe],
		}));
		setSelectedId(dupe.id);
	};

	const moveLayer = (dir) => {
		if (!currentDoc || !selectedId) return;
		const idx = currentDoc.elements.findIndex((el) => el.id === selectedId);
		if (idx < 0) return;
		const nextIdx = dir === "up" ? idx + 1 : idx - 1;
		if (nextIdx < 0 || nextIdx >= currentDoc.elements.length) return;
		snapshot();
		const elements = currentDoc.elements.slice();
		const [item] = elements.splice(idx, 1);
		elements.splice(nextIdx, 0, item);
		commitDocs((prev) => prev.map((doc) => doc.id !== currentDoc.id ? doc : { ...doc, updatedAt: Date.now(), elements }));
	};

	const undo = () => {
		setHistory((prev) => {
			if (!prev.length) return prev;
			const last = prev[prev.length - 1];
			setFuture((f) => [clone(docs), ...f]);
			setDocs(last);
			saveDocs(orgId, last);
			const nextCurrent = last.find((d) => d.id === currentId)?.id || last[0]?.id || null;
			setCurrentId(nextCurrent);
			setSelectedId(null);
			return prev.slice(0, -1);
		});
	};

	const redo = () => {
		setFuture((prev) => {
			if (!prev.length) return prev;
			const [first, ...rest] = prev;
			setHistory((h) => [...h, clone(docs)]);
			setDocs(first);
			saveDocs(orgId, first);
			const nextCurrent = first.find((d) => d.id === currentId)?.id || first[0]?.id || null;
			setCurrentId(nextCurrent);
			setSelectedId(null);
			return rest;
		});
	};

	React.useEffect(() => {
		const onKey = (e) => {
			if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z") {
				e.preventDefault();
				if (e.shiftKey) redo(); else undo();
				return;
			}
			if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "y") {
				e.preventDefault();
				redo();
				return;
			}
			if ((e.key === "Delete" || e.key === "Backspace") && selectedId) {
				const tag = document.activeElement?.tagName?.toLowerCase();
				if (tag !== "input" && tag !== "textarea" && document.activeElement?.contentEditable !== "true") {
					e.preventDefault();
					removeSelected();
				}
			}
		};
		window.addEventListener("keydown", onKey);
		return () => window.removeEventListener("keydown", onKey);
	}, [selectedId, docs, currentId]);

	const startDrag = (e, el) => {
		e.preventDefault();
		e.stopPropagation();
		setSelectedId(el.id);
		setDraggingId(el.id);
		const rect = e.currentTarget.parentElement.getBoundingClientRect();
		setDragOffset({ x: e.clientX - rect.left - el.x, y: e.clientY - rect.top - el.y });
	};

	React.useEffect(() => {
		if (!draggingId) return;
		const onMove = (e) => {
			const canvas = document.getElementById("bf-studio-canvas");
			if (!canvas || !currentDoc) return;
			const rect = canvas.getBoundingClientRect();
			const x = Math.max(0, Math.min(currentDoc.width - 20, e.clientX - rect.left - dragOffset.x));
			const y = Math.max(0, Math.min(currentDoc.height - 20, e.clientY - rect.top - dragOffset.y));
			updateElement(draggingId, { x, y });
		};
		const onUp = () => setDraggingId(null);
		window.addEventListener("mousemove", onMove);
		window.addEventListener("mouseup", onUp);
		return () => {
			window.removeEventListener("mousemove", onMove);
			window.removeEventListener("mouseup", onUp);
		};
	}, [draggingId, dragOffset, currentDoc]);

	const exportJson = () => {
		if (!currentDoc) return;
		downloadBlob(`${currentDoc.name.replace(/\s+/g, "-").toLowerCase() || "design"}.json`, new Blob([JSON.stringify(currentDoc, null, 2)], { type: "application/json" }));
	};

	const exportPng = async () => {
		if (!currentDoc) return;
		const canvasEl = document.getElementById("bf-studio-canvas");
		if (!canvasEl) return;
		const svg = `
		<svg xmlns="http://www.w3.org/2000/svg" width="${currentDoc.width}" height="${currentDoc.height}">
			<foreignObject width="100%" height="100%">
				<div xmlns="http://www.w3.org/1999/xhtml" style="width:${currentDoc.width}px;height:${currentDoc.height}px;background:#111827;position:relative;overflow:hidden;">
					${canvasEl.innerHTML}
				</div>
			</foreignObject>
		</svg>`;
		const blob = new Blob([svg], { type: "image/svg+xml;charset=utf-8" });
		const url = URL.createObjectURL(blob);
		const img = new Image();
		img.onload = () => {
			const c = document.createElement("canvas");
			c.width = currentDoc.width;
			c.height = currentDoc.height;
			const ctx = c.getContext("2d");
			ctx.fillStyle = "#111827";
			ctx.fillRect(0, 0, c.width, c.height);
			ctx.drawImage(img, 0, 0);
			c.toBlob((png) => {
				if (png) downloadBlob(`${currentDoc.name.replace(/\s+/g, "-").toLowerCase() || "design"}.png`, png);
				URL.revokeObjectURL(url);
			}, "image/png");
		};
		img.src = url;
	};

	const exportPdf = () => window.print();

	const scale = React.useMemo(() => {
		if (!currentDoc) return 1;
		return Math.min(1, 780 / currentDoc.width);
	}, [currentDoc]);

	return (
		<div style={{ padding: 16, display: "grid", gridTemplateColumns: "280px minmax(0,1fr) 320px", gap: 16 }}>
			<div style={{ background: "#111827", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 16, padding: 14 }}>
				<div style={{ fontSize: 18, fontWeight: 800, marginBottom: 10 }}>Bondfire Studio</div>
				<div style={{ display: "grid", gap: 8 }}>
					<button onClick={() => createDoc("flyer")}>New Flyer</button>
					<button onClick={() => createDoc("square")}>New Square Post</button>
					<button onClick={() => createDoc("story")}>New Story</button>
					<button onClick={() => createDoc("banner")}>New Banner</button>
					<button onClick={duplicateDoc} disabled={!currentDoc}>Duplicate Document</button>
				</div>
				<hr style={{ margin: "14px 0", opacity: 0.2 }} />
				<div style={{ display: "grid", gap: 8 }}>
					<button onClick={addText}>Add Text</button>
					<button onClick={addShape}>Add Shape</button>
					<button onClick={addImage}>Add Image</button>
				</div>
				<hr style={{ margin: "14px 0", opacity: 0.2 }} />
				<div style={{ display: "grid", gap: 8 }}>
					<button onClick={undo} disabled={!history.length}>Undo</button>
					<button onClick={redo} disabled={!future.length}>Redo</button>
					<button onClick={exportJson} disabled={!currentDoc}>Export JSON</button>
					<button onClick={exportPng} disabled={!currentDoc}>Export PNG</button>
					<button onClick={exportPdf} disabled={!currentDoc}>Export PDF</button>
				</div>
				<hr style={{ margin: "14px 0", opacity: 0.2 }} />
				<div style={{ fontWeight: 700, marginBottom: 8 }}>Documents</div>
				<div style={{ display: "grid", gap: 8, maxHeight: 360, overflow: "auto" }}>
					{docs.length ? docs.map((doc) => (
						<button key={doc.id} onClick={() => { setCurrentId(doc.id); setSelectedId(null); }} style={{ textAlign: "left", border: doc.id === currentId ? "1px solid #ef4444" : "1px solid rgba(255,255,255,0.1)", background: doc.id === currentId ? "rgba(239,68,68,0.15)" : "rgba(255,255,255,0.04)", borderRadius: 12, padding: 10 }}>
							<div style={{ fontWeight: 700 }}>{doc.name}</div>
							<div style={{ opacity: 0.7, fontSize: 12 }}>{doc.width} × {doc.height}</div>
						</button>
					)) : <div style={{ opacity: 0.7 }}>No Studio docs yet for this org.</div>}
				</div>
			</div>

			<div style={{ minWidth: 0 }}>
				<div style={{ marginBottom: 10, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
					<input
						value={currentDoc?.name || ""}
						onChange={(e) => updateDoc({ name: e.target.value })}
						placeholder="Untitled design"
						disabled={!currentDoc}
						style={{ width: "100%", padding: "10px 12px", borderRadius: 12, border: "1px solid rgba(255,255,255,0.12)", background: "#111827", color: "white" }}
					/>
					<div style={{ opacity: 0.7, whiteSpace: "nowrap" }}>{currentDoc ? `${currentDoc.width} × ${currentDoc.height}` : "No canvas"}</div>
				</div>
				<div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 18, padding: 18, overflow: "auto", minHeight: 760 }} onMouseDown={() => setSelectedId(null)}>
					{currentDoc ? (
						<div style={{ width: currentDoc.width * scale, height: currentDoc.height * scale, margin: "0 auto", background: "#111827", borderRadius: 16, boxShadow: "0 24px 80px rgba(0,0,0,0.35)", overflow: "hidden", position: "relative" }}>
							<div id="bf-studio-canvas" style={{ width: currentDoc.width, height: currentDoc.height, transform: `scale(${scale})`, transformOrigin: "top left", position: "relative", background: "linear-gradient(180deg, #1f2937 0%, #0f172a 100%)" }}>
								{currentDoc.elements.map((el, index) => {
									const common = {
										position: "absolute",
										left: el.x,
										top: el.y,
										width: el.width,
										height: el.height,
										opacity: el.opacity ?? 1,
										transform: `rotate(${el.rotation || 0}deg)`,
										cursor: draggingId === el.id ? "grabbing" : "grab",
										boxSizing: "border-box",
										outline: selectedId === el.id ? "2px solid #ef4444" : "none",
										outlineOffset: 2,
									};
									if (el.type === "text") {
										return <div key={el.id} onMouseDown={(e) => startDrag(e, el)} onClick={(e) => { e.stopPropagation(); setSelectedId(el.id); }} style={{ ...common, color: el.color, fontSize: el.fontSize, fontWeight: el.fontWeight, lineHeight: el.lineHeight, letterSpacing: `${el.letterSpacing || 0}px`, textAlign: el.align, whiteSpace: "pre-wrap", overflow: "hidden" }}>{el.text}</div>;
									}
									if (el.type === "shape") {
										return <div key={el.id} onMouseDown={(e) => startDrag(e, el)} onClick={(e) => { e.stopPropagation(); setSelectedId(el.id); }} style={{ ...common, background: el.fill, border: `${el.strokeWidth || 0}px solid ${el.stroke || "transparent"}`, borderRadius: el.radius || 0 }} />;
									}
									return <img key={el.id} alt="" src={el.src} onMouseDown={(e) => startDrag(e, el)} onClick={(e) => { e.stopPropagation(); setSelectedId(el.id); }} style={{ ...common, objectFit: el.fit || "cover", borderRadius: 12, userSelect: "none", pointerEvents: "auto" }} draggable={false} />;
								})}
							</div>
						</div>
					) : (
						<div style={{ minHeight: 600, display: "grid", placeItems: "center", opacity: 0.7 }}>Create a document to start.</div>
					)}
				</div>
			</div>

			<div style={{ background: "#111827", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 16, padding: 14 }}>
				<div style={{ fontWeight: 800, marginBottom: 10 }}>Inspector</div>
				{selected ? (
					<div style={{ display: "grid", gap: 10 }}>
						<div style={{ display: "grid", gap: 6 }}>
							<label>Layer actions</label>
							<div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
								<button onClick={duplicateSelected}>Duplicate</button>
								<button onClick={removeSelected}>Delete</button>
								<button onClick={() => moveLayer("down")}>Back</button>
								<button onClick={() => moveLayer("up")}>Forward</button>
							</div>
						</div>
						<div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
							<label>X<input type="number" value={Math.round(selected.x)} onChange={(e) => updateElement(selected.id, { x: Number(e.target.value || 0) })} style={{ width: "100%" }} /></label>
							<label>Y<input type="number" value={Math.round(selected.y)} onChange={(e) => updateElement(selected.id, { y: Number(e.target.value || 0) })} style={{ width: "100%" }} /></label>
							<label>Width<input type="number" value={Math.round(selected.width)} onChange={(e) => updateElement(selected.id, { width: Number(e.target.value || 1) })} style={{ width: "100%" }} /></label>
							<label>Height<input type="number" value={Math.round(selected.height)} onChange={(e) => updateElement(selected.id, { height: Number(e.target.value || 1) })} style={{ width: "100%" }} /></label>
							<label>Rotation<input type="number" value={selected.rotation || 0} onChange={(e) => updateElement(selected.id, { rotation: Number(e.target.value || 0) })} style={{ width: "100%" }} /></label>
							<label>Opacity<input type="number" min="0" max="1" step="0.05" value={selected.opacity ?? 1} onChange={(e) => updateElement(selected.id, { opacity: Number(e.target.value || 1) })} style={{ width: "100%" }} /></label>
						</div>

						{selected.type === "text" ? (
							<>
								<label>Text<textarea value={selected.text} onChange={(e) => updateElement(selected.id, { text: e.target.value })} rows={5} style={{ width: "100%" }} /></label>
								<div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
									<label>Font size<input type="number" value={selected.fontSize} onChange={(e) => updateElement(selected.id, { fontSize: Number(e.target.value || 12) })} style={{ width: "100%" }} /></label>
									<label>Weight<input type="number" value={selected.fontWeight || 700} onChange={(e) => updateElement(selected.id, { fontWeight: Number(e.target.value || 400) })} style={{ width: "100%" }} /></label>
									<label>Line height<input type="number" step="0.05" value={selected.lineHeight || 1.1} onChange={(e) => updateElement(selected.id, { lineHeight: Number(e.target.value || 1.1) })} style={{ width: "100%" }} /></label>
									<label>Letter spacing<input type="number" value={selected.letterSpacing || 0} onChange={(e) => updateElement(selected.id, { letterSpacing: Number(e.target.value || 0) })} style={{ width: "100%" }} /></label>
								</div>
								<label>Alignment<select value={selected.align || "left"} onChange={(e) => updateElement(selected.id, { align: e.target.value })} style={{ width: "100%" }}><option value="left">Left</option><option value="center">Center</option><option value="right">Right</option></select></label>
								<label>Text color<input type="color" value={selected.color || "#ffffff"} onChange={(e) => updateElement(selected.id, { color: e.target.value })} style={{ width: "100%" }} /></label>
							</>
						) : null}

						{selected.type === "shape" ? (
							<>
								<label>Fill<input type="color" value={selected.fill || "#ef4444"} onChange={(e) => updateElement(selected.id, { fill: e.target.value })} style={{ width: "100%" }} /></label>
								<label>Stroke<input type="color" value={selected.stroke || "#ffffff"} onChange={(e) => updateElement(selected.id, { stroke: e.target.value })} style={{ width: "100%" }} /></label>
								<div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
									<label>Stroke width<input type="number" value={selected.strokeWidth || 0} onChange={(e) => updateElement(selected.id, { strokeWidth: Number(e.target.value || 0) })} style={{ width: "100%" }} /></label>
									<label>Radius<input type="number" value={selected.radius || 0} onChange={(e) => updateElement(selected.id, { radius: Number(e.target.value || 0) })} style={{ width: "100%" }} /></label>
								</div>
							</>
						) : null}

						{selected.type === "image" ? (
							<label>Fit<select value={selected.fit || "cover"} onChange={(e) => updateElement(selected.id, { fit: e.target.value })} style={{ width: "100%" }}><option value="cover">Cover</option><option value="contain">Contain</option><option value="fill">Fill</option></select></label>
						) : null}

						<div>
							<div style={{ fontWeight: 700, marginBottom: 8 }}>Layers</div>
							<div style={{ display: "grid", gap: 6 }}>
								{(currentDoc?.elements || []).map((el, idx) => (
									<button key={el.id} onClick={() => setSelectedId(el.id)} style={{ textAlign: "left", border: el.id === selectedId ? "1px solid #ef4444" : "1px solid rgba(255,255,255,0.08)", background: el.id === selectedId ? "rgba(239,68,68,0.15)" : "rgba(255,255,255,0.04)", borderRadius: 10, padding: 8 }}>
										{idx + 1}. {el.type}
									</button>
								))}
							</div>
						</div>
					</div>
				) : (
					<div style={{ opacity: 0.7 }}>Select an element to edit it.</div>
				)}
			</div>
		</div>
	);
}
