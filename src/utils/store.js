/**
 * Shared store (localStorage) — v2-compatible.
 * Fix: persist org.logoDataUrl reliably; avoid seed() wiping org branding.
 */
const KEY = 'bondfire:data:v2';
const defaultData = {
  org: { id:'crman', name:'Chehalis River Mutual Aid Network', color:'#8a1111', logoDataUrl:null },
  people: [], inventory: [], needs: [], meetings: [], pledges: [], newsletter: [], files: {}
};

function load(){
  try{
    const raw = localStorage.getItem(KEY);
    if(!raw) return structuredClone(defaultData);
    const parsed = JSON.parse(raw);
    // defensive defaults
    return { ...structuredClone(defaultData), ...parsed, org: { ...defaultData.org, ...(parsed.org||{}) } };
  }catch(e){
    console.error('store load error', e);
    return structuredClone(defaultData);
  }
}

function save(s){ try{ localStorage.setItem(KEY, JSON.stringify(s)); }catch(e){ console.error('store save error', e); } }

let state = load();
const listeners = new Set();
export function getState(){ return state; }
export function subscribe(fn){ listeners.add(fn); return () => listeners.delete(fn); }
function emit(){ for(const fn of listeners) fn(state); save(state); }

// Org
export function setOrgMeta(partial){ state.org = { ...state.org, ...partial }; emit(); }
export function setOrgLogoFromDataUrl(dataUrl){ state.org = { ...state.org, logoDataUrl: dataUrl }; emit(); }

// People
export function addPerson(p){ state.people.push({ id: crypto.randomUUID(), ...p }); emit(); }
export function updatePerson(id, partial){ state.people = state.people.map(x=>x.id===id?{...x,...partial}:x); emit(); }
export function deletePerson(id){ state.people = state.people.filter(x=>x.id!==id); emit(); }

// Inventory
export function addItem(it){ state.inventory.push({ id: crypto.randomUUID(), public:true, ...it }); emit(); }
export function updateItem(id, partial){ state.inventory = state.inventory.map(x=>x.id===id?{...x,...partial}:x); emit(); }
export function deleteItem(id){ state.inventory = state.inventory.filter(x=>x.id!==id); emit(); }

// Needs
export function addNeed(n){ state.needs.push({ id: crypto.randomUUID(), status:'open', ...n }); emit(); }
export function updateNeed(id, partial){ state.needs = state.needs.map(x=>x.id===id?{...x,...partial}:x); emit(); }
export function deleteNeed(id){ state.needs = state.needs.filter(x=>x.id!==id); emit(); }
export function advanceNeed(id){ updateNeed(id,{status:'in_progress'}); }
export function resolveNeed(id){ updateNeed(id,{status:'resolved'}); }
export function reopenNeed(id){ updateNeed(id,{status:'open'}); }

// Meetings
export function addMeeting(m){ state.meetings.push({ id: crypto.randomUUID(), files:[], ...m }); emit(); }
export function updateMeeting(id, partial){ state.meetings = state.meetings.map(x=>x.id===id?{...x,...partial}:x); emit(); }
export function attachFileToMeeting(id, fileId){ state.meetings = state.meetings.map(x=>x.id===id?{...x, files:[...x.files, fileId]}:x); emit(); }

// Files
export async function saveFile(file){
  const buf = await file.arrayBuffer();
  const b64 = btoa(String.fromCharCode(...new Uint8Array(buf)));
  const dataUrl = `data:${file.type || 'application/octet-stream'};base64,${b64}`;
  const id = crypto.randomUUID();
  state.files[id] = { id, name:file.name, type:file.type, size:file.size, dataUrl, createdAt: Date.now() };
  emit();
  return id;
}

// Public
export function addPledge(p){ state.pledges.push({ id: crypto.randomUUID(), ...p, createdAt: Date.now() }); emit(); }
export function addNewsletterEmail(email){ if(email && !state.newsletter.includes(email)) { state.newsletter.push(email); emit(); } }

// Hook
import { useSyncExternalStore } from 'react';
export function useStore(selector = s => s){ return useSyncExternalStore(subscribe, () => selector(getState())); }

// Seed — do NOT clobber org branding
export function seedDemo(){
  const keepOrg = state.org;
  state = {
    ...structuredClone(defaultData),
    org: keepOrg,
    people: [
      { id:'p1', name:'Alex', role:'Volunteer', phone:'555-0101', skills:'logistics' },
      { id:'p2', name:'Riley', role:'Cook', phone:'555-0102', skills:'kitchen' }
    ],
    inventory: [
      { id:'i1', name:'Rice 50lb', qty:2, unit:'bag', category:'Food', location:'Pantry', public:true, low:1 },
      { id:'i2', name:'Blankets', qty:30, unit:'ea', category:'Shelter', location:'Bin A', public:true, low:10 },
      { id:'i3', name:'N95 Masks', qty:200, unit:'ea', category:'Health', location:'Closet', public:false, low:50 }
    ],
    needs: [
      { id:'n1', title:'Propane refills', status:'open', detail:'Need 3 tanks refilled', notes:'' },
      { id:'n2', title:'Winter coats (L/XL)', status:'in_progress', detail:'Collecting donations', notes:'' }
    ],
    meetings: [
      { id:'m1', title:'Saturday Kitchen', when:'Sat 10am', notes:'Plan menu', files:[] }
    ],
    pledges: [], newsletter: [], files:{}
  };
  emit();
}
