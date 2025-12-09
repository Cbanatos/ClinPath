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

// 預設狀態
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
};

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*", // 同一 Netlify site 本身唔需要，但咁寫方便之後用其他 domain 控制
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };
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
    "list-done": Array.isArray(kanbanRaw["list-done"])
      ? kanbanRaw["list-done"]
      : [],
  };

  return { notice, benches, kanban };
}

export default async (req, context) => {
  const store = getStore(STORE_NAME);

  // CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: corsHeaders(),
    });
  }

  // 讀取狀態
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

  // 寫入狀態（控制頁 or TV 變更）
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
    await store.setJSON(STATE_KEY, state); // 用 JSON 模式寫入 :contentReference[oaicite:5]{index=5}

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
