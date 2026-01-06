// netlify/functions/dashboard-state.js
import { getStore } from "@netlify/blobs";

const STORE_NAME = "lab-dashboard";
const STATE_KEY = "state";

const benchesList = [
  "Hema",
  "Cobas",
  "Cyto",
  "Immulite",
  "RIA",
  "Recei",
  "Libero",
];

const defaultLayout = {
  noticePercent: 15,
  rotationPercent: 20,
};

const defaultState = {
  // Notice HTML
  notice: "<div style='text-align:center;'>Welcome to <b>Lab Dashboard</b></div>",
  staff: ["Alice", "Bob", "Charlie", "Dave", "Eve"], 
  benches: Object.fromEntries(
    benchesList.map((name) => [name, "-- Select --"])
  ),
  kanban: {
    "list-todo": [],
    "list-progress": [],
    "list-done": [],
  },
  // New: Timestamp for the counter (defaults to now)
  lastCorrectionDate: Date.now(),
  layout: defaultLayout,
};

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };
}

function normalizeLayout(lay) {
  const base = defaultLayout;
  const out = { ...base };
  if (!lay || typeof lay !== "object") return out;

  let n = parseFloat(lay.noticePercent);
  if (Number.isFinite(n) && n >= 5 && n <= 60) out.noticePercent = n;

  let r = parseFloat(lay.rotationPercent);
  if (Number.isFinite(r) && r >= 5 && r <= 60) out.rotationPercent = r;
  
  if (out.noticePercent + out.rotationPercent > 90) {
    out.noticePercent = 15;
    out.rotationPercent = 20;
  }
  return out;
}

function mergeWithDefaults(incoming) {
  if (!incoming) return defaultState;
  
  const benchesRaw = incoming.benches || {};
  const benches = {};
  benchesList.forEach(b => {
    benches[b] = benchesRaw[b] || "-- Select --";
  });

  const kanbanRaw = incoming.kanban || {};
  const ensureArray = (arr) => Array.isArray(arr) ? arr : [];

  const kanban = {
    "list-todo": ensureArray(kanbanRaw["list-todo"]),
    "list-progress": ensureArray(kanbanRaw["list-progress"]),
    "list-done": ensureArray(kanbanRaw["list-done"]),
  };

  const staff = Array.isArray(incoming.staff) ? incoming.staff : defaultState.staff;
  const layout = normalizeLayout(incoming.layout);
  
  // Handle new field
  const lastCorrectionDate = incoming.lastCorrectionDate || defaultState.lastCorrectionDate;
  
  return { 
    notice: incoming.notice || "", 
    staff, 
    benches, 
    kanban, 
    lastCorrectionDate, // Export
    layout 
  };
}

export default async (req, context) => {
  const store = getStore(STORE_NAME);

  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders() });
  }

  if (req.method === "GET") {
    const existing = await store.get(STATE_KEY, { type: "json" });
    const state = mergeWithDefaults(existing);
    return new Response(JSON.stringify(state), {
      status: 200,
      headers: { "Content-Type": "application/json", "Cache-Control": "no-store", ...corsHeaders() },
    });
  }

  if (req.method === "POST") {
    let body;
    try {
      body = await req.json();
    } catch (err) {
      return new Response(JSON.stringify({ error: "Invalid JSON" }), {
        status: 400,
        headers: { "Content-Type": "application/json", ...corsHeaders() },
      });
    }

    const state = mergeWithDefaults(body);
    await store.setJSON(STATE_KEY, state);

    return new Response(JSON.stringify({ success: true, data: state }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders() },
    });
  }

  return new Response("Method Not Allowed", { status: 405 });
};