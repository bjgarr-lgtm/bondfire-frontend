import React from "react";
import { useParams } from "react-router-dom";
import { api } from "../utils/api.js";

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
		build: () => ({
			name: "Event Flyer",
			elements: [
				makeShapeElement({ x: 0, y: 0, width: 1080, height: 1350, fill: "#0f172a", radius: 0, name: "Background" }),
				makeTextElement({ text: "{{org.name}}", x: 90, y: 110, width: 900, height: 60, fontSize: 28, fontWeight: 700, color: "#fca5a5", name: "Org Name" }),
				makeTextElement({ text: "{{meeting.title}}", x: 90, y: 200, width: 900, height: 180, fontSize: 86, fontWeight: 800, lineHeight: 0.95, color: "#ffffff", name: "Title" }),
				makeTextElement({ text: "{{meeting.date}}\n{{meeting.location}}", x: 90, y: 420, width: 420, height: 200, fontSize: 34, fontWeight: 600, lineHeight: 1.2, color: "#e5e7eb", name: "Date + Location" }),
				makeShapeElement({ x: 610, y: 420, width: 320, height: 320, fill: "rgba(255,255,255,0.05)", stroke: "#fca5a5", strokeWidth: 2, radius: 24, name: "Image Frame" }),
				makeTextElement({ text: "{{org.contact}}", x: 90, y: 1175, width: 920, height: 40, fontSize: 22, fontWeight: 500, color: "#d1d5db", name: "Contact" }),
			],
		}),
	},
	needPost: {
		label: "Need Post",
		preset: "square",
		build: () => ({
			name: "Need Post",
			elements: [
				makeShapeElement({ x: 0, y: 0, width: 1080, height: 1080, fill: "#111827", radius: 0, name: "Background" }),
				makeTextElement({ text: "{{org.name}} needs", x: 80, y: 90, width: 920, height: 90, fontSize: 42, fontWeight: 700, color: "#fca5a5", name: "Heading" }),
				makeTextElement({ text: "{{need.title}}", x: 80, y: 220, width: 920, height: 170, fontSize: 82, fontWeight: 800, lineHeight: 0.95, color: "#ffffff", name: "Need Title" }),
				makeTextElement({ text: "{{need.description}}", x: 80, y: 450, width: 920, height: 250, fontSize: 30, fontWeight: 500, lineHeight: 1.25, color: "#e5e7eb", name: "Need Description" }),
				makeTextElement({ text: "{{org.contact}}", x: 80, y: 930, width: 920, height: 50, fontSize: 24, fontWeight: 500, color: "#d1d5db", name: "Contact" }),
			],
		}),
	},
	meetingCard: {
		label: "Meeting Graphic",
		preset: "story",
		build: () => ({
			name: "Meeting Graphic",
			elements: [
				makeShapeElement({ x: 0, y: 0, width: 1080, height: 1920, fill: "#0b1020", radius: 0, name: "Background" }),
				makeTextElement({ text: "{{org.name}}", x: 80, y: 120, width: 920, height: 70, fontSize: 34, fontWeight: 700, letterSpacing: 2, color: "#fca5a5", name: "Org Name" }),
				makeTextElement({ text: "{{meeting.title}}", x: 80, y: 260, width: 920, height: 260, fontSize: 98, fontWeight: 800, lineHeight: 0.92, color: "#ffffff", name: "Meeting Title" }),
				makeTextElement({ text: "{{meeting.date}}", x: 80, y: 630, width: 920, height: 80, fontSize: 38, fontWeight: 700, color: "#e5e7eb", name: "Meeting Date" }),
				makeTextElement({ text: "{{meeting.location}}", x: 80, y: 730, width: 920, height: 160, fontSize: 42, fontWeight: 600, lineHeight: 1.15, color: "#f9fafb", name: "Meeting Location" }),
			],
		}),
	},
	volunteerCall: {
		label: "Volunteer Call",
		preset: "banner",
		build: () => ({
			name: "Volunteer Call",
			elements: [
				makeShapeElement({ x: 0, y: 0, width: 1600, height: 900, fill: "#111827", radius: 0, name: "Background" }),
				makeTextElement({ text: "{{org.name}}", x: 100, y: 110, width: 1320, height: 50, fontSize: 28, fontWeight: 700, letterSpacing: 1.5, color: "#fca5a5", name: "Org Name" }),
				makeTextElement({ text: "volunteers needed", x: 100, y: 200, width: 840, height: 180, fontSize: 96, fontWeight: 800, lineHeight: 0.95, color: "#ffffff", name: "Heading" }),
				makeTextElement({ text: "{{need.title}}", x: 100, y: 430, width: 860, height: 120, fontSize: 42, fontWeight: 600, lineHeight: 1.1, color: "#e5e7eb", name: "Need Title" }),
				makeTextElement({ text: "{{org.contact}}", x: 100, y: 720, width: 860, height: 50, fontSize: 24, fontWeight: 500, color: "#d1d5db", name: "Contact" }),
			],
		}),
	},
};

const RULER_SIZE = 24;
const GUIDE_COLORS = {
	vertical: "rgba(239,68,68,0.85)",
	horizontal: "rgba(96,165,250,0.85)",
};

function storageKey(orgId) {
	return `bf_studio_docs_${orgId}`;
}

