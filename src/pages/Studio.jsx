
import React from "react";
import { useParams } from "react-router-dom";

const PRESETS = {
	flyer: { label: "Flyer", width: 1080, height: 1350 },
	square: { label: "Square Post", width: 1080, height: 1080 },
	story: { label: "Story", width: 1080, height: 1920 },
	banner: { label: "Banner", width: 1600, height: 900 },
};

const FONT_OPTIONS = [
	"Inter, system-ui, sans-serif",
	"Arial, sans-serif",
	"Georgia, serif",
	"Times New Roman, serif",
	"Trebuchet MS, sans-serif",
	"Courier New, monospace",
	"Impact, sans-serif",
];

const TEMPLATE_LIBRARY = {
	eventFlyer: {
		label: "Event Flyer",
		preset: "flyer",
		build: (bindings) => ({
			name: "Event Flyer",
			elements: [
				makeShapeElement({ x: 0, y: 0, width: 1080, height: 1350, fill: "#0f172a", radius: 0 }),
				makeShapeElement({ x: 70, y: 70, width: 940, height: 1210, fill: "rgba(255,255,255,0.03)", stroke: "#ef4444", strokeWidth: 2, radius: 32 }),
				makeTextElement({
					text: "{{org.name}}",
					x: 90,
					y: 110,
					width: 900,
					height: 70,
					fontSize: 28,
					fontWeight: 700,
					letterSpacing: 1,
					color: "#fca5a5",
					name: "Org Name",
				}),
				makeTextElement({
					text: "{{meeting.title}}",
					x: 90,
					y: 200,
					width: 900,
					height: 180,
					fontSize: 86,
					fontWeight: 800,
					lineHeight: 0.95,
					color: "#ffffff",
					name: "Event Title",
				}),
				makeTextElement({
					text: "{{meeting.date}}\n{{meeting.location}}",
					x: 90,
					y: 420,
					width: 420,
					height: 200,
					fontSize: 34,
					fontWeight: 600,
					lineHeight: 1.2,
					color: "#e5e7eb",
					name: "Time and Place",
				}),
				makeTextElement({
					text: "show up\nbring people\nbring supplies",
					x: 90,
					y: 650,
					width: 420,
					height: 180,
					fontSize: 28,
					fontWeight: 600,
					lineHeight: 1.25,
					color: "#f9fafb",
					name: "Action Copy",
				}),
				makeShapeElement({
					x: 570,
					y: 420,
					width: 350,
					height: 350,
					fill: "#111827",
					stroke: "#fca5a5",
					strokeWidth: 2,
					radius: 28,
					name: "Image Frame",
				}),
				makeTextElement({
					text: "{{org.contact}}",
					x: 90,
					y: 1140,
					width: 900,
					height: 50,
					fontSize: 22,
					fontWeight: 500,
					color: "#d1d5db",
					name: "Contact",
				}),
			],
		}),
	},
	needPost: {
		label: "Need Post",
		preset: "square",
		build: () => ({
			name: "Need Post",
			elements: [
				makeShapeElement({ x: 0, y: 0, width: 1080, height: 1080, fill: "#111827", radius: 0 }),
				makeTextElement({
					text: "{{org.name}} needs",
					x: 80,
					y: 90,
					width: 920,
					height: 90,
					fontSize: 42,
					fontWeight: 700,
					color: "#fca5a5",
					name: "Heading",
				}),
				makeTextElement({
					text: "{{need.title}}",
					x: 80,
					y: 220,
					width: 920,
					height: 170,
					fontSize: 82,
					fontWeight: 800,
					lineHeight: 0.95,
					color: "#ffffff",
					name: "Need Title",
				}),
				makeTextElement({
					text: "{{need.description}}",
					x: 80,
					y: 450,
					width: 920,
					height: 250,
					fontSize: 30,
					fontWeight: 500,
					lineHeight: 1.25,
					color: "#e5e7eb",
					name: "Need Description",
				}),
				makeTextElement({
					text: "{{org.contact}}",
					x: 80,
					y: 930,
					width: 920,
					height: 50,
					fontSize: 24,
					fontWeight: 500,
					color: "#d1d5db",
					name: "Contact",
				}),
			],
		}),
	},
	meetingCard: {
		label: "Meeting Graphic",
		preset: "story",
		build: () => ({
			name: "Meeting Graphic",
			elements: [
				makeShapeElement({ x: 0, y: 0, width: 1080, height: 1920, fill: "#0b1020", radius: 0 }),
				makeTextElement({
					text: "{{org.name}}",
					x: 80,
					y: 120,
					width: 920,
					height: 70,
					fontSize: 34,
					fontWeight: 700,
					letterSpacing: 2,
					color: "#fca5a5",
					name: "Org Name",
				}),
				makeTextElement({
					text: "{{meeting.title}}",
					x: 80,
					y: 260,
					width: 920,
					height: 260,
					fontSize: 98,
					fontWeight: 800,
					lineHeight: 0.92,
					color: "#ffffff",
					name: "Meeting Title",
				}),
				makeTextElement({
					text: "{{meeting.date}}",
					x: 80,
					y: 630,
					width: 920,
					height: 80,
					fontSize: 38,
					fontWeight: 700,
					color: "#e5e7eb",
					name: "Meeting Date",
				}),
				makeTextElement({
					text: "{{meeting.location}}",
					x: 80,
					y: 730,
					width: 920,
					height: 160,
					fontSize: 42,
					fontWeight: 600,
					lineHeight: 1.15,
					color: "#f9fafb",
					name: "Meeting Location",
				}),
				makeShapeElement({ x: 80, y: 1030, width: 920, height: 520, fill: "rgba(255,255,255,0.04)", stroke: "#ef4444", strokeWidth: 2, radius: 32, name: "Content Box" }),
				makeTextElement({
					text: "all ages welcome\nmasking encouraged\nbring what you can",
					x: 120,
					y: 1090,
					width: 820,
					height: 300,
					fontSize: 42,
					fontWeight: 600,
					lineHeight: 1.2,
					color: "#ffffff",
					name: "Notes",
				}),
			],
		}),
	},
	volunteerCall: {
		label: "Volunteer Call",
		preset: "banner",
		build: () => ({
			name: "Volunteer Call",
			elements: [
				makeShapeElement({ x: 0, y: 0, width: 1600, height: 900, fill: "#111827", radius: 0 }),
				makeShapeElement({ x: 50, y: 50, width: 1500, height: 800, fill: "rgba(255,255,255,0.03)", stroke: "#ef4444", strokeWidth: 2, radius: 28 }),
				makeTextElement({
					text: "{{org.name}}",
					x: 100,
					y: 110,
					width: 1320,
					height: 50,
					fontSize: 28,
					fontWeight: 700,
					letterSpacing: 1.5,
					color: "#fca5a5",
					name: "Org Name",
				}),
				makeTextElement({
					text: "volunteers needed",
					x: 100,
					y: 200,
					width: 840,
					height: 180,
					fontSize: 96,
					fontWeight: 800,
					lineHeight: 0.95,
					color: "#ffffff",
					name: "Heading",
				}),
				makeTextElement({
					text: "{{need.title}}",
					x: 100,
					y: 430,
					width: 860,
					height: 120,
					fontSize: 42,
					fontWeight: 600,
					lineHeight: 1.1,
					color: "#e5e7eb",
					name: "Need Title",
				}),
				makeTextElement({
					text: "{{org.contact}}",
					x: 100,
					y: 720,
					width: 860,
					height: 50,
					fontSize: 24,
					fontWeight: 500,
					color: "#d1d5db",
					name: "Contact",
				}),
				makeShapeElement({ x: 1080, y: 170, width: 350, height: 350, fill: "#1f2937", stroke: "#fca5a5", strokeWidth: 2, radius: 999, name: "Badge" }),
				makeTextElement({
					text: "join\nus",
					x: 1155,
					y: 250,
					width: 200,
					height: 140,
					fontSize: 64,
					fontWeight: 800,
					align: "center",
					color: "#ffffff",
					name: "Badge Text",
				}),
			],
		}),
	},
};

