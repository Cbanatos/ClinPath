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

// 預設每個區塊高度 (vh)
const defaultLayout = {
  notice: 13,
  rotation: 16,
  kanban: 24,
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

function normalizeLayout(lay) {
  const base = defaultLayout;
  const out = { ...base };

  if (!lay || typeof lay !== "object") return out;

  const keys = ["notice", "rotation", "kanban"];

  keys.forEach((k) => {
    let v = parseFloat(lay[k]);
    if (!Number.isFinite(v)) {
      v = base[k];
    }

    // 簡單夾一夾範圍，避免太誇張
    if (k === "notice") v = Math.min(Math.max(v, 8), 25);
    if (k === "rotation") v = Math.min(Math.max(v, 10), 25);
    if (k === "kanban") v = Math.min(Math.max(v, 15), 40);

    out[k] = v;
  });

  return out;
}

function mergeWithDefaults(raw) {
  const incoming = raw || {};

  // notice
  const notice =
    typeof incoming.notice === "string" ? incoming.notice : defaultState.notice;

  // benches
  const benches = {};
  benchesList.forEach((name) => {
    const v =
      incoming.benches && typeof incoming.benches[name] === "string"
        ? incoming.benches[name]
        : defaultState.benches[name];
    benches[name] = v;
  });

  // kanban
  const kanbanRaw = incoming.kanban || {};
  const kanban = {
    "list-todo": Array.isArray(kanbanRaw["list-todo"])
      ? kanbanRaw["list-todo"]
      : [],
    "list-progress": Array.isArray(kanbanRaw["list-progress"])
      ? kanbanRaw["list-progress"]
      : [],
    "list-done": Array.isArray(kanbanRaw["list-done"]) ? kanbanRaw["list-done"] : [],
  };

  // layout
  const layout = normalizeLayout(incoming.layout);

  return { notice, benches, kanban, layout };
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

    return new Response(JSON.stringify(state), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders() },
    });
  }

  return new Response("Method not allowed", {
    status: 405,
    headers: corsHeaders(),
  });
};
