const DEMO_KEY = "bf_demo_state_v1";

function now() {
	return Date.now();
}

function daysFromNow(days, hour = 18, minute = 0) {
	const d = new Date();
	d.setDate(d.getDate() + days);
	d.setHours(hour, minute, 0, 0);
	return d.getTime();
}

function uid(prefix) {
	return `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
}

function buildSeed() {
	const t = now();
	return {
		org: {
			id: "demo-org",
			name: "Bondfire Demo Org",
			role: "demo",
		},
		people: [
			{ id: "p1", name: "Ash Rivera", role: "Coordinator", phone: "555-0101", skills: "logistics, outreach", notes: "Keeps things moving." },
			{ id: "p2", name: "Noe Patel", role: "Volunteer", phone: "555-0102", skills: "distribution, intake", notes: "Helps with public intake." },
			{ id: "p3", name: "Kit Morales", role: "Medic", phone: "555-0103", skills: "medical, triage", notes: "Brings first aid kits to events." },
			{ id: "p4", name: "Tuna Fisher", role: "Kitchen", phone: "555-0104", skills: "bulk cooking, inventory", notes: "Handles food runs." },
		],
		inventory: [
			{ id: "i1", name: "Blankets", qty: 18, par: 12, unit: "ea", category: "shelter", location: "Storage Closet A", notes: "Winter stock", is_public: true },
			{ id: "i2", name: "Canned Beans", qty: 64, par: 40, unit: "cans", category: "food", location: "Pantry Shelf 2", notes: "", is_public: true },
			{ id: "i3", name: "First Aid Kits", qty: 6, par: 8, unit: "kits", category: "medical", location: "Medical Bin", notes: "Low", is_public: false },
			{ id: "i4", name: "Bus Passes", qty: 11, par: 20, unit: "passes", category: "transport", location: "Desk Drawer", notes: "", is_public: false },
		],
		needs: [
			{ id: "n1", title: "Winter coats for teens", description: "Need 12 warm coats before next outreach event.", urgency: "high", priority: 8, status: "open", is_public: true, created_at: t - 86400000 },
			{ id: "n2", title: "Ride to clinic appointments", description: "Need three volunteer drivers this week.", urgency: "urgent", priority: 10, status: "open", is_public: true, created_at: t - 43200000 },
			{ id: "n3", title: "Shelf stable snacks", description: "Restock for meeting nights.", urgency: "medium", priority: 4, status: "open", is_public: false, created_at: t - 21600000 },
		],
		meetings: [
			{ id: "m1", title: "Weekly coordination", starts_at: daysFromNow(1, 18, 30), ends_at: daysFromNow(1, 20, 0), location: "Community Center", agenda: "Needs review and task handoff", is_public: true, my_rsvp: null },
			{ id: "m2", title: "Food distro prep", starts_at: daysFromNow(3, 17, 0), ends_at: daysFromNow(3, 18, 30), location: "Kitchen", agenda: "Pack pantry kits", is_public: false, my_rsvp: "going" },
			{ id: "m3", title: "Public orientation", starts_at: daysFromNow(5, 19, 0), ends_at: daysFromNow(5, 20, 0), location: "Zoom", agenda: "Intro to Bondfire", is_public: true, my_rsvp: null },
		],
		pledges: [
			{ id: "pl1", pledger_name: "Ari", type: "supplies", amount: 20, unit: "coats", status: "offered", created_at: t - 6500000 },
			{ id: "pl2", pledger_name: "Maya", type: "rides", amount: 2, unit: "rides", status: "accepted", created_at: t - 2500000 },
		],
		subscribers: [
			{ id: "s1", email: "demo1@example.org", created_at: t - 1200000 },
			{ id: "s2", email: "demo2@example.org", created_at: t - 3200000 },
			{ id: "s3", email: "demo3@example.org", created_at: t - 7200000 },
		],
		publicInbox: [
			{ id: "pi1", kind: "get_help", name: "Sam", contact: "sam@example.org", details: "Need diapers and food staples", status: "new", created_at: t - 5200000 },
			{ id: "pi2", kind: "volunteer", name: "Rin", contact: "555-4444", details: "Available Saturdays", status: "new", created_at: t - 2200000 },
			{ id: "pi3", kind: "offer_resources", name: "Jules", contact: "jules@example.org", details: "Can donate blankets", status: "new", created_at: t - 1200000 },
		],
	};
}

function clone(v) {
	return JSON.parse(JSON.stringify(v));
}

export function readDemoState() {
	try {
		const raw = localStorage.getItem(DEMO_KEY);
		if (raw) return JSON.parse(raw);
	} catch {}
	const seed = buildSeed();
	writeDemoState(seed);
	return seed;
}

export function writeDemoState(state) {
	try {
		localStorage.setItem(DEMO_KEY, JSON.stringify(state));
	} catch {}
}

export function resetDemoState() {
	const seed = buildSeed();
	writeDemoState(seed);
	return seed;
}

export function ensureDemoOrgList() {
	const state = readDemoState();
	try {
		localStorage.setItem("bf_orgs", JSON.stringify([state.org]));
	} catch {}
	return state.org;
}

function collectionForSegment(seg) {
	switch (seg) {
		case "people": return "people";
		case "inventory": return "inventory";
		case "needs": return "needs";
		case "meetings": return "meetings";
		case "pledges": return "pledges";
		default: return null;
	}
}

function normalizeReturn(seg, rows) {
	switch (seg) {
		case "people": return { people: rows };
		case "inventory": return { items: rows };
		case "needs": return { needs: rows };
		case "meetings": return { meetings: rows };
		case "pledges": return { pledges: rows };
		default: return {};
	}
}

function upsertById(rows, row) {
	const idx = rows.findIndex((x) => String(x?.id) === String(row?.id));
	if (idx === -1) return [row, ...rows];
	const next = rows.slice();
	next[idx] = { ...next[idx], ...row };
	return next;
}

function deleteById(rows, id) {
	return rows.filter((x) => String(x?.id) !== String(id));
}

function dashboard(state) {
	const needsOpen = (state.needs || []).filter((n) => String(n?.status || "").toLowerCase() === "open");
	const meetingsUpcoming = (state.meetings || []).filter((m) => Number(m?.starts_at || 0) > 0);
	return {
		counts: {
			people: state.people.length,
			inventory: state.inventory.length,
			needsOpen: needsOpen.length,
			meetingsUpcoming: meetingsUpcoming.length,
			pledgesActive: state.pledges.length,
			publicInbox: state.publicInbox.length,
			subsTotal: state.subscribers.length,
		},
		people: clone(state.people),
		inventory: clone(state.inventory),
		needs: clone(state.needs),
		meetings: clone(state.meetings),
	};
}

function parseBody(body) {
	if (!body) return {};
	if (typeof body === "string") {
		try { return JSON.parse(body); } catch { return {}; }
	}
	return body;
}

export function demoHandle(path, opts = {}) {
	const method = String(opts.method || "GET").toUpperCase();
	const body = parseBody(opts.body);
	const url = new URL(path, "https://demo.local");
	const parts = url.pathname.split("/").filter(Boolean);

	if (url.pathname === "/api/orgs") {
		if (method === "GET") {
			const org = ensureDemoOrgList();
			return { ok: true, orgs: [org] };
		}
	}

	if (parts[0] !== "api" || parts[1] !== "orgs") return null;
	const orgId = decodeURIComponent(parts[2] || "");
	const state = readDemoState();
	if (orgId !== state.org.id) return { ok: false, error: "Demo org not found" };

	if (parts.length === 3 && method === "GET") {
		return { ok: true, org: clone(state.org) };
	}

	if (parts[3] === "dashboard" && method === "GET") {
		return dashboard(state);
	}

	if (parts[3] === "newsletter" && parts[4] === "subscribers" && method === "GET") {
		return { ok: true, subscribers: clone(state.subscribers) };
	}

	if (parts[3] === "public" && parts[4] === "inbox" && method === "GET") {
		return { ok: true, items: clone(state.publicInbox) };
	}

	if (parts[3] === "meetings" && parts[5] === "rsvp") {
		const meetingId = decodeURIComponent(parts[4] || "");
		const rows = state.meetings || [];
		const idx = rows.findIndex((m) => String(m?.id) === meetingId);
		if (idx === -1) return { ok: false, error: "Meeting not found" };
		if (method === "GET") {
			const cur = rows[idx]?.my_rsvp ? { status: rows[idx].my_rsvp } : null;
			return { ok: true, my_rsvp: cur };
		}
		if (method === "POST") {
			rows[idx] = { ...rows[idx], my_rsvp: String(body?.status || "yes") };
			state.meetings = rows;
			writeDemoState(state);
			return { ok: true, my_rsvp: { status: rows[idx].my_rsvp } };
		}
	}

	if (parts[3] === "meetings" && parts[4] && method === "GET") {
		const meetingId = decodeURIComponent(parts[4] || "");
		const meeting = (state.meetings || []).find((m) => String(m?.id) === meetingId);
		if (!meeting) return { ok: false, error: "Meeting not found" };
		const counts = {
			member: { yes: 2, maybe: 1, no: 0, total: 3 },
			public: { yes: 1, maybe: 0, no: 0, total: 1 },
			combined: { yes: 3, maybe: 1, no: 0, total: 4 },
		};
		return { ok: true, meeting: { ...clone(meeting), rsvp_counts: counts } };
	}

	const seg = parts[3];
	const coll = collectionForSegment(seg);
	if (!coll) return null;

	if (method === "GET") {
		return normalizeReturn(seg, clone(state[coll] || []));
	}

	if (method === "POST") {
		const row = { ...body, id: uid(seg[0]), created_at: body?.created_at || now() };
		state[coll] = [row, ...(state[coll] || [])];
		writeDemoState(state);
		if (seg === "inventory") return { ok: true, item: clone(row) };
		if (seg === "people") return { ok: true, id: row.id };
		return { ok: true, row: clone(row), id: row.id };
	}

	if (method === "PUT") {
		state[coll] = upsertById(state[coll] || [], body);
		writeDemoState(state);
		return { ok: true };
	}

	if (method === "DELETE") {
		const id = url.searchParams.get("id") || body?.id;
		state[coll] = deleteById(state[coll] || [], id);
		writeDemoState(state);
		return { ok: true };
	}

	return { ok: false, error: "Unsupported demo operation" };
}