function storageKey(orgId) {
	return `bf_studio_docs_${orgId}`;
}

function uid() {
	return `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function clone(obj) {
	return JSON.parse(JSON.stringify(obj));
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

function makeTextElement(patch = {}) {
	return {
		id: uid(),
		type: "text",
		name: patch.name || "Text",
		locked: false,
		hidden: false,
		text: "new text",
		x: 80,
		y: 80,
		width: 320,
		height: 80,
		rotation: 0,
		opacity: 1,
		fontSize: 36,
		fontWeight: 700,
		fontFamily: FONT_OPTIONS[0],
		lineHeight: 1.1,
		letterSpacing: 0,
		align: "left",
		color: "#ffffff",
		...patch,
	};
}

function makeShapeElement(patch = {}) {
	return {
		id: uid(),
		type: "shape",
		name: patch.name || "Shape",
		locked: false,
		hidden: false,
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
		...patch,
	};
}

function makeImageElement(patch = {}) {
	return {
		id: uid(),
		type: "image",
		name: patch.name || "Image",
		locked: false,
		hidden: false,
		x: 140,
		y: 140,
		width: 320,
		height: 240,
		rotation: 0,
		opacity: 1,
		fit: "cover",
		src: "",
		...patch,
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

function downloadBlob(filename, blob) {
	const url = URL.createObjectURL(blob);
	const a = document.createElement("a");
	a.href = url;
	a.download = filename;
	a.click();
	setTimeout(() => URL.revokeObjectURL(url), 500);
}

function readJson(key, fallback) {
	try {
		const parsed = JSON.parse(localStorage.getItem(key) || JSON.stringify(fallback));
		return parsed ?? fallback;
	} catch {
		return fallback;
	}
}

function getOrgBindings(orgId) {
	const orgs = readJson("bf_orgs", []);
	const settings = readJson(`bf_org_settings_${orgId}`, {});
	const meetings = readJson(`bf_meetings_${orgId}`, []);
	const needs = readJson(`bf_needs_${orgId}`, []);

	const org = Array.isArray(orgs) ? orgs.find((x) => String(x?.id) === String(orgId)) || {} : {};
	const firstMeeting = Array.isArray(meetings) ? meetings[0] || {} : {};
	const firstNeed = Array.isArray(needs) ? needs[0] || {} : {};

	const contact = settings?.publicEmail || settings?.contactEmail || settings?.email || settings?.contact || settings?.publicContact || "";
	const location = firstMeeting?.location || firstMeeting?.where || settings?.address || settings?.city || "";
	const date = firstMeeting?.startsAt || firstMeeting?.date || firstMeeting?.time || "";

	return {
		"org.name": String(settings?.name || org?.name || "Bondfire Org"),
		"org.contact": String(contact || "contact this org"),
		"meeting.title": String(firstMeeting?.title || firstMeeting?.name || "community meeting"),
		"meeting.date": String(date || "date tbd"),
		"meeting.location": String(location || "location tbd"),
		"need.title": String(firstNeed?.title || firstNeed?.name || "supplies and support"),
		"need.description": String(firstNeed?.description || firstNeed?.details || "bring what you can and spread the word"),
	};
}

function applyBindings(text, bindings) {
	if (typeof text !== "string") return text;
	return text.replace(/\{\{\s*([^}]+)\s*\}\}/g, (_, token) => {
		const key = String(token || "").trim();
		return bindings[key] ?? `{{${key}}}`;
	});
}

function printableName(name, fallback = "design") {
	return String(name || fallback).trim().replace(/\s+/g, "-").replace(/[^a-zA-Z0-9-_]/g, "").toLowerCase() || fallback;
}


function blocksKey(orgId) {
	return `bf_studio_blocks_${orgId}`;
}

function readBlocks(orgId) {
	if (!orgId) return [];
	return readJson(blocksKey(orgId), []);
}

function saveBlocks(orgId, blocks) {
	localStorage.setItem(blocksKey(orgId), JSON.stringify(blocks));
}

function getBrandKit(orgId) {
	const settings = readJson(`bf_org_settings_${orgId}`, {});
	return {
		name: String(settings?.name || "Bondfire Org"),
		primary: String(settings?.brandPrimary || settings?.primaryColor || "#ef4444"),
		secondary: String(settings?.brandSecondary || settings?.secondaryColor || "#111827"),
		accent: String(settings?.brandAccent || settings?.accentColor || "#fca5a5"),
		text: String(settings?.brandText || settings?.textColor || "#ffffff"),
	};
}

function snapValue(value, targets, threshold = 8) {
	for (const target of targets) {
		if (Math.abs(value - target) <= threshold) return target;
	}
	return value;
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
	const [showTemplates, setShowTemplates] = React.useState(false);
	const [showBoundPreview, setShowBoundPreview] = React.useState(true);
	const [savedAt, setSavedAt] = React.useState(0);
	const [resizingId, setResizingId] = React.useState(null);
	const [resizeOrigin, setResizeOrigin] = React.useState(null);
	const [savedBlocks, setSavedBlocks] = React.useState(() => readBlocks(orgId));

	React.useEffect(() => {
		const nextDocs = readDocs(orgId);
		setDocs(nextDocs);
		setCurrentId(nextDocs[0]?.id || null);
		setSelectedId(null);
		setHistory([]);
		setFuture([]);
		setSavedBlocks(readBlocks(orgId));
	}, [orgId]);

	const bindings = React.useMemo(() => getOrgBindings(orgId), [orgId]);
	const brandKit = React.useMemo(() => getBrandKit(orgId), [orgId]);
	const currentDoc = React.useMemo(() => docs.find((doc) => doc.id === currentId) || null, [docs, currentId]);
	const selected = React.useMemo(() => currentDoc?.elements?.find((el) => el.id === selectedId) || null, [currentDoc, selectedId]);

	const commitDocs = React.useCallback((updater) => {
		setDocs((prev) => {
			const next = typeof updater === "function" ? updater(prev) : updater;
			saveDocs(orgId, next);
			setSavedAt(Date.now());
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
		setSavedAt(Date.now());
		setCurrentId(doc.id);
		return doc.id;
	}, [currentDoc, orgId]);

	const createDoc = React.useCallback((preset = "flyer") => {
		snapshot();
		const doc = makeDoc(preset);
		commitDocs((prev) => [doc, ...prev]);
		setCurrentId(doc.id);
		setSelectedId(null);
	}, [snapshot, commitDocs]);

	const createTemplateDoc = React.useCallback((templateKey) => {
		const template = TEMPLATE_LIBRARY[templateKey];
		if (!template) return;
		snapshot();
		const base = makeDoc(template.preset);
		const built = template.build(bindings);
		const doc = {
			...base,
			name: built.name || template.label,
			elements: built.elements || [],
			updatedAt: Date.now(),
		};
		commitDocs((prev) => [doc, ...prev]);
		setCurrentId(doc.id);
		setSelectedId(doc.elements[0]?.id || null);
		setShowTemplates(false);
	}, [snapshot, commitDocs, bindings]);

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
		const element = makeTextElement();
		commitDocs((prev) => prev.map((doc) => doc.id !== docId ? doc : {
			...doc,
			updatedAt: Date.now(),
			elements: [...doc.elements, element],
		}));
		setCurrentId(docId);
		setSelectedId(element.id);
	};

	const addShape = () => {
		const docId = ensureDoc("flyer");
		snapshot();
		const element = makeShapeElement();
		commitDocs((prev) => prev.map((doc) => doc.id !== docId ? doc : {
			...doc,
			updatedAt: Date.now(),
			elements: [...doc.elements, element],
		}));
		setCurrentId(docId);
		setSelectedId(element.id);
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
				const element = makeImageElement({
					src: String(reader.result || ""),
					name: file.name || "Image",
				});
				commitDocs((prev) => prev.map((doc) => doc.id !== docId ? doc : {
					...doc,
					updatedAt: Date.now(),
					elements: [...doc.elements, element],
				}));
				setCurrentId(docId);
				setSelectedId(element.id);
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
		const dupe = { ...clone(selected), id: uid(), name: `${selected.name || selected.type} Copy`, x: selected.x + 24, y: selected.y + 24 };
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

	const toggleSelectedFlag = (key) => {
		if (!selected) return;
		snapshot();
		updateElement(selected.id, { [key]: !selected[key] });
	};

	const insertBindingToken = (token) => {
		if (!selected || selected.type !== "text") return;
		snapshot();
		updateElement(selected.id, { text: `${selected.text || ""}${selected.text ? "\n" : ""}{{${token}}}` });
	};

	const addBoundText = (token, label) => {
		const docId = ensureDoc("flyer");
		snapshot();
		const element = makeTextElement({
			name: label,
			text: `{{${token}}}`,
			x: 80,
			y: 80 + (currentDoc?.elements?.length || 0) * 24,
			width: 420,
			height: 80,
		});
		commitDocs((prev) => prev.map((doc) => doc.id !== docId ? doc : {
			...doc,
			updatedAt: Date.now(),
			elements: [...doc.elements, element],
		}));
		setCurrentId(docId);
		setSelectedId(element.id);
	};


	const saveCurrentDoc = () => {
		saveDocs(orgId, docs);
		setSavedAt(Date.now());
	};

	const deleteDoc = (docId) => {
		const target = docs.find((doc) => doc.id === docId);
		if (!target) return;
		const ok = window.confirm(`Delete "${target.name}"?`);
		if (!ok) return;
		snapshot();
		const next = docs.filter((doc) => doc.id !== docId);
		setDocs(next);
		saveDocs(orgId, next);
		setSavedAt(Date.now());
		if (currentId === docId) {
			setCurrentId(next[0]?.id || null);
			setSelectedId(null);
		}
	};

	const saveSelectionAsBlock = () => {
		if (!selected) return;
		const next = [{ id: uid(), name: selected.name || `${selected.type} Block`, element: clone(selected), createdAt: Date.now() }, ...savedBlocks];
		setSavedBlocks(next);
		saveBlocks(orgId, next);
	};

	const addSavedBlock = (block) => {
		if (!block) return;
		const docId = ensureDoc(currentDoc?.preset || "flyer");
		snapshot();
		const element = { ...clone(block.element), id: uid(), x: Number(block.element?.x || 80) + 24, y: Number(block.element?.y || 80) + 24, name: `${block.name} Copy` };
		commitDocs((prev) => prev.map((doc) => doc.id !== docId ? doc : {
			...doc,
			updatedAt: Date.now(),
			elements: [...doc.elements, element],
		}));
		setCurrentId(docId);
		setSelectedId(element.id);
	};

	const removeSavedBlock = (blockId) => {
		const next = savedBlocks.filter((block) => block.id !== blockId);
		setSavedBlocks(next);
		saveBlocks(orgId, next);
	};

	const undo = () => {
		setHistory((prev) => {
			if (!prev.length) return prev;
			const last = prev[prev.length - 1];
			setFuture((f) => [clone(docs), ...f]);
			setDocs(last);
			saveDocs(orgId, last);
			setSavedAt(Date.now());
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
			setSavedAt(Date.now());
			const nextCurrent = first.find((d) => d.id === currentId)?.id || first[0]?.id || null;
			setCurrentId(nextCurrent);
			setSelectedId(null);
			return rest;
		});
	};

	React.useEffect(() => {
		const onKey = (e) => {
			const tag = document.activeElement?.tagName?.toLowerCase();
			const isTyping = tag === "input" || tag === "textarea" || document.activeElement?.contentEditable === "true";

			if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z") {
				e.preventDefault();
				if (e.shiftKey) redo();
				else undo();
				return;
			}
			if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "y") {
				e.preventDefault();
				redo();
				return;
			}
			if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "d" && selectedId && !isTyping) {
				e.preventDefault();
				duplicateSelected();
				return;
			}
			if ((e.key === "Delete" || e.key === "Backspace") && selectedId && !isTyping) {
				e.preventDefault();
				removeSelected();
				return;
			}
			if (selected && !selected.locked && !isTyping) {
				const step = e.shiftKey ? 10 : 1;
				if (e.key === "ArrowLeft") {
					e.preventDefault();
					updateElement(selected.id, { x: Math.max(0, Number(selected.x || 0) - step) });
				}
				if (e.key === "ArrowRight") {
					e.preventDefault();
					updateElement(selected.id, { x: Number(selected.x || 0) + step });
				}
				if (e.key === "ArrowUp") {
					e.preventDefault();
					updateElement(selected.id, { y: Math.max(0, Number(selected.y || 0) - step) });
				}
				if (e.key === "ArrowDown") {
					e.preventDefault();
					updateElement(selected.id, { y: Number(selected.y || 0) + step });
				}
			}
		};
		window.addEventListener("keydown", onKey);
		return () => window.removeEventListener("keydown", onKey);
	}, [selectedId, selected, docs, currentId]);

	const startDrag = (e, el) => {
		if (el.locked) return;
		e.preventDefault();
		e.stopPropagation();
		setSelectedId(el.id);
		setDraggingId(el.id);
		const canvas = document.getElementById("bf-studio-canvas");
		const rect = canvas?.getBoundingClientRect();
		if (!rect) return;
		const scale = currentDoc ? Math.min(1, 780 / currentDoc.width) : 1;
		setDragOffset({
			x: (e.clientX - rect.left) / scale - el.x,
			y: (e.clientY - rect.top) / scale - el.y,
		});
	};


	const startResize = (e, el) => {
		if (el.locked) return;
		e.preventDefault();
		e.stopPropagation();
		setSelectedId(el.id);
		setResizingId(el.id);
		setResizeOrigin({ startX: e.clientX, startY: e.clientY, width: Number(el.width || 1), height: Number(el.height || 1) });
	};

	React.useEffect(() => {
		if (!draggingId) return;
		const onMove = (e) => {
			const canvas = document.getElementById("bf-studio-canvas");
			if (!canvas || !currentDoc) return;
			const rect = canvas.getBoundingClientRect();
			const scale = Math.min(1, 780 / currentDoc.width);
			const dragged = currentDoc.elements.find((el) => el.id === draggingId);
			const rawX = Math.max(0, Math.min(currentDoc.width - 20, (e.clientX - rect.left) / scale - dragOffset.x));
			const rawY = Math.max(0, Math.min(currentDoc.height - 20, (e.clientY - rect.top) / scale - dragOffset.y));
			const x = snapValue(rawX, [0, currentDoc.width / 2, currentDoc.width - Number(dragged?.width || 0), 40, currentDoc.width - Number(dragged?.width || 0) - 40]);
			const y = snapValue(rawY, [0, currentDoc.height / 2, currentDoc.height - Number(dragged?.height || 0), 40, currentDoc.height - Number(dragged?.height || 0) - 40]);
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

	React.useEffect(() => {
		if (!resizingId || !resizeOrigin || !currentDoc) return;
		const onMove = (e) => {
			const el = currentDoc.elements.find((item) => item.id === resizingId);
			if (!el) return;
			const canvas = document.getElementById("bf-studio-canvas");
			const rect = canvas?.getBoundingClientRect();
			const scale = Math.min(1, 780 / currentDoc.width);
			const dx = (e.clientX - resizeOrigin.startX) / scale;
			const dy = (e.clientY - resizeOrigin.startY) / scale;
			const width = snapValue(Math.max(24, resizeOrigin.width + dx), [80, 120, 240, currentDoc.width - Number(el.x || 0) - 40]);
			const height = snapValue(Math.max(24, resizeOrigin.height + dy), [40, 80, 120, 240, currentDoc.height - Number(el.y || 0) - 40]);
			updateElement(resizingId, { width, height });
		};
		const onUp = () => {
			setResizingId(null);
			setResizeOrigin(null);
		};
		window.addEventListener("mousemove", onMove);
		window.addEventListener("mouseup", onUp);
		return () => {
			window.removeEventListener("mousemove", onMove);
			window.removeEventListener("mouseup", onUp);
		};
	}, [resizingId, resizeOrigin, currentDoc]);

	const exportJson = () => {
		if (!currentDoc) return;
		downloadBlob(`${printableName(currentDoc.name)}.json`, new Blob([JSON.stringify(currentDoc, null, 2)], { type: "application/json" }));
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
			if (!ctx) return;
			ctx.fillStyle = "#111827";
			ctx.fillRect(0, 0, c.width, c.height);
			ctx.drawImage(img, 0, 0);
			c.toBlob((png) => {
				if (png) downloadBlob(`${printableName(currentDoc.name)}.png`, png);
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

	const orderedLayers = React.useMemo(() => (currentDoc?.elements || []).map((el, idx) => ({ ...el, _order: idx + 1 })).reverse(), [currentDoc]);

	return (
		<div style={{ padding: 16, display: "grid", gridTemplateColumns: "300px minmax(0,1fr) 360px", gap: 16 }}>
			<div style={{ background: "#111827", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 16, padding: 14 }}>
				<div style={{ fontSize: 18, fontWeight: 800, marginBottom: 10 }}>Bondfire Studio</div>
				<div style={{ display: "grid", gap: 8 }}>
					<button onClick={() => createDoc("flyer")}>New Flyer</button>
					<button onClick={() => createDoc("square")}>New Square Post</button>
					<button onClick={() => createDoc("story")}>New Story</button>
					<button onClick={() => createDoc("banner")}>New Banner</button>
					<button onClick={() => setShowTemplates((v) => !v)}>{showTemplates ? "Hide Templates" : "Show Templates"}</button>
					<button onClick={duplicateDoc} disabled={!currentDoc}>Duplicate Document</button>
					<button onClick={saveCurrentDoc} disabled={!currentDoc}>Save Now</button>
					<button onClick={() => currentDoc && deleteDoc(currentDoc.id)} disabled={!currentDoc}>Delete Current Doc</button>
				</div>

				{showTemplates ? (
					<div style={{ marginTop: 12, padding: 12, borderRadius: 12, background: "rgba(255,255,255,0.04)", display: "grid", gap: 8 }}>
						<div style={{ fontWeight: 700 }}>Starter Templates</div>
						{Object.entries(TEMPLATE_LIBRARY).map(([key, item]) => (
							<button key={key} onClick={() => createTemplateDoc(key)} style={{ textAlign: "left" }}>
								<div style={{ fontWeight: 700 }}>{item.label}</div>
								<div style={{ opacity: 0.7, fontSize: 12 }}>{PRESETS[item.preset]?.label || item.preset}</div>
							</button>
						))}
					</div>
				) : null}

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

				<div style={{ fontWeight: 700, marginBottom: 8 }}>Bondfire Data</div>
				<div style={{ fontSize: 12, opacity: 0.8, marginBottom: 8 }}>These tokens are live placeholders. Example: {{meeting.title}} resolves to your current Bondfire meeting title when preview is on.</div>
				<div style={{ display: "flex", gap: 8, marginBottom: 10 }}><button onClick={() => setShowBoundPreview((v) => !v)}>{showBoundPreview ? "Show Raw Tokens" : "Show Live Preview"}</button></div>
				<div style={{ display: "grid", gap: 6, marginBottom: 10 }}>
					{Object.entries(bindings).map(([key, value]) => (
						<div key={key} style={{ background: "rgba(255,255,255,0.04)", borderRadius: 10, padding: 8 }}>
							<div style={{ fontSize: 12, color: "#fca5a5" }}>{`{{${key}}}`}</div>
							<div style={{ fontSize: 12, opacity: 0.8, marginTop: 4 }}>{String(value || "—")}</div>
							<div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6, marginTop: 6 }}>
								<button onClick={() => addBoundText(key, key)}>Add</button>
								<button onClick={() => insertBindingToken(key)} disabled={!selected || selected.type !== "text"}>Insert</button>
							</div>
						</div>
					))}
				</div>

				<hr style={{ margin: "14px 0", opacity: 0.2 }} />

				<div style={{ fontWeight: 700, marginBottom: 8 }}>Documents</div>
				<div style={{ display: "grid", gap: 8, maxHeight: 320, overflow: "auto" }}>
					{docs.length ? docs.map((doc) => (
						<div key={doc.id} style={{ border: doc.id === currentId ? "1px solid #ef4444" : "1px solid rgba(255,255,255,0.1)", background: doc.id === currentId ? "rgba(239,68,68,0.15)" : "rgba(255,255,255,0.04)", borderRadius: 12, padding: 10 }}>
							<button
								onClick={() => { setCurrentId(doc.id); setSelectedId(null); }}
								style={{ textAlign: "left", width: "100%", background: "transparent", border: "none", padding: 0 }}
							>
								<div style={{ fontWeight: 700 }}>{doc.name}</div>
								<div style={{ opacity: 0.7, fontSize: 12 }}>{doc.width} × {doc.height}</div>
							</button>
							<div style={{ display: "flex", gap: 8, marginTop: 8 }}>
								<button onClick={() => { setCurrentId(doc.id); setSelectedId(null); }}>Open</button>
								<button onClick={() => deleteDoc(doc.id)}>Delete</button>
							</div>
						</div>
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
					<div style={{ display: "grid", justifyItems: "end", gap: 4 }}><div style={{ opacity: 0.7, whiteSpace: "nowrap" }}>{currentDoc ? `${currentDoc.width} × ${currentDoc.height}` : "No canvas"}</div><div style={{ opacity: 0.65, fontSize: 12 }}>{savedAt ? `Saved locally ${new Date(savedAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}` : ""}</div></div>
				</div>

				<div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 18, padding: 18, overflow: "auto", minHeight: 760 }} onMouseDown={() => setSelectedId(null)}>
					{currentDoc ? (
						<div style={{ width: currentDoc.width * scale, height: currentDoc.height * scale, margin: "0 auto", background: "#111827", borderRadius: 16, boxShadow: "0 24px 80px rgba(0,0,0,0.35)", overflow: "hidden", position: "relative" }}>
							<div id="bf-studio-canvas" style={{ width: currentDoc.width, height: currentDoc.height, transform: `scale(${scale})`, transformOrigin: "top left", position: "relative", background: "linear-gradient(180deg, #1f2937 0%, #0f172a 100%)" }}>
								{(currentDoc.elements || []).map((el) => {
									if (el.hidden) return null;
									const common = {
										position: "absolute",
										left: el.x,
										top: el.y,
										width: el.width,
										height: el.height,
										opacity: el.opacity ?? 1,
										transform: `rotate(${el.rotation || 0}deg)`,
										cursor: el.locked ? "not-allowed" : (draggingId === el.id ? "grabbing" : "grab"),
										boxSizing: "border-box",
										outline: selectedId === el.id ? "2px solid #ef4444" : "none",
										outlineOffset: 2,
										userSelect: "none",
									};
									if (el.type === "text") {
										return (
											<div
												key={el.id}
												onMouseDown={(e) => startDrag(e, el)}
												onClick={(e) => { e.stopPropagation(); setSelectedId(el.id); }}
												style={{
													...common,
													color: el.color,
													fontSize: el.fontSize,
													fontWeight: el.fontWeight,
													fontFamily: el.fontFamily || FONT_OPTIONS[0],
													lineHeight: el.lineHeight,
													letterSpacing: `${el.letterSpacing || 0}px`,
													textAlign: el.align,
													whiteSpace: "pre-wrap",
													overflow: "hidden",
													pointerEvents: "auto",
												}}
											>
												{showBoundPreview ? applyBindings(el.text, bindings) : el.text}
												{selectedId === el.id && !el.locked ? <div onMouseDown={(e) => startResize(e, el)} style={{ position: "absolute", right: -7, bottom: -7, width: 14, height: 14, borderRadius: 999, background: "#ef4444", border: "2px solid white", cursor: "nwse-resize" }} /> : null}
											</div>
										);
									}
									if (el.type === "shape") {
										return (
											<div
												key={el.id}
												onMouseDown={(e) => startDrag(e, el)}
												onClick={(e) => { e.stopPropagation(); setSelectedId(el.id); }}
												style={{
													...common,
													background: el.fill,
													border: `${el.strokeWidth || 0}px solid ${el.stroke || "transparent"}`,
													borderRadius: el.radius || 0,
												}}
											/>
										);
									}
									return (
										<img
											key={el.id}
											alt=""
											src={el.src}
											onMouseDown={(e) => startDrag(e, el)}
											onClick={(e) => { e.stopPropagation(); setSelectedId(el.id); }}
											style={{ ...common, objectFit: el.fit || "cover", borderRadius: 12, pointerEvents: "auto" }}
											draggable={false}
										/>
									);
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
							<label>Layer name</label>
							<input value={selected.name || ""} onChange={(e) => updateElement(selected.id, { name: e.target.value })} style={{ width: "100%" }} />
						</div>

						<div style={{ display: "grid", gap: 6 }}>
							<label>Layer actions</label>
							<div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
								<button onClick={duplicateSelected}>Duplicate</button>
								<button onClick={removeSelected}>Delete</button>
								<button onClick={() => moveLayer("down")}>Back</button>
								<button onClick={() => moveLayer("up")}>Forward</button>
								<button onClick={() => toggleSelectedFlag("locked")}>{selected.locked ? "Unlock" : "Lock"}</button>
								<button onClick={() => toggleSelectedFlag("hidden")}>{selected.hidden ? "Show" : "Hide"}</button>
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
								<label>Font family<select value={selected.fontFamily || FONT_OPTIONS[0]} onChange={(e) => updateElement(selected.id, { fontFamily: e.target.value })} style={{ width: "100%" }}>
									{FONT_OPTIONS.map((font) => <option key={font} value={font}>{font}</option>)}
								</select></label>
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
					</div>
				) : (
					<div style={{ opacity: 0.7, marginBottom: 14 }}>Select an element to edit it.</div>
				)}

				<div style={{ marginTop: 14 }}>
					<div style={{ fontWeight: 700, marginBottom: 8 }}>Brand Kit</div>
					<div style={{ display: "grid", gap: 8, marginBottom: 14 }}>
						<div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8 }}>
							{[brandKit.primary, brandKit.secondary, brandKit.accent, brandKit.text].map((color) => <button key={color} onClick={() => selected?.type === "text" ? updateElement(selected.id, { color }) : selected?.type === "shape" ? updateElement(selected.id, { fill: color }) : null} style={{ height: 32, background: color, borderRadius: 8, border: "1px solid rgba(255,255,255,0.2)" }} />)}
						</div>
						<div style={{ fontSize: 12, opacity: 0.72 }}>Tap a swatch to apply it to the selected text or shape.</div>
					</div>
					<div style={{ fontWeight: 700, marginBottom: 8 }}>Saved Blocks</div>
					<div style={{ display: "grid", gap: 8, marginBottom: 14 }}>
						<button onClick={saveSelectionAsBlock} disabled={!selected}>Save Selected as Block</button>
						<div style={{ display: "grid", gap: 6, maxHeight: 180, overflow: "auto" }}>
							{savedBlocks.length ? savedBlocks.map((block) => <div key={block.id} style={{ border: "1px solid rgba(255,255,255,0.08)", background: "rgba(255,255,255,0.04)", borderRadius: 10, padding: 8 }}><div style={{ fontWeight: 700, marginBottom: 6 }}>{block.name}</div><div style={{ display: "flex", gap: 8 }}><button onClick={() => addSavedBlock(block)}>Add</button><button onClick={() => removeSavedBlock(block.id)}>Delete</button></div></div>) : <div style={{ opacity: 0.7 }}>No saved blocks yet.</div>}
						</div>
					</div>
					<div style={{ fontWeight: 700, marginBottom: 8 }}>Layers</div>
					<div style={{ display: "grid", gap: 6, maxHeight: 420, overflow: "auto" }}>
						{orderedLayers.length ? orderedLayers.map((el) => (
							<button
								key={el.id}
								onClick={() => setSelectedId(el.id)}
								style={{
									textAlign: "left",
									border: el.id === selectedId ? "1px solid #ef4444" : "1px solid rgba(255,255,255,0.08)",
									background: el.id === selectedId ? "rgba(239,68,68,0.15)" : "rgba(255,255,255,0.04)",
									borderRadius: 10,
									padding: 8
								}}
							>
								<div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
									<div style={{ fontWeight: 700 }}>{el.name || el.type}</div>
									<div style={{ fontSize: 11, opacity: 0.7 }}>#{el._order}</div>
								</div>
								<div style={{ fontSize: 12, opacity: 0.72 }}>{el.type}{el.locked ? " • locked" : ""}{el.hidden ? " • hidden" : ""}</div>
							</button>
						)) : <div style={{ opacity: 0.7 }}>No layers yet.</div>}
					</div>
				</div>
			</div>
		</div>
	);
}