function blocksKey(orgId) {
	return `bf_studio_blocks_${orgId}`;
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
		guides: [],
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

function readJson(key, fallback) {
	try {
		const parsed = JSON.parse(localStorage.getItem(key) || JSON.stringify(fallback));
		return parsed ?? fallback;
	} catch {
		return fallback;
	}
}

function readDocs(orgId) {
	if (!orgId) return [];
	return readJson(storageKey(orgId), []);
}

function saveDocs(orgId, docs) {
	localStorage.setItem(storageKey(orgId), JSON.stringify(docs));
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

function downloadBlob(filename, blob) {
	const url = URL.createObjectURL(blob);
	const a = document.createElement("a");
	a.href = url;
	a.download = filename;
	a.click();
	setTimeout(() => URL.revokeObjectURL(url), 500);
}

function clamp(n, min, max) {
	return Math.max(min, Math.min(max, n));
}

function snapValue(value, targets, threshold = 8) {
	for (const target of targets) {
		if (Math.abs(value - target) <= threshold) return target;
	}
	return value;
}

function formatSavedAt(ts) {
	if (!ts) return "";
	return new Date(ts).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

function buildDriveImageUrl(orgId, fileId) {
	const encodedOrgId = encodeURIComponent(String(orgId || ""));
	const encodedFileId = encodeURIComponent(String(fileId || ""));
	return `/api/orgs/${encodedOrgId}/drive/files/${encodedFileId}/download`;
}

function getSelectionBounds(elements) {
	if (!elements.length) return null;
	const xs = elements.map((el) => Number(el.x || 0));
	const ys = elements.map((el) => Number(el.y || 0));
	const rights = elements.map((el) => Number(el.x || 0) + Number(el.width || 0));
	const bottoms = elements.map((el) => Number(el.y || 0) + Number(el.height || 0));
	const left = Math.min(...xs);
	const top = Math.min(...ys);
	const right = Math.max(...rights);
	const bottom = Math.max(...bottoms);
	return { left, top, width: right - left, height: bottom - top };
}

function intersectsRect(el, rect) {
	const left = Number(el.x || 0);
	const top = Number(el.y || 0);
	const right = left + Number(el.width || 0);
	const bottom = top + Number(el.height || 0);
	return !(right < rect.left || left > rect.left + rect.width || bottom < rect.top || top > rect.top + rect.height);
}

function withNewIds(elements) {
	return elements.map((el) => ({ ...clone(el), id: uid(), x: Number(el.x || 0) + 24, y: Number(el.y || 0) + 24 }));
}

function makeGuide(orientation, position) {
	return { id: uid(), orientation, position };
}

function panelButtonStyle(active) {
	return {
		width: "100%",
		textAlign: "left",
		padding: "10px 12px",
		borderRadius: 12,
		border: active ? "1px solid rgba(239,68,68,0.6)" : "1px solid rgba(255,255,255,0.08)",
		background: active ? "rgba(239,68,68,0.14)" : "rgba(255,255,255,0.04)",
		color: "white",
	};
}

function iconButtonStyle(active) {
	return {
		width: 42,
		height: 42,
		borderRadius: 12,
		border: active ? "1px solid rgba(239,68,68,0.6)" : "1px solid rgba(255,255,255,0.08)",
		background: active ? "rgba(239,68,68,0.16)" : "rgba(255,255,255,0.04)",
		color: "white",
		fontWeight: 700,
	};
}

export default function Studio() {
	const { orgId = "" } = useParams();
	const workspaceRef = React.useRef(null);
	const canvasShellRef = React.useRef(null);
	const fileInputRef = React.useRef(null);

	const [docs, setDocs] = React.useState(() => readDocs(orgId));
	const [currentId, setCurrentId] = React.useState(() => readDocs(orgId)[0]?.id || null);
	const [selectedIds, setSelectedIds] = React.useState([]);
	const [history, setHistory] = React.useState([]);
	const [future, setFuture] = React.useState([]);
	const [savedAt, setSavedAt] = React.useState(0);
	const [savedBlocks, setSavedBlocks] = React.useState(() => readBlocks(orgId));
	const [showBoundPreview, setShowBoundPreview] = React.useState(true);
	const [leftPanel, setLeftPanel] = React.useState(null);
	const [inspectorOpen, setInspectorOpen] = React.useState(true);
	const [tool, setTool] = React.useState("select");
	const [zoom, setZoom] = React.useState(0.45);
	const [pan, setPan] = React.useState({ x: 120, y: 80 });
	const [showRulers, setShowRulers] = React.useState(true);
	const [driveAssets, setDriveAssets] = React.useState([]);
	const [driveLoading, setDriveLoading] = React.useState(false);
	const [driveError, setDriveError] = React.useState("");
	const [assetSearch, setAssetSearch] = React.useState("");
	const [dragState, setDragState] = React.useState(null);
	const [resizeState, setResizeState] = React.useState(null);
	const [marquee, setMarquee] = React.useState(null);
	const [panState, setPanState] = React.useState(null);
	const [guideDrag, setGuideDrag] = React.useState(null);
	const [spacePan, setSpacePan] = React.useState(false);

	React.useEffect(() => {
		const nextDocs = readDocs(orgId);
		setDocs(nextDocs);
		setCurrentId(nextDocs[0]?.id || null);
		setSelectedIds([]);
		setHistory([]);
		setFuture([]);
		setSavedBlocks(readBlocks(orgId));
	}, [orgId]);

	const bindings = React.useMemo(() => getOrgBindings(orgId), [orgId]);
	const brandKit = React.useMemo(() => getBrandKit(orgId), [orgId]);
	const currentDoc = React.useMemo(() => docs.find((doc) => doc.id === currentId) || null, [docs, currentId]);
	const selectedElements = React.useMemo(() => (currentDoc?.elements || []).filter((el) => selectedIds.includes(el.id)), [currentDoc, selectedIds]);
	const selected = selectedElements.length === 1 ? selectedElements[0] : null;
	const selectionBounds = React.useMemo(() => getSelectionBounds(selectedElements), [selectedElements]);
	const orderedLayers = React.useMemo(() => (currentDoc?.elements || []).map((el, idx) => ({ ...el, _order: idx + 1 })).reverse(), [currentDoc]);

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

	const fitCanvas = React.useCallback((doc = currentDoc) => {
		if (!doc || !workspaceRef.current) return;
		const rect = workspaceRef.current.getBoundingClientRect();
		const availableWidth = Math.max(320, rect.width - 120);
		const availableHeight = Math.max(320, rect.height - 120);
		const nextZoom = clamp(Math.min(availableWidth / doc.width, availableHeight / doc.height), 0.1, 1.5);
		setZoom(nextZoom);
		setPan({
			x: Math.max(40, (rect.width - doc.width * nextZoom) / 2),
			y: Math.max(40, (rect.height - doc.height * nextZoom) / 2),
		});
	}, [currentDoc]);

	React.useEffect(() => {
		if (currentDoc) {
			setTimeout(() => fitCanvas(currentDoc), 0);
		}
	}, [currentId]);

	React.useEffect(() => {
		const onResize = () => fitCanvas(currentDoc);
		window.addEventListener("resize", onResize);
		return () => window.removeEventListener("resize", onResize);
	}, [fitCanvas, currentDoc]);

	const createDoc = React.useCallback((preset = "flyer") => {
		snapshot();
		const doc = makeDoc(preset);
		commitDocs((prev) => [doc, ...prev]);
		setCurrentId(doc.id);
		setSelectedIds([]);
		setTimeout(() => fitCanvas(doc), 0);
	}, [snapshot, commitDocs, fitCanvas]);

	const createTemplateDoc = React.useCallback((templateKey) => {
		const template = TEMPLATE_LIBRARY[templateKey];
		if (!template) return;
		snapshot();
		const base = makeDoc(template.preset);
		const built = template.build(bindings);
		const doc = { ...base, name: built.name || template.label, elements: built.elements || [], updatedAt: Date.now() };
		commitDocs((prev) => [doc, ...prev]);
		setCurrentId(doc.id);
		setSelectedIds(doc.elements[0]?.id ? [doc.elements[0].id] : []);
		setLeftPanel(null);
		setTimeout(() => fitCanvas(doc), 0);
	}, [snapshot, commitDocs, bindings, fitCanvas]);

	const updateDoc = React.useCallback((patch) => {
		if (!currentDoc) return;
		commitDocs((prev) => prev.map((doc) => doc.id === currentDoc.id ? { ...doc, ...patch, updatedAt: Date.now() } : doc));
	}, [currentDoc, commitDocs]);

	const updateElements = React.useCallback((ids, patchOrFn) => {
		if (!currentDoc || !ids?.length) return;
		const idSet = new Set(ids);
		commitDocs((prev) => prev.map((doc) => {
			if (doc.id !== currentDoc.id) return doc;
			return {
				...doc,
				updatedAt: Date.now(),
				elements: doc.elements.map((el) => {
					if (!idSet.has(el.id)) return el;
					const patch = typeof patchOrFn === "function" ? patchOrFn(el) : patchOrFn;
					return { ...el, ...patch };
				}),
			};
		}));
	}, [currentDoc, commitDocs]);

	const updateElement = React.useCallback((elementId, patchOrFn) => {
		updateElements([elementId], patchOrFn);
	}, [updateElements]);

	const addText = () => {
		const docId = ensureDoc("flyer");
		snapshot();
		const element = makeTextElement();
		commitDocs((prev) => prev.map((doc) => doc.id !== docId ? doc : { ...doc, updatedAt: Date.now(), elements: [...doc.elements, element] }));
		setCurrentId(docId);
		setSelectedIds([element.id]);
	};

	const addShape = () => {
		const docId = ensureDoc("flyer");
		snapshot();
		const element = makeShapeElement();
		commitDocs((prev) => prev.map((doc) => doc.id !== docId ? doc : { ...doc, updatedAt: Date.now(), elements: [...doc.elements, element] }));
		setCurrentId(docId);
		setSelectedIds([element.id]);
	};

	const addImageFromSrc = React.useCallback((src, name = "Image") => {
		const docId = ensureDoc(currentDoc?.preset || "flyer");
		snapshot();
		const element = makeImageElement({ src, name });
		commitDocs((prev) => prev.map((doc) => doc.id !== docId ? doc : { ...doc, updatedAt: Date.now(), elements: [...doc.elements, element] }));
		setCurrentId(docId);
		setSelectedIds([element.id]);
	}, [ensureDoc, currentDoc, snapshot, commitDocs]);

	const addImage = () => {
		fileInputRef.current?.click();
	};

	const onUploadImage = (e) => {
		const file = e.target.files?.[0];
		if (!file) return;
		const reader = new FileReader();
		reader.onload = () => addImageFromSrc(String(reader.result || ""), file.name || "Image");
		reader.readAsDataURL(file);
		e.target.value = "";
	};

	const loadDriveAssets = React.useCallback(async () => {
		if (!orgId) return;
		setDriveLoading(true);
		setDriveError("");
		try {
			const data = await api(`/api/orgs/${encodeURIComponent(orgId)}/drive`);
			const files = Array.isArray(data?.files) ? data.files : [];
			const images = files
				.filter((file) => String(file?.mime || "").startsWith("image/"))
				.map((file) => ({ ...file, previewUrl: buildDriveImageUrl(orgId, file.id) }));
			setDriveAssets(images);
		} catch (err) {
			setDriveError(String(err?.message || err || "Failed to load Drive assets"));
		} finally {
			setDriveLoading(false);
		}
	}, [orgId]);

	React.useEffect(() => {
		if (leftPanel === "assets" && !driveAssets.length && !driveLoading) {
			loadDriveAssets();
		}
	}, [leftPanel, driveAssets.length, driveLoading, loadDriveAssets]);

	const removeSelected = () => {
		if (!currentDoc || !selectedIds.length) return;
		snapshot();
		const selectedSet = new Set(selectedIds);
		commitDocs((prev) => prev.map((doc) => doc.id !== currentDoc.id ? doc : { ...doc, updatedAt: Date.now(), elements: doc.elements.filter((el) => !selectedSet.has(el.id)) }));
		setSelectedIds([]);
	};

	const duplicateSelected = () => {
		if (!currentDoc || !selectedIds.length) return;
		snapshot();
		const toDup = currentDoc.elements.filter((el) => selectedIds.includes(el.id));
		const dupes = withNewIds(toDup).map((el) => ({ ...el, name: `${el.name || el.type} Copy` }));
		commitDocs((prev) => prev.map((doc) => doc.id !== currentDoc.id ? doc : { ...doc, updatedAt: Date.now(), elements: [...doc.elements, ...dupes] }));
		setSelectedIds(dupes.map((el) => el.id));
	};

	const moveLayer = (dir) => {
		if (!currentDoc || !selectedIds.length) return;
		snapshot();
		const selectedSet = new Set(selectedIds);
		const elements = currentDoc.elements.slice();
		if (dir === "up") {
			for (let i = elements.length - 2; i >= 0; i -= 1) {
				if (selectedSet.has(elements[i].id) && !selectedSet.has(elements[i + 1].id)) {
					[elements[i], elements[i + 1]] = [elements[i + 1], elements[i]];
				}
			}
		} else {
			for (let i = 1; i < elements.length; i += 1) {
				if (selectedSet.has(elements[i].id) && !selectedSet.has(elements[i - 1].id)) {
					[elements[i], elements[i - 1]] = [elements[i - 1], elements[i]];
				}
			}
		}
		commitDocs((prev) => prev.map((doc) => doc.id !== currentDoc.id ? doc : { ...doc, updatedAt: Date.now(), elements }));
	};

	const setFlagOnSelection = (key, value) => {
		if (!selectedIds.length) return;
		snapshot();
		updateElements(selectedIds, { [key]: value });
	};

	const toggleSelectedFlag = (key) => {
		if (!selectedElements.length) return;
		const next = !selectedElements.every((el) => !!el[key]);
		setFlagOnSelection(key, next);
	};

	const insertBindingToken = (token) => {
		if (!selected || selected.type !== "text") return;
		snapshot();
		updateElement(selected.id, { text: `${selected.text || ""}${selected.text ? "\n" : ""}{{${token}}}` });
	};

	const addBoundText = (token, label) => {
		const docId = ensureDoc("flyer");
		snapshot();
		const element = makeTextElement({ name: label, text: `{{${token}}}`, x: 80, y: 80 + ((currentDoc?.elements?.length || 0) * 24), width: 420, height: 80 });
		commitDocs((prev) => prev.map((doc) => doc.id !== docId ? doc : { ...doc, updatedAt: Date.now(), elements: [...doc.elements, element] }));
		setCurrentId(docId);
		setSelectedIds([element.id]);
	};

	const saveCurrentDoc = () => {
		saveDocs(orgId, docs);
		setSavedAt(Date.now());
	};

	const deleteDoc = (docId) => {
		const target = docs.find((doc) => doc.id === docId);
		if (!target) return;
		if (!window.confirm(`Delete "${target.name}"?`)) return;
		snapshot();
		const next = docs.filter((doc) => doc.id !== docId);
		setDocs(next);
		saveDocs(orgId, next);
		setSavedAt(Date.now());
		if (currentId === docId) {
			setCurrentId(next[0]?.id || null);
			setSelectedIds([]);
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
		const element = { ...clone(block.element), id: uid(), x: Number(block.element?.x || 80) + 24, y: Number(block.element?.y || 80) + 24, name: `${block.name} Copy` };
		const docId = ensureDoc(currentDoc?.preset || "flyer");
		snapshot();
		commitDocs((prev) => prev.map((doc) => doc.id !== docId ? doc : { ...doc, updatedAt: Date.now(), elements: [...doc.elements, element] }));
		setCurrentId(docId);
		setSelectedIds([element.id]);
	};

	const removeSavedBlock = (blockId) => {
		const next = savedBlocks.filter((block) => block.id !== blockId);
		setSavedBlocks(next);
		saveBlocks(orgId, next);
	};

	const groupSelection = () => {
		if (selectedIds.length < 2) return;
		const groupId = uid();
		snapshot();
		updateElements(selectedIds, (el) => ({ groupId, groupName: el.groupName || `Group ${groupId.slice(-4)}` }));
	};

	const ungroupSelection = () => {
		const groups = [...new Set(selectedElements.map((el) => el.groupId).filter(Boolean))];
		if (!groups.length) return;
		snapshot();
		const ids = currentDoc.elements.filter((el) => groups.includes(el.groupId)).map((el) => el.id);
		updateElements(ids, { groupId: null, groupName: null });
	};

	const addGuide = (orientation, position) => {
		if (!currentDoc) return;
		snapshot();
		updateDoc({ guides: [...(currentDoc.guides || []), makeGuide(orientation, position ?? (orientation === "vertical" ? currentDoc.width / 2 : currentDoc.height / 2))] });
	};

	const removeGuide = (guideId) => {
		if (!currentDoc) return;
		snapshot();
		updateDoc({ guides: (currentDoc.guides || []).filter((guide) => guide.id !== guideId) });
	};

	const undo = () => {
		setHistory((prev) => {
			if (!prev.length) return prev;
			const last = prev[prev.length - 1];
			setFuture((f) => [clone(docs), ...f]);
			setDocs(last);
			saveDocs(orgId, last);
			setSavedAt(Date.now());
			setSelectedIds([]);
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
			setSelectedIds([]);
			return rest;
		});
	};

	React.useEffect(() => {
		const onKeyDown = (e) => {
			const tag = document.activeElement?.tagName?.toLowerCase();
			const isTyping = tag === "input" || tag === "textarea" || document.activeElement?.contentEditable === "true";
			if (e.code === "Space" && !isTyping) {
				e.preventDefault();
				setSpacePan(true);
			}
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
			if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "d" && selectedIds.length && !isTyping) {
				e.preventDefault();
				duplicateSelected();
				return;
			}
			if ((e.key === "Delete" || e.key === "Backspace") && selectedIds.length && !isTyping) {
				e.preventDefault();
				removeSelected();
				return;
			}
			if (selectedElements.length && !isTyping) {
				const movable = selectedElements.filter((el) => !el.locked).map((el) => el.id);
				if (!movable.length) return;
				const step = e.shiftKey ? 10 : 1;
				if (["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(e.key)) {
					e.preventDefault();
					snapshot();
					updateElements(movable, (el) => ({
						x: e.key === "ArrowLeft" ? Math.max(0, Number(el.x || 0) - step) : e.key === "ArrowRight" ? Number(el.x || 0) + step : Number(el.x || 0),
						y: e.key === "ArrowUp" ? Math.max(0, Number(el.y || 0) - step) : e.key === "ArrowDown" ? Number(el.y || 0) + step : Number(el.y || 0),
					}));
				}
			}
		};
		const onKeyUp = (e) => {
			if (e.code === "Space") setSpacePan(false);
		};
		window.addEventListener("keydown", onKeyDown);
		window.addEventListener("keyup", onKeyUp);
		return () => {
			window.removeEventListener("keydown", onKeyDown);
			window.removeEventListener("keyup", onKeyUp);
		};
	}, [selectedIds, selectedElements, docs, undo, redo, updateElements, snapshot]);

	const selectElement = React.useCallback((el, add = false) => {
		if (!el) return;
		const idsForElement = el.groupId ? (currentDoc?.elements || []).filter((item) => item.groupId === el.groupId).map((item) => item.id) : [el.id];
		setSelectedIds((prev) => {
			if (!add) return idsForElement;
			const next = new Set(prev);
			let allPresent = idsForElement.every((id) => next.has(id));
			idsForElement.forEach((id) => {
				if (allPresent) next.delete(id);
				else next.add(id);
			});
			return [...next];
		});
	}, [currentDoc]);

	const startElementDrag = (e, el) => {
		if (!currentDoc || el.locked) return;
		e.preventDefault();
		e.stopPropagation();
		const add = e.shiftKey;
		if (!selectedIds.includes(el.id) || (!add && selectedIds.length !== (el.groupId ? currentDoc.elements.filter((item) => item.groupId === el.groupId).length : 1))) {
			selectElement(el, add);
		}
		const ids = (el.groupId ? currentDoc.elements.filter((item) => item.groupId === el.groupId).map((item) => item.id) : selectedIds.includes(el.id) ? selectedIds : [el.id]).filter((id) => {
			const item = currentDoc.elements.find((x) => x.id === id);
			return item && !item.locked;
		});
		const pointer = { x: e.clientX, y: e.clientY };
		const origins = {};
		ids.forEach((id) => {
			const item = currentDoc.elements.find((x) => x.id === id);
			origins[id] = { x: Number(item?.x || 0), y: Number(item?.y || 0), width: Number(item?.width || 0), height: Number(item?.height || 0) };
		});
		setDragState({ ids, pointer, origins });
	};

	const startResize = (e) => {
		if (!selected || selected.locked) return;
		e.preventDefault();
		e.stopPropagation();
		setResizeState({ startX: e.clientX, startY: e.clientY, width: Number(selected.width || 1), height: Number(selected.height || 1), id: selected.id });
	};

	const getCanvasPoint = React.useCallback((clientX, clientY) => {
		const rect = workspaceRef.current?.getBoundingClientRect();
		if (!rect) return { x: 0, y: 0 };
		return {
			x: (clientX - rect.left - pan.x - RULER_SIZE) / zoom,
			y: (clientY - rect.top - pan.y - RULER_SIZE) / zoom,
		};
	}, [pan, zoom]);

	const startWorkspaceAction = (e) => {
		if (!currentDoc) return;
		if (spacePan || tool === "hand" || e.button === 1) {
			setPanState({ startX: e.clientX, startY: e.clientY, panX: pan.x, panY: pan.y });
			return;
		}
		if (e.target !== workspaceRef.current && e.target !== canvasShellRef.current) return;
		setSelectedIds([]);
		if (tool === "select") {
			const point = getCanvasPoint(e.clientX, e.clientY);
			setMarquee({ left: point.x, top: point.y, width: 0, height: 0, startX: point.x, startY: point.y });
		}
	};

	React.useEffect(() => {
		const onMove = (e) => {
			if (panState) {
				setPan({ x: panState.panX + (e.clientX - panState.startX), y: panState.panY + (e.clientY - panState.startY) });
			}
			if (dragState && currentDoc) {
				const dx = (e.clientX - dragState.pointer.x) / zoom;
				const dy = (e.clientY - dragState.pointer.y) / zoom;
				const guideTargetsX = [0, currentDoc.width / 2, currentDoc.width, ...((currentDoc.guides || []).filter((g) => g.orientation === "vertical").map((g) => Number(g.position || 0)))];
				const guideTargetsY = [0, currentDoc.height / 2, currentDoc.height, ...((currentDoc.guides || []).filter((g) => g.orientation === "horizontal").map((g) => Number(g.position || 0)))];
				updateElements(dragState.ids, (el) => {
					const base = dragState.origins[el.id] || { x: 0, y: 0 };
					const rawX = clamp(base.x + dx, 0, Math.max(0, currentDoc.width - Number(el.width || 0)));
					const rawY = clamp(base.y + dy, 0, Math.max(0, currentDoc.height - Number(el.height || 0)));
					return {
						x: snapValue(rawX, [...guideTargetsX, currentDoc.width - Number(el.width || 0)], 6),
						y: snapValue(rawY, [...guideTargetsY, currentDoc.height - Number(el.height || 0)], 6),
					};
				});
			}
			if (resizeState && currentDoc) {
				const el = currentDoc.elements.find((item) => item.id === resizeState.id);
				if (!el) return;
				const dx = (e.clientX - resizeState.startX) / zoom;
				const dy = (e.clientY - resizeState.startY) / zoom;
				updateElement(resizeState.id, {
					width: clamp(snapValue(resizeState.width + dx, [80, 120, 240, currentDoc.width - Number(el.x || 0)], 8), 24, currentDoc.width - Number(el.x || 0)),
					height: clamp(snapValue(resizeState.height + dy, [40, 80, 120, 240, currentDoc.height - Number(el.y || 0)], 8), 24, currentDoc.height - Number(el.y || 0)),
				});
			}
			if (marquee) {
				const point = getCanvasPoint(e.clientX, e.clientY);
				const next = {
					...marquee,
					left: Math.min(marquee.startX, point.x),
					top: Math.min(marquee.startY, point.y),
					width: Math.abs(point.x - marquee.startX),
					height: Math.abs(point.y - marquee.startY),
				};
				setMarquee(next);
			}
			if (guideDrag && currentDoc) {
				const point = getCanvasPoint(e.clientX, e.clientY);
				const position = guideDrag.orientation === "vertical" ? clamp(point.x, 0, currentDoc.width) : clamp(point.y, 0, currentDoc.height);
				updateDoc({
					guides: (currentDoc.guides || []).map((guide) => guide.id === guideDrag.id ? { ...guide, position } : guide),
				});
			}
		};
		const onUp = () => {
			if (marquee && currentDoc) {
				const rect = { left: marquee.left, top: marquee.top, width: marquee.width, height: marquee.height };
				const ids = currentDoc.elements.filter((el) => intersectsRect(el, rect)).map((el) => el.id);
				setSelectedIds(ids);
			}
			setDragState(null);
			setResizeState(null);
			setMarquee(null);
			setPanState(null);
			setGuideDrag(null);
		};
		window.addEventListener("mousemove", onMove);
		window.addEventListener("mouseup", onUp);
		return () => {
			window.removeEventListener("mousemove", onMove);
			window.removeEventListener("mouseup", onUp);
		};
	}, [panState, dragState, resizeState, marquee, guideDrag, currentDoc, zoom, getCanvasPoint, updateElements, updateElement, updateDoc]);

	const handleWheel = (e) => {
		e.preventDefault();
		if (!currentDoc || !workspaceRef.current) return;
		const rect = workspaceRef.current.getBoundingClientRect();
		const pointX = e.clientX - rect.left;
		const pointY = e.clientY - rect.top;
		const nextZoom = clamp(zoom * (e.deltaY < 0 ? 1.08 : 0.92), 0.1, 3);
		const worldX = (pointX - pan.x - RULER_SIZE) / zoom;
		const worldY = (pointY - pan.y - RULER_SIZE) / zoom;
		setZoom(nextZoom);
		setPan({
			x: pointX - worldX * nextZoom - RULER_SIZE,
			y: pointY - worldY * nextZoom - RULER_SIZE,
		});
	};

	const exportJson = () => {
		if (!currentDoc) return;
		downloadBlob(`${printableName(currentDoc.name)}.json`, new Blob([JSON.stringify(currentDoc, null, 2)], { type: "application/json" }));
	};

	const exportPng = () => {
		if (!currentDoc) return;
		const canvasEl = document.getElementById("bf-studio-canvas-inner");
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

	const filteredAssets = React.useMemo(() => {
		const q = assetSearch.trim().toLowerCase();
		if (!q) return driveAssets;
		return driveAssets.filter((file) => String(file?.name || "").toLowerCase().includes(q));
	}, [driveAssets, assetSearch]);

	const multiSelection = selectedIds.length > 1;
	const currentGuides = currentDoc?.guides || [];

	return (
		<div style={{ height: "calc(100vh - 92px)", display: "grid", gridTemplateRows: "auto 1fr", gap: 12, padding: 12 }}>
			<input ref={fileInputRef} type="file" accept="image/*" onChange={onUploadImage} style={{ display: "none" }} />

			<div style={{ display: "flex", alignItems: "center", gap: 10, padding: 10, borderRadius: 16, border: "1px solid rgba(255,255,255,0.08)", background: "#111827" }}>
				<button onClick={() => setLeftPanel((v) => v ? null : "create")}>☰</button>
				<input value={currentDoc?.name || ""} onChange={(e) => updateDoc({ name: e.target.value })} placeholder="Untitled design" disabled={!currentDoc} style={{ flex: 1, minWidth: 180, padding: "10px 12px", borderRadius: 12, border: "1px solid rgba(255,255,255,0.12)", background: "rgba(255,255,255,0.04)", color: "white" }} />
				<div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
					<button onClick={undo} disabled={!history.length}>Undo</button>
					<button onClick={redo} disabled={!future.length}>Redo</button>
					<button onClick={() => setTool("select")} style={{ borderColor: tool === "select" ? "#ef4444" : undefined }}>Select</button>
					<button onClick={() => setTool("hand")} style={{ borderColor: tool === "hand" ? "#ef4444" : undefined }}>Hand</button>
					<button onClick={() => setZoom((z) => clamp(z * 0.9, 0.1, 3))}>-</button>
					<button onClick={() => fitCanvas(currentDoc)} disabled={!currentDoc}>Fit</button>
					<button onClick={() => { setZoom(1); setPan({ x: 80, y: 80 }); }} disabled={!currentDoc}>100%</button>
					<button onClick={() => setZoom((z) => clamp(z * 1.1, 0.1, 3))}>+</button>
					<div style={{ minWidth: 70, textAlign: "center", opacity: 0.75 }}>{Math.round(zoom * 100)}%</div>
					<button onClick={() => setShowRulers((v) => !v)}>{showRulers ? "Hide Rulers" : "Show Rulers"}</button>
					<button onClick={() => setInspectorOpen((v) => !v)}>{inspectorOpen ? "Hide Inspector" : "Inspector"}</button>
					<button onClick={exportPng} disabled={!currentDoc}>PNG</button>
					<button onClick={exportPdf} disabled={!currentDoc}>PDF</button>
				</div>
			</div>

			<div style={{ minHeight: 0, display: "grid", gridTemplateColumns: `${leftPanel ? "340px " : "64px "} minmax(0,1fr) ${inspectorOpen ? "360px" : "0px"}`, gap: 12, transition: "grid-template-columns 160ms ease" }}>
				<div style={{ minWidth: 0, background: "#111827", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 18, overflow: "hidden", display: "grid", gridTemplateColumns: "64px minmax(0,1fr)" }}>
					<div style={{ borderRight: leftPanel ? "1px solid rgba(255,255,255,0.08)" : "none", padding: 10, display: "grid", alignContent: "start", gap: 8 }}>
						<button style={iconButtonStyle(leftPanel === "create")} onClick={() => setLeftPanel((v) => v === "create" ? null : "create")}>＋</button>
						<button style={iconButtonStyle(leftPanel === "templates")} onClick={() => setLeftPanel((v) => v === "templates" ? null : "templates")}>Tpl</button>
						<button style={iconButtonStyle(leftPanel === "content")} onClick={() => setLeftPanel((v) => v === "content" ? null : "content")}>Txt</button>
						<button style={iconButtonStyle(leftPanel === "assets")} onClick={() => setLeftPanel((v) => v === "assets" ? null : "assets")}>Img</button>
						<button style={iconButtonStyle(leftPanel === "data")} onClick={() => setLeftPanel((v) => v === "data" ? null : "data")}>Data</button>
						<button style={iconButtonStyle(leftPanel === "docs")} onClick={() => setLeftPanel((v) => v === "docs" ? null : "docs")}>Docs</button>
					</div>
					{leftPanel ? (
						<div style={{ minWidth: 0, padding: 12, overflow: "auto" }}>
							{leftPanel === "create" ? (
								<div style={{ display: "grid", gap: 8 }}>
									<div style={{ fontWeight: 800, marginBottom: 4 }}>Create</div>
									<button style={panelButtonStyle(false)} onClick={() => createDoc("flyer")}>New Flyer</button>
									<button style={panelButtonStyle(false)} onClick={() => createDoc("square")}>New Square Post</button>
									<button style={panelButtonStyle(false)} onClick={() => createDoc("story")}>New Story</button>
									<button style={panelButtonStyle(false)} onClick={() => createDoc("banner")}>New Banner</button>
									<hr style={{ opacity: 0.15, margin: "8px 0" }} />
									<button style={panelButtonStyle(false)} onClick={addText}>Add Text</button>
									<button style={panelButtonStyle(false)} onClick={addShape}>Add Shape</button>
									<button style={panelButtonStyle(false)} onClick={addImage}>Upload Image</button>
									<hr style={{ opacity: 0.15, margin: "8px 0" }} />
									<button style={panelButtonStyle(false)} onClick={() => addGuide("vertical")}>Add Vertical Guide</button>
									<button style={panelButtonStyle(false)} onClick={() => addGuide("horizontal")}>Add Horizontal Guide</button>
								</div>
							) : null}

							{leftPanel === "templates" ? (
								<div style={{ display: "grid", gap: 8 }}>
									<div style={{ fontWeight: 800, marginBottom: 4 }}>Templates</div>
									{Object.entries(TEMPLATE_LIBRARY).map(([key, item]) => (
										<button key={key} style={panelButtonStyle(false)} onClick={() => createTemplateDoc(key)}>
											<div style={{ fontWeight: 700 }}>{item.label}</div>
											<div style={{ opacity: 0.7, fontSize: 12 }}>{PRESETS[item.preset]?.label || item.preset}</div>
										</button>
									))}
								</div>
							) : null}

							{leftPanel === "content" ? (
								<div style={{ display: "grid", gap: 8 }}>
									<div style={{ fontWeight: 800, marginBottom: 4 }}>Content</div>
									<div style={{ fontSize: 12, opacity: 0.75 }}>Saved blocks and brand swatches live here, because apparently rebuilding the same badge twelve times is a hobby now.</div>
									<div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8 }}>
										{[brandKit.primary, brandKit.secondary, brandKit.accent, brandKit.text].map((color) => (
											<button key={color} onClick={() => selected?.type === "text" ? updateElement(selected.id, { color }) : selected?.type === "shape" ? updateElement(selected.id, { fill: color }) : null} style={{ height: 40, background: color, borderRadius: 10, border: "1px solid rgba(255,255,255,0.14)" }} />
										))}
									</div>
									<button style={panelButtonStyle(false)} onClick={saveSelectionAsBlock} disabled={!selected}>Save Selected as Block</button>
									<div style={{ display: "grid", gap: 8 }}>
										{savedBlocks.length ? savedBlocks.map((block) => (
											<div key={block.id} style={{ padding: 10, borderRadius: 12, border: "1px solid rgba(255,255,255,0.08)", background: "rgba(255,255,255,0.04)" }}>
												<div style={{ fontWeight: 700, marginBottom: 6 }}>{block.name}</div>
												<div style={{ display: "flex", gap: 8 }}>
													<button onClick={() => addSavedBlock(block)}>Add</button>
													<button onClick={() => removeSavedBlock(block.id)}>Delete</button>
												</div>
											</div>
										)) : <div style={{ opacity: 0.7 }}>No saved blocks yet.</div>}
									</div>
								</div>
							) : null}

							{leftPanel === "assets" ? (
								<div style={{ display: "grid", gap: 8 }}>
									<div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
										<div style={{ fontWeight: 800 }}>Drive Assets</div>
										<button onClick={loadDriveAssets}>Refresh</button>
									</div>
									<input value={assetSearch} onChange={(e) => setAssetSearch(e.target.value)} placeholder="Search Drive images" style={{ width: "100%" }} />
									<button style={panelButtonStyle(false)} onClick={addImage}>Upload from device</button>
									{driveLoading ? <div style={{ opacity: 0.7 }}>Loading Drive assets...</div> : null}
									{driveError ? <div style={{ color: "#fca5a5", fontSize: 12 }}>{driveError}</div> : null}
									<div style={{ display: "grid", gap: 8 }}>
										{filteredAssets.map((file) => (
											<div key={file.id} style={{ padding: 8, borderRadius: 12, border: "1px solid rgba(255,255,255,0.08)", background: "rgba(255,255,255,0.04)" }}>
												<div style={{ aspectRatio: "4 / 3", background: "rgba(255,255,255,0.05)", borderRadius: 8, overflow: "hidden", marginBottom: 8 }}>
													<img src={file.previewUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
												</div>
												<div style={{ fontSize: 12, fontWeight: 700, marginBottom: 6 }}>{file.name}</div>
												<button onClick={() => addImageFromSrc(file.previewUrl, file.name)}>Place on Canvas</button>
											</div>
										))}
										{!driveLoading && !filteredAssets.length ? <div style={{ opacity: 0.7 }}>No image assets found in Drive.</div> : null}
									</div>
								</div>
							) : null}

							{leftPanel === "data" ? (
								<div style={{ display: "grid", gap: 8 }}>
									<div style={{ fontWeight: 800 }}>Bondfire Data</div>
									<div style={{ fontSize: 12, opacity: 0.8 }}>These tokens are live placeholders. Example: {"{{meeting.title}}"} resolves to current Bondfire data when preview is on.</div>
									<button onClick={() => setShowBoundPreview((v) => !v)}>{showBoundPreview ? "Show Raw Tokens" : "Show Live Preview"}</button>
									{Object.entries(bindings).map(([key, value]) => (
										<div key={key} style={{ padding: 10, borderRadius: 12, border: "1px solid rgba(255,255,255,0.08)", background: "rgba(255,255,255,0.04)" }}>
											<div style={{ fontSize: 12, color: "#fca5a5" }}>{`{{${key}}}`}</div>
											<div style={{ fontSize: 12, opacity: 0.8, marginTop: 4 }}>{String(value || "—")}</div>
											<div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6, marginTop: 8 }}>
												<button onClick={() => addBoundText(key, key)}>Add</button>
												<button onClick={() => insertBindingToken(key)} disabled={!selected || selected.type !== "text"}>Insert</button>
											</div>
										</div>
									))}
								</div>
							) : null}

							{leftPanel === "docs" ? (
								<div style={{ display: "grid", gap: 8 }}>
									<div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
										<div style={{ fontWeight: 800 }}>Documents</div>
										<button onClick={saveCurrentDoc} disabled={!currentDoc}>Save</button>
									</div>
									{docs.length ? docs.map((doc) => (
										<div key={doc.id} style={{ border: doc.id === currentId ? "1px solid #ef4444" : "1px solid rgba(255,255,255,0.08)", background: doc.id === currentId ? "rgba(239,68,68,0.14)" : "rgba(255,255,255,0.04)", borderRadius: 12, padding: 10 }}>
											<button onClick={() => { setCurrentId(doc.id); setSelectedIds([]); setTimeout(() => fitCanvas(doc), 0); }} style={{ width: "100%", textAlign: "left", background: "transparent", border: "none", padding: 0 }}>
												<div style={{ fontWeight: 700 }}>{doc.name}</div>
												<div style={{ opacity: 0.7, fontSize: 12 }}>{doc.width} × {doc.height}</div>
											</button>
											<div style={{ display: "flex", gap: 8, marginTop: 8 }}>
												<button onClick={() => { setCurrentId(doc.id); setSelectedIds([]); setTimeout(() => fitCanvas(doc), 0); }}>Open</button>
												<button onClick={() => deleteDoc(doc.id)}>Delete</button>
											</div>
										</div>
									)) : <div style={{ opacity: 0.7 }}>No Studio docs yet for this org.</div>}
								</div>
							) : null}
						</div>
					) : null}
				</div>

				<div ref={workspaceRef} onMouseDown={startWorkspaceAction} onWheel={handleWheel} style={{ position: "relative", minWidth: 0, minHeight: 0, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 18, overflow: "hidden", cursor: panState || spacePan || tool === "hand" ? "grab" : "default" }}>
					{currentDoc ? (
						<>
							{showRulers ? (
								<>
									<div style={{ position: "absolute", left: RULER_SIZE, top: 0, right: 0, height: RULER_SIZE, background: "rgba(17,24,39,0.95)", borderBottom: "1px solid rgba(255,255,255,0.08)", zIndex: 20 }}>
										{Array.from({ length: Math.ceil(currentDoc.width / 50) + 1 }).map((_, index) => {
											const mark = index * 50;
											return <div key={mark} style={{ position: "absolute", left: pan.x + mark * zoom, top: 0, width: 1, height: index % 2 === 0 ? 18 : 10, background: "rgba(255,255,255,0.25)" }}><div style={{ position: "absolute", top: 2, left: 4, fontSize: 10, color: "rgba(255,255,255,0.6)" }}>{mark}</div></div>;
										})}
									</div>
									<div style={{ position: "absolute", top: RULER_SIZE, left: 0, bottom: 0, width: RULER_SIZE, background: "rgba(17,24,39,0.95)", borderRight: "1px solid rgba(255,255,255,0.08)", zIndex: 20 }}>
										{Array.from({ length: Math.ceil(currentDoc.height / 50) + 1 }).map((_, index) => {
											const mark = index * 50;
											return <div key={mark} style={{ position: "absolute", top: pan.y + mark * zoom, left: 0, height: 1, width: index % 2 === 0 ? 18 : 10, background: "rgba(255,255,255,0.25)" }}><div style={{ position: "absolute", left: 2, top: 4, fontSize: 10, color: "rgba(255,255,255,0.6)" }}>{mark}</div></div>;
										})}
									</div>
									<div style={{ position: "absolute", top: 0, left: 0, width: RULER_SIZE, height: RULER_SIZE, background: "rgba(17,24,39,0.95)", borderRight: "1px solid rgba(255,255,255,0.08)", borderBottom: "1px solid rgba(255,255,255,0.08)", zIndex: 21 }} />
								</>
							) : null}

							<div ref={canvasShellRef} style={{ position: "absolute", left: pan.x + RULER_SIZE, top: pan.y + RULER_SIZE, width: currentDoc.width * zoom, height: currentDoc.height * zoom, background: "#111827", borderRadius: 18, overflow: "visible", boxShadow: "0 24px 80px rgba(0,0,0,0.35)" }}>
								<div id="bf-studio-canvas-inner" style={{ position: "absolute", inset: 0, width: currentDoc.width, height: currentDoc.height, transform: `scale(${zoom})`, transformOrigin: "top left", background: "linear-gradient(180deg, #1f2937 0%, #0f172a 100%)", overflow: "hidden", borderRadius: 18 / Math.max(zoom, 1) }}>
									{currentGuides.map((guide) => guide.orientation === "vertical" ? (
										<div key={guide.id} onMouseDown={(e) => { e.stopPropagation(); setGuideDrag({ id: guide.id, orientation: guide.orientation }); }} onDoubleClick={() => removeGuide(guide.id)} style={{ position: "absolute", left: guide.position, top: 0, bottom: 0, width: 1, background: GUIDE_COLORS.vertical, boxShadow: "0 0 0 1px rgba(239,68,68,0.3)", cursor: "ew-resize", zIndex: 5 }} />
									) : (
										<div key={guide.id} onMouseDown={(e) => { e.stopPropagation(); setGuideDrag({ id: guide.id, orientation: guide.orientation }); }} onDoubleClick={() => removeGuide(guide.id)} style={{ position: "absolute", top: guide.position, left: 0, right: 0, height: 1, background: GUIDE_COLORS.horizontal, boxShadow: "0 0 0 1px rgba(96,165,250,0.3)", cursor: "ns-resize", zIndex: 5 }} />
									))}

									{(currentDoc.elements || []).map((el) => {
										if (el.hidden) return null;
										const isSelected = selectedIds.includes(el.id);
										const common = {
											position: "absolute",
											left: el.x,
											top: el.y,
											width: el.width,
											height: el.height,
											opacity: el.opacity ?? 1,
											transform: `rotate(${el.rotation || 0}deg)`,
											boxSizing: "border-box",
											outline: isSelected ? "2px solid #ef4444" : "none",
											outlineOffset: 2,
											userSelect: "none",
											cursor: el.locked ? "not-allowed" : (tool === "hand" ? "grab" : "move"),
										};
										if (el.type === "text") {
											return (
												<div key={el.id} onMouseDown={(e) => startElementDrag(e, el)} onClick={(e) => { e.stopPropagation(); selectElement(el, e.shiftKey); }} style={{ ...common, color: el.color, fontSize: el.fontSize, fontWeight: el.fontWeight, fontFamily: el.fontFamily || FONT_OPTIONS[0], lineHeight: el.lineHeight, letterSpacing: `${el.letterSpacing || 0}px`, textAlign: el.align, whiteSpace: "pre-wrap", overflow: "hidden" }}>
													{showBoundPreview ? applyBindings(el.text, bindings) : el.text}
												</div>
											);
										}
										if (el.type === "shape") {
											return <div key={el.id} onMouseDown={(e) => startElementDrag(e, el)} onClick={(e) => { e.stopPropagation(); selectElement(el, e.shiftKey); }} style={{ ...common, background: el.fill, border: `${el.strokeWidth || 0}px solid ${el.stroke || "transparent"}`, borderRadius: el.radius || 0 }} />;
										}
										return <img key={el.id} alt="" src={el.src} onMouseDown={(e) => startElementDrag(e, el)} onClick={(e) => { e.stopPropagation(); selectElement(el, e.shiftKey); }} style={{ ...common, objectFit: el.fit || "cover", borderRadius: 12 }} draggable={false} />;
									})}

									{selectionBounds ? <div style={{ position: "absolute", left: selectionBounds.left, top: selectionBounds.top, width: selectionBounds.width, height: selectionBounds.height, border: "1px dashed rgba(255,255,255,0.75)", pointerEvents: "none", zIndex: 8 }} /> : null}
									{selected && !selected.locked ? <div onMouseDown={startResize} style={{ position: "absolute", left: Number(selected.x || 0) + Number(selected.width || 0) - 7, top: Number(selected.y || 0) + Number(selected.height || 0) - 7, width: 14, height: 14, borderRadius: 999, background: "#ef4444", border: "2px solid white", cursor: "nwse-resize", zIndex: 10 }} /> : null}
									{marquee ? <div style={{ position: "absolute", left: marquee.left, top: marquee.top, width: marquee.width, height: marquee.height, border: "1px dashed rgba(255,255,255,0.8)", background: "rgba(239,68,68,0.12)", pointerEvents: "none", zIndex: 12 }} /> : null}
								</div>
							</div>
						</>
					) : <div style={{ minHeight: 400, display: "grid", placeItems: "center", opacity: 0.7 }}>Create a document to start.</div>}
				</div>

				{inspectorOpen ? (
					<div style={{ minWidth: 0, background: "#111827", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 18, padding: 14, overflow: "auto" }}>
						<div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, marginBottom: 10 }}>
							<div style={{ fontWeight: 800 }}>Inspector</div>
							<div style={{ fontSize: 12, opacity: 0.7 }}>{currentDoc ? `${currentDoc.width} × ${currentDoc.height}` : "No canvas"}</div>
						</div>
						<div style={{ fontSize: 12, opacity: 0.72, marginBottom: 12 }}>{savedAt ? `Saved locally ${formatSavedAt(savedAt)}` : ""}</div>

						<div style={{ display: "grid", gap: 8, marginBottom: 12 }}>
							<button onClick={duplicateSelected} disabled={!selectedIds.length}>Duplicate</button>
							<button onClick={removeSelected} disabled={!selectedIds.length}>Delete</button>
							<button onClick={() => moveLayer("down")} disabled={!selectedIds.length}>Send Back</button>
							<button onClick={() => moveLayer("up")} disabled={!selectedIds.length}>Bring Forward</button>
							<button onClick={groupSelection} disabled={selectedIds.length < 2}>Group Selected</button>
							<button onClick={ungroupSelection} disabled={!selectedElements.some((el) => el.groupId)}>Ungroup</button>
							<button onClick={() => toggleSelectedFlag("locked")} disabled={!selectedIds.length}>{selectedElements.every((el) => el.locked) ? "Unlock" : "Lock"}</button>
							<button onClick={() => toggleSelectedFlag("hidden")} disabled={!selectedIds.length}>{selectedElements.every((el) => el.hidden) ? "Show" : "Hide"}</button>
						</div>

						{multiSelection ? (
							<div style={{ display: "grid", gap: 10 }}>
								<div style={{ fontWeight: 700 }}>{selectedIds.length} layers selected</div>
								<div style={{ fontSize: 12, opacity: 0.75 }}>Shift click to add or remove layers. Grouping lets them move together, because life is too short to drag five things separately.</div>
							</div>
						) : selected ? (
							<div style={{ display: "grid", gap: 10 }}>
								<label>Layer name<input value={selected.name || ""} onChange={(e) => updateElement(selected.id, { name: e.target.value })} style={{ width: "100%" }} /></label>
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
										<label>Font family<select value={selected.fontFamily || FONT_OPTIONS[0]} onChange={(e) => updateElement(selected.id, { fontFamily: e.target.value })} style={{ width: "100%" }}>{FONT_OPTIONS.map((font) => <option key={font} value={font}>{font}</option>)}</select></label>
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

								{selected.type === "image" ? <label>Fit<select value={selected.fit || "cover"} onChange={(e) => updateElement(selected.id, { fit: e.target.value })} style={{ width: "100%" }}><option value="cover">Cover</option><option value="contain">Contain</option><option value="fill">Fill</option></select></label> : null}
							</div>
						) : <div style={{ opacity: 0.7 }}>Select a layer to edit it.</div>}

						<div style={{ marginTop: 14 }}>
							<div style={{ fontWeight: 700, marginBottom: 8 }}>Layers</div>
							<div style={{ display: "grid", gap: 6, maxHeight: 320, overflow: "auto" }}>
								{orderedLayers.length ? orderedLayers.map((el) => (
									<button key={el.id} onClick={() => selectElement(el, false)} style={{ textAlign: "left", border: selectedIds.includes(el.id) ? "1px solid #ef4444" : "1px solid rgba(255,255,255,0.08)", background: selectedIds.includes(el.id) ? "rgba(239,68,68,0.15)" : "rgba(255,255,255,0.04)", borderRadius: 10, padding: 8 }}>
										<div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
											<div style={{ fontWeight: 700 }}>{el.name || el.type}</div>
											<div style={{ fontSize: 11, opacity: 0.7 }}>#{el._order}</div>
										</div>
										<div style={{ fontSize: 12, opacity: 0.72 }}>{el.type}{el.groupId ? ` • ${el.groupName || "grouped"}` : ""}{el.locked ? " • locked" : ""}{el.hidden ? " • hidden" : ""}</div>
									</button>
								)) : <div style={{ opacity: 0.7 }}>No layers yet.</div>}
							</div>
						</div>
					</div>
				) : null}
			</div>
		</div>
	);
}
