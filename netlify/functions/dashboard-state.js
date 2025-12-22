// netlify/functions/dashboard-state.js
import { getStore } from "@netlify/blobs";

const STORE_NAME = "lab-dashboard";
const STATE_KEY = "state";

const benchesList = [
  "Hematology",
  "Cobas",
  "Cytology",
  "Immulite",
  "RIA",
  "Receiving",
  "Libero",
];

// 預設佈局 (單位為百分比 %)
// Notice 和 Rotation 設定高度，Kanban 自動填滿剩餘空間
const defaultLayout = {
  noticePercent: 15,    // 15% 高度
  rotationPercent: 20,  // 20% 高度
  // 剩餘 65% 給 Kanban
};

const defaultState = {
  notice: "",
  benches: Object.fromEntries(
    benchesList.map((name) => [name, "-- Select --"])
  ),
  kanban: {
    "list-todo": [],
    "list-progress": [],
    "list-done": [],
  },
  layout: defaultLayout,
};

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };
}

// 確保數值是合理的百分比
function normalizeLayout(lay) {
  const base = defaultLayout;
  const out = { ...base };

  if (!lay || typeof lay !== "object") return out;

  // 檢查 Notice %
  let n = parseFloat(lay.noticePercent);
  if (Number.isFinite(n) && n >= 5 && n <= 50) {
    out.noticePercent = n;
  }

  // 檢查 Rotation %
  let r = parseFloat(lay.rotationPercent);
  if (Number.isFinite(r) && r >= 5 && r <= 60) {
    out.rotationPercent = r;
  }
  
  // 確保兩者加起來不超過 90%，留至少 10% 給 Kanban
  if (out.noticePercent + out.rotationPercent > 90) {
    out.noticePercent = 15;
    out.rotationPercent = 20;
  }

  return out;
}

function mergeWithDefaults(incoming) {
  if (!incoming) return defaultState;
  
  // 合併 benches
  const benchesRaw = incoming.benches || {};
  const benches = {};
  benchesList.forEach(b => {
    benches[b] = benchesRaw[b] || "-- Select --";
  });

  // 合併 kanban (保持陣列)
  const kanbanRaw = incoming.kanban || {};
  const kanban = {
    "list-todo": Array.isArray(kanbanRaw["list-todo"]) ? kanbanRaw["list-todo"] : [],
    "list-progress": Array.isArray(kanbanRaw["list-progress"]) ? kanbanRaw["list-progress"] : [],
    "list-done": Array.isArray(kanbanRaw["list-done"]) ? kanbanRaw["list-done"] : [],
  };

  const layout = normalizeLayout(incoming.layout);

  return { 
    notice: incoming.notice || "", 
    benches, 
    kanban, 
    layout 
  };
}

export default async (req, context) => {
  const store = getStore(STORE_NAME);

  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: corsHeaders(),
    });
  }

  if (req.method === "GET") {
    const existing = await store.get(STATE_KEY, { type: "json" });
    const state = mergeWithDefaults(existing);

    return new Response(JSON.stringify(state), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "no-store",
        ...corsHeaders(),
      },
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