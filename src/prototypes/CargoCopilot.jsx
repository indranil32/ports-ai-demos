import React, { useState, useEffect, useRef } from "react";
import {
  Ship,
  Package,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Truck,
  MessageSquare,
  Send,
  Loader2,
  XCircle,
  Radio,
  LayoutDashboard,
  Anchor,
  RefreshCw,
  Check,
  X,
  Sparkles,
  Info,
} from "lucide-react";

/* =========================================================================
   CARGO COPILOT  -  customer-facing exception-management agent, prototype
   AD Ports Group  -  Digital & Technology

   Same architecture principles as the Lease Auditor / Quaywatch builds:
   - The model REASONS and decides what to check and what to propose.
   - All monetary figures are computed by deterministic JS, never by the model.
   - Every proposed action sits behind a human-in-the-loop approval gate.
   - AI-suggested and human-confirmed values are stored side by side.
   - No native `tools` API field is used (blocked in this sandbox in prior
     builds)  -  tool selection runs on a plain-JSON-in-text protocol instead.
   ========================================================================= */

// ---------------------------------------------------------------------------
// Design tokens (kept consistent with Quaywatch / Executive Digital Twin)
// ---------------------------------------------------------------------------
const COLORS = {
  navyDeep: "#0B1524",
  navy: "#10233A",
  navyLight: "#16304F",
  amber: "#FFC72C",
  cyan: "#22D3EE",
  red: "#F87171",
  redSolid: "#DC2626",
  green: "#34D399",
  slate: "#93A5B8",
  slateDim: "#5B6B7C",
  white: "#F7FAFC",
};

const FONT_DISPLAY = "'Space Grotesk', sans-serif";
const FONT_BODY = "'Inter', -apple-system, BlinkMacSystemFont, sans-serif";

// ---------------------------------------------------------------------------
// Synthetic data  -  shaped like an ATLP-style customer shipment export.
// Customer: a fictional BCO ("Meridian Container Lines") with active
// bookings through Khalifa Port CT2. All figures below are illustrative.
// ---------------------------------------------------------------------------
const TODAY = new Date("2026-08-10T09:00:00Z");
const DAY_MS = 86400000;

function d(dateStr) {
  return new Date(dateStr + "T00:00:00Z");
}

const SHIPMENTS = [
  {
    booking_ref: "MCL-88213",
    container_no: "MEDU7723451",
    vessel_name: "MV Horizon Star",
    terminal: "Khalifa Port CT2",
    commodity: "General cargo  -  machinery parts",
    vessel_status: "discharged",
    discharge_date: d("2026-08-06"),
    customs_status: "held",
    customs_hold_reason: "Missing certificate of origin",
    last_free_day: d("2026-08-08"),
    truck_appointment: { status: "none" },
    gate_status: "pending",
    demurrage_rate_aed: 350,
  },
  {
    booking_ref: "MCL-88214",
    container_no: "TCLU4498812",
    vessel_name: "MV Horizon Star",
    terminal: "Khalifa Port CT2",
    commodity: "General cargo  -  machinery parts",
    vessel_status: "discharged",
    discharge_date: d("2026-08-06"),
    customs_status: "cleared",
    last_free_day: d("2026-08-12"),
    truck_appointment: { status: "booked", slot: "2026-08-11 09:00" },
    gate_status: "pending",
    demurrage_rate_aed: 350,
  },
  {
    booking_ref: "MCL-88220",
    container_no: "MEDU5512087",
    vessel_name: "MV Coral Voyager",
    terminal: "Khalifa Port CT2",
    commodity: "Reefer  -  foodstuffs",
    vessel_status: "not_arrived",
    original_eta: d("2026-08-10"),
    revised_eta: d("2026-08-12"),
    delay_hours: 42,
    delay_reason: "Weather routing, Arabian Sea",
    downstream_dependency: "Connecting Etihad Rail slot RC-4471 booked for 2026-08-11",
    customs_status: "pending",
    last_free_day: null,
    truck_appointment: { status: "none" },
    gate_status: "pending",
    demurrage_rate_aed: 350,
  },
  {
    booking_ref: "MCL-88231",
    container_no: "FCIU2201156",
    vessel_name: "MV Horizon Star",
    terminal: "Khalifa Port CT2",
    commodity: "General cargo  -  spare parts",
    vessel_status: "discharged",
    discharge_date: d("2026-08-07"),
    customs_status: "cleared",
    last_free_day: d("2026-08-11"),
    truck_appointment: { status: "none" },
    gate_status: "pending",
    demurrage_rate_aed: 350,
  },
  {
    booking_ref: "MCL-88240",
    container_no: "MEDU9987001",
    vessel_name: "MV Atlantic Pearl",
    terminal: "Khalifa Port CT2",
    commodity: "General cargo  -  packaged goods",
    vessel_status: "gated_out",
    discharge_date: d("2026-08-04"),
    customs_status: "cleared",
    last_free_day: d("2026-08-07"),
    truck_appointment: { status: "completed", slot: "2026-08-05 14:00" },
    gate_status: "completed",
    demurrage_rate_aed: 350,
  },
  {
    booking_ref: "MCL-88255",
    container_no: "TCLU1187744",
    vessel_name: "MV Coral Voyager (prior call)",
    terminal: "Khalifa Port CT2",
    commodity: "General cargo  -  retail goods",
    vessel_status: "discharged",
    discharge_date: d("2026-08-05"),
    customs_status: "cleared",
    last_free_day: d("2026-08-09"),
    truck_appointment: { status: "missed", slot: "2026-08-09 11:00" },
    gate_status: "pending",
    demurrage_rate_aed: 350,
  },
  {
    booking_ref: "MCL-88262",
    container_no: "MEDU3345521",
    vessel_name: "MV Northern Light",
    terminal: "Khalifa Port CT2",
    commodity: "General cargo  -  construction materials",
    vessel_status: "not_arrived",
    original_eta: d("2026-08-15"),
    revised_eta: d("2026-08-15"),
    delay_hours: 0,
    customs_status: "pending",
    last_free_day: null,
    truck_appointment: { status: "none" },
    gate_status: "pending",
    demurrage_rate_aed: 350,
  },
];

// ---------------------------------------------------------------------------
// Status logic  -  deterministic, drives both the UI badges and the one-line
// hint fed to the model. The model doesn't invent this; it's given it.
// ---------------------------------------------------------------------------
function getStatus(s) {
  if (s.vessel_status === "gated_out") return { level: "delivered", label: "Delivered" };
  if (s.customs_status === "held") return { level: "exception", label: "Customs held" };
  if (s.truck_appointment.status === "missed") return { level: "exception", label: "Appointment missed" };
  if (s.vessel_status === "not_arrived" && s.delay_hours > 24)
    return { level: "exception", label: "Vessel delayed" };
  if (s.vessel_status === "discharged" && s.last_free_day) {
    const daysToLFD = Math.round((s.last_free_day - TODAY) / DAY_MS);
    if (daysToLFD < 0) return { level: "exception", label: "Last free day passed" };
    if (daysToLFD <= 1 && s.truck_appointment.status === "none")
      return { level: "at_risk", label: "No appointment, LFD near" };
  }
  if (s.vessel_status === "not_arrived") return { level: "on_track", label: "Upcoming, on schedule" };
  return { level: "on_track", label: "On track" };
}

function statusHint(s) {
  return `${s.booking_ref} | ${s.container_no} | ${s.vessel_name} | ${getStatus(s).label}`;
}

const STATUS_STYLES = {
  exception: { bg: "rgba(220,38,38,0.14)", fg: COLORS.red, dot: COLORS.redSolid },
  at_risk: { bg: "rgba(255,199,44,0.14)", fg: "#F5B93A", dot: COLORS.amber },
  on_track: { bg: "rgba(34,211,238,0.12)", fg: COLORS.cyan, dot: COLORS.cyan },
  delivered: { bg: "rgba(52,211,153,0.12)", fg: COLORS.green, dot: COLORS.green },
};

// ---------------------------------------------------------------------------
// Deterministic cost / risk calculation  -  NEVER done by the model.
// ---------------------------------------------------------------------------
function calcCostImpact(s) {
  if (s.vessel_status === "not_arrived") {
    return {
      booking_ref: s.booking_ref,
      kind: "schedule_risk",
      delay_hours: s.delay_hours || 0,
      downstream_dependency: s.downstream_dependency || null,
      estimated_exposure_aed: null,
      basis:
        "No demurrage tariff applies before discharge. This is a schedule-risk flag, not a cost figure.",
    };
  }
  const lfd = s.last_free_day;
  const daysOverdue = lfd ? Math.max(0, Math.round((TODAY - lfd) / DAY_MS)) : 0;
  const rate = s.demurrage_rate_aed || 0;
  const exposure = daysOverdue * rate;
  return {
    booking_ref: s.booking_ref,
    kind: "demurrage_exposure",
    days_overdue: daysOverdue,
    daily_rate_aed: rate,
    estimated_exposure_aed: exposure,
    basis: "Illustrative demurrage rate for this prototype  -  not AD Ports' published tariff.",
  };
}

function executeTool(name, input) {
  if (name === "calculate_cost_impact") {
    const s = SHIPMENTS.find((x) => x.booking_ref === input.booking_ref);
    if (!s) return { error: `Unknown booking_ref ${input.booking_ref}` };
    return calcCostImpact(s);
  }
  if (name === "propose_action") {
    return { logged: true, booking_ref: input.booking_ref };
  }
  return { error: `Unknown tool: ${name}` };
}

// ---------------------------------------------------------------------------
// Robust JSON extraction  -  handles code fences and stray prose around JSON.
// ---------------------------------------------------------------------------
function extractJson(text) {
  if (!text) return null;
  let t = text.trim();
  const fence = t.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fence) t = fence[1].trim();
  const start = t.indexOf("{");
  if (start === -1) return null;
  let depth = 0;
  for (let i = start; i < t.length; i++) {
    if (t[i] === "{") depth++;
    else if (t[i] === "}") {
      depth--;
      if (depth === 0) {
        const candidate = t.slice(start, i + 1);
        try {
          return JSON.parse(candidate);
        } catch (e) {
          return null;
        }
      }
    }
  }
  return null;
}

// ---------------------------------------------------------------------------
// Claude API call  -  no native `tools` field (avoided per prior findings).
// Surfaces the raw error body on failure instead of a generic message.
// ---------------------------------------------------------------------------
async function callClaude(messages, system) {
  const res = await fetch("/api/messages", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "claude-sonnet-5",
      max_tokens: 1000,
      system,
      messages,
    }),
  });
  if (!res.ok) {
    let bodyText = "";
    try {
      bodyText = await res.text();
    } catch (e) {
      /* ignore */
    }
    throw new Error(`API error ${res.status}: ${(bodyText || res.statusText || "").slice(0, 400)}`);
  }
  const data = await res.json();
  const text = (data.content || [])
    .filter((b) => b.type === "text")
    .map((b) => b.text)
    .join("\n");
  return text;
}

const SCAN_SYSTEM_PROMPT = `You are Cargo Copilot, an AI agent reviewing a shipping customer's active container shipments at Khalifa Port and flagging exceptions: customs holds, missed or missing truck appointments, last-free-day risk, and vessel delays with downstream schedule impact.

You have been given the full current record for every active shipment. Decide which are exceptions versus on track  -  do not call any tool for shipments that are already on track, delivered, or upcoming with no issue.

For every shipment you judge to be an exception:
1. Call calculate_cost_impact with its booking_ref. Never estimate or invent a number yourself  -  always use the tool's returned figure.
2. Then call propose_action exactly once, with a specific, concrete next step. action_type must be one of: expedite_customs_request, rebook_truck_appointment, notify_customer_proactive, escalate_to_ops. Keep "detail" under 30 words, plain language, written for a customer service rep who will review it before anything is sent to the customer.

Respond on every turn with ONLY raw JSON, no markdown fences, no prose outside the JSON, exactly one of these shapes:
{"type":"tool_call","name":"calculate_cost_impact","input":{"booking_ref":"..."}}
{"type":"tool_call","name":"propose_action","input":{"booking_ref":"...","action_type":"...","detail":"...","urgency":"low|medium|high"}}
{"type":"final","summary":"one or two sentences, under 40 words"}`;

const MAX_SCAN_TURNS = 14;

// ---------------------------------------------------------------------------
// Small presentational helpers
// ---------------------------------------------------------------------------
function StatusPill({ level, label }) {
  const st = STATUS_STYLES[level] || STATUS_STYLES.on_track;
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        padding: "3px 10px",
        borderRadius: 999,
        fontSize: 11.5,
        fontWeight: 600,
        background: st.bg,
        color: st.fg,
        letterSpacing: "0.01em",
      }}
    >
      <span style={{ width: 6, height: 6, borderRadius: 999, background: st.dot, display: "inline-block" }} />
      {label}
    </span>
  );
}

function TabButton({ active, onClick, icon: Icon, label }) {
  return (
    <button
      onClick={onClick}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 7,
        padding: "9px 14px",
        borderRadius: 8,
        border: "none",
        cursor: "pointer",
        fontSize: 13,
        fontWeight: 600,
        fontFamily: FONT_BODY,
        background: active ? COLORS.amber : "rgba(255,255,255,0.06)",
        color: active ? COLORS.navy : COLORS.slate,
        transition: "background 0.15s ease, color 0.15s ease",
      }}
    >
      <Icon size={15} />
      {label}
    </button>
  );
}

const cardStyle = {
  background: "#FFFFFF",
  borderRadius: 12,
  border: "1px solid #E4E9EF",
  boxShadow: "0 1px 2px rgba(16,35,58,0.04)",
};

const darkCardStyle = {
  background: COLORS.navyLight,
  borderRadius: 12,
  border: "1px solid rgba(255,255,255,0.08)",
};

function money(n) {
  if (n === null || n === undefined) return " - ";
  return "AED " + n.toLocaleString("en-US");
}

function fmtDate(dt) {
  if (!dt) return " - ";
  return dt.toISOString().slice(0, 10);
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------
export default function CargoCopilot() {
  const [view, setView] = useState("shipments");

  // Exception Copilot state
  const [scanning, setScanning] = useState(false);
  const [trace, setTrace] = useState([]);
  const [proposals, setProposals] = useState([]);
  const [scanError, setScanError] = useState(null);
  const [scanDone, setScanDone] = useState(false);
  const [editingCost, setEditingCost] = useState({}); // id -> string value being edited

  // Action log
  const [actionLog, setActionLog] = useState([]);

  // Ask Copilot chat
  const [chatMessages, setChatMessages] = useState([]);
  const [chatInput, setChatInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const [chatError, setChatError] = useState(null);

  const traceEndRef = useRef(null);
  useEffect(() => {
    if (traceEndRef.current) traceEndRef.current.scrollIntoView({ behavior: "smooth" });
  }, [trace]);

  function addTrace(kind, text) {
    setTrace((prev) => [...prev, { kind, text, t: Date.now() }]);
  }

  async function runScan() {
    setScanning(true);
    setScanError(null);
    setTrace([]);
    setProposals([]);
    setScanDone(false);

    const listing = SHIPMENTS.map(statusHint).join("\n");
    const detail = SHIPMENTS.map((s) => ({
      booking_ref: s.booking_ref,
      container_no: s.container_no,
      vessel_name: s.vessel_name,
      vessel_status: s.vessel_status,
      delay_hours: s.delay_hours,
      downstream_dependency: s.downstream_dependency,
      customs_status: s.customs_status,
      customs_hold_reason: s.customs_hold_reason,
      last_free_day: s.last_free_day ? fmtDate(s.last_free_day) : null,
      truck_appointment: s.truck_appointment,
      gate_status: s.gate_status,
    }));

    let messages = [
      {
        role: "user",
        content:
          `Active shipments for Meridian Container Lines:\n\n${listing}\n\n` +
          `Full detail:\n${JSON.stringify(detail, null, 0)}\n\n` +
          `Today's date is ${fmtDate(TODAY)}. Begin your review.`,
      },
    ];

    const costByBooking = {};
    let turns = 0;

    try {
      while (turns < MAX_SCAN_TURNS) {
        turns++;
        const replyText = await callClaude(messages, SCAN_SYSTEM_PROMPT);
        if (!replyText || !replyText.trim()) {
          throw new Error(`Empty response from model on turn ${turns}`);
        }
        messages.push({ role: "assistant", content: replyText });

        const parsed = extractJson(replyText);
        if (!parsed) {
          addTrace("meta", `Could not parse JSON on turn ${turns}: "${replyText.slice(0, 160)}"`);
          break;
        }

        if (parsed.type === "tool_call") {
          addTrace("call", `${parsed.name}(${JSON.stringify(parsed.input)})`);
          const result = executeTool(parsed.name, parsed.input);
          addTrace("result", JSON.stringify(result));

          if (parsed.name === "calculate_cost_impact" && parsed.input && parsed.input.booking_ref) {
            costByBooking[parsed.input.booking_ref] = result;
          }
          if (parsed.name === "propose_action") {
            const shipment = SHIPMENTS.find((s) => s.booking_ref === parsed.input.booking_ref);
            const id = `${parsed.input.booking_ref}-${Date.now()}`;
            setProposals((prev) => [
              ...prev,
              {
                id,
                booking_ref: parsed.input.booking_ref,
                container_no: shipment ? shipment.container_no : " - ",
                vessel_name: shipment ? shipment.vessel_name : " - ",
                action_type: parsed.input.action_type,
                detail: parsed.input.detail,
                urgency: parsed.input.urgency || "medium",
                ai_cost: costByBooking[parsed.input.booking_ref] || null,
                status: "pending",
              },
            ]);
          }

          messages.push({
            role: "user",
            content: `TOOL_RESULT ${parsed.name}: ${JSON.stringify(result)}\n\nContinue your review. Respond with JSON only.`,
          });
        } else if (parsed.type === "final") {
          addTrace("summary", parsed.summary || "Review complete.");
          setScanDone(true);
          break;
        } else {
          addTrace("meta", `Unrecognized response shape on turn ${turns}.`);
          break;
        }
      }
      if (turns >= MAX_SCAN_TURNS) {
        addTrace("meta", `Stopped after ${MAX_SCAN_TURNS} turns (safety cap).`);
      }
    } catch (e) {
      setScanError((e && e.message) || String(e));
    }
    setScanning(false);
  }

  function approveProposal(id) {
    const p = proposals.find((x) => x.id === id);
    if (!p) return;
    const editedVal = editingCost[id];
    const aiVal =
      p.ai_cost && p.ai_cost.estimated_exposure_aed !== null && p.ai_cost.estimated_exposure_aed !== undefined
        ? p.ai_cost.estimated_exposure_aed
        : null;
    const confirmedVal = editedVal !== undefined && editedVal !== "" ? Number(editedVal) : aiVal;
    setActionLog((prev) => [
      {
        ...p,
        status: "approved",
        ai_confirmed_value: aiVal,
        human_confirmed_value: confirmedVal,
        decided_at: new Date().toISOString(),
      },
      ...prev,
    ]);
    setProposals((prev) => prev.filter((x) => x.id !== id));
  }

  function rejectProposal(id) {
    const p = proposals.find((x) => x.id === id);
    if (!p) return;
    setActionLog((prev) => [
      {
        ...p,
        status: "rejected",
        ai_confirmed_value:
          p.ai_cost && p.ai_cost.estimated_exposure_aed !== undefined ? p.ai_cost.estimated_exposure_aed : null,
        human_confirmed_value: null,
        decided_at: new Date().toISOString(),
      },
      ...prev,
    ]);
    setProposals((prev) => prev.filter((x) => x.id !== id));
  }

  async function sendChat() {
    const text = chatInput.trim();
    if (!text || chatLoading) return;
    setChatError(null);
    const nextMessages = [...chatMessages, { role: "user", content: text }];
    setChatMessages(nextMessages);
    setChatInput("");
    setChatLoading(true);

    const dataForModel = SHIPMENTS.map((s) => ({
      booking_ref: s.booking_ref,
      container_no: s.container_no,
      vessel_name: s.vessel_name,
      status: getStatus(s).label,
      vessel_status: s.vessel_status,
      customs_status: s.customs_status,
      customs_hold_reason: s.customs_hold_reason || null,
      last_free_day: s.last_free_day ? fmtDate(s.last_free_day) : null,
      truck_appointment: s.truck_appointment,
      gate_status: s.gate_status,
      revised_eta: s.revised_eta ? fmtDate(s.revised_eta) : null,
      delay_hours: s.delay_hours || null,
      downstream_dependency: s.downstream_dependency || null,
    }));

    const system = `You are Cargo Copilot's customer-facing assistant for Meridian Container Lines at Khalifa Port. Answer only using the shipment data provided below  -  if something isn't in the data, say you don't have that information rather than guessing. Be concise and plain-spoken, like a helpful ops contact, not a generic chatbot. Today's date is ${fmtDate(
      TODAY
    )}.\n\nShipment data:\n${JSON.stringify(dataForModel, null, 0)}`;

    try {
      const apiMessages = nextMessages.map((m) => ({ role: m.role, content: m.content }));
      const reply = await callClaude(apiMessages, system);
      setChatMessages((prev) => [...prev, { role: "assistant", content: reply || "(no response)" }]);
    } catch (e) {
      setChatError((e && e.message) || String(e));
    }
    setChatLoading(false);
  }

  const tickerItems = SHIPMENTS.map((s) => `${s.booking_ref} | ${getStatus(s).label} | ${s.terminal}`);

  return (
    <div style={{ minHeight: "100vh", background: "#F3F5F8", fontFamily: FONT_BODY }}>
      <style>{`
        @keyframes tickerScroll {
          from { transform: translateX(0); }
          to { transform: translateX(-50%); }
        }
        @keyframes pulseDot {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.35; }
        }
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        .spin { animation: spin 0.9s linear infinite; }
        .ticker-track { animation: tickerScroll 32s linear infinite; }
        .cc-scroll::-webkit-scrollbar { width: 8px; }
        .cc-scroll::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.14); border-radius: 8px; }
        .cc-btn-primary { background: ${COLORS.amber}; color: ${COLORS.navy}; }
        .cc-btn-primary:hover { filter: brightness(0.96); }
        .cc-btn-ghost:hover { background: rgba(16,35,58,0.06); }
        input, textarea { font-family: ${FONT_BODY}; }
      `}</style>

      {/* Header */}
      <div style={{ background: COLORS.navy }}>
        <div
          style={{
            maxWidth: 1180,
            margin: "0 auto",
            padding: "18px 20px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: 12,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div
              style={{
                width: 38,
                height: 38,
                borderRadius: 9,
                background: "rgba(255,199,44,0.14)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Anchor size={19} color={COLORS.amber} />
            </div>
            <div>
              <div
                style={{
                  fontFamily: FONT_DISPLAY,
                  fontSize: 22,
                  fontWeight: 700,
                  color: "#FFFFFF",
                  letterSpacing: "0.01em",
                  lineHeight: 1.1,
                }}
              >
                Cargo Copilot
              </div>
              <div style={{ fontSize: 12.5, color: COLORS.slate, marginTop: 2 }}>
                Meridian Container Lines | Khalifa Port customer portal  -  prototype
              </div>
            </div>
          </div>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            <TabButton active={view === "shipments"} onClick={() => setView("shipments")} icon={Package} label="Shipments" />
            <TabButton active={view === "copilot"} onClick={() => setView("copilot")} icon={Sparkles} label="Exception Copilot" />
            <TabButton active={view === "log"} onClick={() => setView("log")} icon={LayoutDashboard} label="Action log" />
            <TabButton active={view === "chat"} onClick={() => setView("chat")} icon={MessageSquare} label="Ask Copilot" />
          </div>
        </div>
      </div>

      {/* Live ticker  -  signature element */}
      <div style={{ background: COLORS.navyDeep, overflow: "hidden", borderBottom: `1px solid rgba(255,255,255,0.06)` }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "7px 20px" }}>
          <Radio size={13} color={COLORS.cyan} style={{ animation: "pulseDot 1.8s ease-in-out infinite", flexShrink: 0 }} />
          <div style={{ overflow: "hidden", flex: 1, whiteSpace: "nowrap" }}>
            <div className="ticker-track" style={{ display: "inline-block" }}>
              {[...tickerItems, ...tickerItems].map((item, i) => (
                <span key={i} style={{ fontSize: 11.5, color: COLORS.slate, marginRight: 36, letterSpacing: "0.01em" }}>
                  {item}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div style={{ maxWidth: 1180, margin: "0 auto", padding: "26px 20px 60px" }}>
        {/* ================= SHIPMENTS ================= */}
        {view === "shipments" && (
          <div>
            <div style={{ marginBottom: 18 }}>
              <h2 style={{ fontFamily: FONT_DISPLAY, fontSize: 19, color: COLORS.navy, margin: "0 0 4px" }}>
                Active shipments
              </h2>
              <p style={{ fontSize: 13, color: COLORS.slateDim, margin: 0 }}>
                {SHIPMENTS.length} bookings currently tracked for Meridian Container Lines at Khalifa Port CT2.
              </p>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 14 }}>
              {SHIPMENTS.map((s) => {
                const st = getStatus(s);
                return (
                  <div key={s.booking_ref} style={{ ...cardStyle, padding: 16 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
                      <div>
                        <div style={{ fontFamily: FONT_DISPLAY, fontSize: 14.5, fontWeight: 700, color: COLORS.navy }}>
                          {s.booking_ref}
                        </div>
                        <div style={{ fontSize: 12, color: COLORS.slateDim, marginTop: 1 }}>{s.container_no}</div>
                      </div>
                      <StatusPill level={st.level} label={st.label} />
                    </div>
                    <div style={{ fontSize: 12.5, color: "#3A4B5C", display: "flex", flexDirection: "column", gap: 4, marginTop: 10 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <Ship size={13} color={COLORS.slateDim} /> {s.vessel_name}
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <Package size={13} color={COLORS.slateDim} /> {s.commodity}
                      </div>
                      {s.last_free_day && (
                        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                          <Clock size={13} color={COLORS.slateDim} /> Last free day {fmtDate(s.last_free_day)}
                        </div>
                      )}
                      {s.vessel_status === "not_arrived" && (
                        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                          <Clock size={13} color={COLORS.slateDim} /> ETA {fmtDate(s.revised_eta || s.original_eta)}
                          {s.delay_hours > 0 ? ` (+${s.delay_hours}h)` : ""}
                        </div>
                      )}
                      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <Truck size={13} color={COLORS.slateDim} /> Truck appointment:{" "}
                        {s.truck_appointment.status === "booked" || s.truck_appointment.status === "completed"
                          ? s.truck_appointment.slot
                          : s.truck_appointment.status}
                      </div>
                      {s.customs_status === "held" && (
                        <div style={{ display: "flex", alignItems: "center", gap: 6, color: COLORS.redSolid }}>
                          <AlertTriangle size={13} /> Held: {s.customs_hold_reason}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ================= EXCEPTION COPILOT ================= */}
        {view === "copilot" && (
          <div style={{ display: "grid", gridTemplateColumns: "minmax(320px, 1fr) minmax(340px, 1.1fr)", gap: 20, alignItems: "start" }}>
            {/* Left: trace + controls */}
            <div style={{ ...darkCardStyle, padding: 20 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
                <h2 style={{ fontFamily: FONT_DISPLAY, fontSize: 16.5, color: "#FFFFFF", margin: 0 }}>Exception scan</h2>
                <Sparkles size={16} color={COLORS.amber} />
              </div>
              <p style={{ fontSize: 12.5, color: COLORS.slate, margin: "6px 0 16px", lineHeight: 1.5 }}>
                Reviews every active shipment, decides which are exceptions, calculates the real cost or schedule
                risk with deterministic logic, and proposes one action per exception for a rep to approve. This
                calls the live Claude API  -  nothing here is scripted.
              </p>
              <button
                onClick={runScan}
                disabled={scanning}
                className="cc-btn-primary"
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 8,
                  width: "100%",
                  padding: "11px 16px",
                  borderRadius: 8,
                  border: "none",
                  fontWeight: 700,
                  fontSize: 13.5,
                  cursor: scanning ? "default" : "pointer",
                  opacity: scanning ? 0.75 : 1,
                }}
              >
                {scanning ? <Loader2 size={16} className="spin" /> : <RefreshCw size={15} />}
                {scanning ? "Scanning shipments..." : "Run exception scan"}
              </button>

              {scanError && (
                <div
                  style={{
                    marginTop: 14,
                    padding: 12,
                    borderRadius: 8,
                    background: "rgba(220,38,38,0.14)",
                    border: "1px solid rgba(220,38,38,0.3)",
                    fontSize: 12,
                    color: "#FCA5A5",
                    lineHeight: 1.5,
                  }}
                >
                  <div style={{ fontWeight: 700, marginBottom: 4, display: "flex", alignItems: "center", gap: 6 }}>
                    <XCircle size={14} /> Scan failed
                  </div>
                  {scanError}
                </div>
              )}

              <div
                className="cc-scroll"
                style={{
                  marginTop: 16,
                  maxHeight: 420,
                  overflowY: "auto",
                  fontFamily: "'JetBrains Mono', 'Courier New', monospace",
                  fontSize: 11.5,
                  lineHeight: 1.6,
                  background: COLORS.navyDeep,
                  borderRadius: 8,
                  padding: 12,
                  border: "1px solid rgba(255,255,255,0.06)",
                }}
              >
                {trace.length === 0 && !scanning && (
                  <div style={{ color: COLORS.slateDim }}>Reasoning trace will appear here once you run a scan.</div>
                )}
                {trace.map((t, i) => (
                  <div
                    key={i}
                    style={{
                      marginBottom: 6,
                      color: t.kind === "call" ? COLORS.cyan : t.kind === "result" ? COLORS.slate : t.kind === "summary" ? COLORS.amber : "#F87171",
                    }}
                  >
                    <span style={{ opacity: 0.6 }}>
                      [{t.kind === "call" ? "CALL" : t.kind === "result" ? "RESULT" : t.kind === "summary" ? "DONE" : "ERR"}]{" "}
                    </span>
                    {t.text}
                  </div>
                ))}
                <div ref={traceEndRef} />
              </div>
            </div>

            {/* Right: proposals awaiting approval */}
            <div>
              <h3 style={{ fontFamily: FONT_DISPLAY, fontSize: 15.5, color: COLORS.navy, margin: "0 0 10px" }}>
                Proposed actions {proposals.length > 0 && `(${proposals.length})`}
              </h3>
              {proposals.length === 0 && (
                <div style={{ ...cardStyle, padding: 20, textAlign: "center", color: COLORS.slateDim, fontSize: 13 }}>
                  {scanning ? "Waiting on the model..." : "No proposals yet  -  run a scan to generate them."}
                </div>
              )}
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {proposals.map((p) => (
                  <div key={p.id} style={{ ...cardStyle, padding: 16, borderLeft: `3px solid ${COLORS.amber}` }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                      <div>
                        <div style={{ fontSize: 12, color: COLORS.slateDim }}>
                          {p.booking_ref} | {p.container_no}
                        </div>
                        <div style={{ fontFamily: FONT_DISPLAY, fontSize: 14.5, fontWeight: 700, color: COLORS.navy, marginTop: 2 }}>
                          {actionLabel(p.action_type)}
                        </div>
                      </div>
                      <UrgencyBadge urgency={p.urgency} />
                    </div>
                    <p style={{ fontSize: 12.5, color: "#3A4B5C", margin: "8px 0", lineHeight: 1.5 }}>{p.detail}</p>

                    {p.ai_cost && (
                      <div
                        style={{
                          fontSize: 11.5,
                          color: COLORS.slateDim,
                          background: "#F3F5F8",
                          borderRadius: 6,
                          padding: "8px 10px",
                          marginBottom: 10,
                          lineHeight: 1.5,
                        }}
                      >
                        {p.ai_cost.kind === "demurrage_exposure" ? (
                          <>
                            <strong style={{ color: COLORS.navy }}>AI-calculated exposure:</strong>{" "}
                            {money(p.ai_cost.estimated_exposure_aed)} ({p.ai_cost.days_overdue} day(s) overdue x{" "}
                            {money(p.ai_cost.daily_rate_aed)}/day)
                            <div style={{ fontStyle: "italic", marginTop: 2 }}>{p.ai_cost.basis}</div>
                          </>
                        ) : (
                          <>
                            <strong style={{ color: COLORS.navy }}>Schedule risk:</strong>{" "}
                            {p.ai_cost.downstream_dependency || "Downstream impact flagged, no direct cost tool applies."}
                            <div style={{ fontStyle: "italic", marginTop: 2 }}>{p.ai_cost.basis}</div>
                          </>
                        )}
                      </div>
                    )}

                    {p.ai_cost && p.ai_cost.kind === "demurrage_exposure" && (
                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                        <label style={{ fontSize: 11.5, color: COLORS.slateDim, whiteSpace: "nowrap" }}>Confirm exposure (AED):</label>
                        <input
                          type="number"
                          placeholder={String(p.ai_cost.estimated_exposure_aed)}
                          value={editingCost[p.id] ?? ""}
                          onChange={(e) => setEditingCost((prev) => ({ ...prev, [p.id]: e.target.value }))}
                          style={{
                            width: 100,
                            fontSize: 12,
                            padding: "5px 8px",
                            borderRadius: 6,
                            border: "1px solid #D7DEE6",
                          }}
                        />
                      </div>
                    )}

                    <div style={{ display: "flex", gap: 8 }}>
                      <button
                        onClick={() => approveProposal(p.id)}
                        style={{
                          flex: 1,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          gap: 6,
                          padding: "8px 10px",
                          borderRadius: 7,
                          border: "none",
                          background: COLORS.navy,
                          color: "#fff",
                          fontSize: 12.5,
                          fontWeight: 600,
                          cursor: "pointer",
                        }}
                      >
                        <Check size={14} /> Approve
                      </button>
                      <button
                        onClick={() => rejectProposal(p.id)}
                        className="cc-btn-ghost"
                        style={{
                          flex: 1,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          gap: 6,
                          padding: "8px 10px",
                          borderRadius: 7,
                          border: "1px solid #D7DEE6",
                          background: "#fff",
                          color: COLORS.slateDim,
                          fontSize: 12.5,
                          fontWeight: 600,
                          cursor: "pointer",
                        }}
                      >
                        <X size={14} /> Reject
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ================= ACTION LOG ================= */}
        {view === "log" && (
          <div>
            <div style={{ marginBottom: 18 }}>
              <h2 style={{ fontFamily: FONT_DISPLAY, fontSize: 19, color: COLORS.navy, margin: "0 0 4px" }}>Action log</h2>
              <p style={{ fontSize: 13, color: COLORS.slateDim, margin: 0 }}>
                Every decision made against an AI proposal, with the AI-suggested and human-confirmed values stored
                side by side for accuracy tracking.
              </p>
            </div>
            {actionLog.length === 0 ? (
              <div style={{ ...cardStyle, padding: 24, textAlign: "center", color: COLORS.slateDim, fontSize: 13 }}>
                No decisions logged yet. Approve or reject a proposal from the Exception Copilot tab.
              </div>
            ) : (
              <div style={{ ...cardStyle, overflow: "hidden" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
                  <thead>
                    <tr style={{ background: "#F3F5F8", textAlign: "left" }}>
                      {["Booking", "Action", "Status", "AI value (AED)", "Human-confirmed (AED)", "Decided"].map((h) => (
                        <th key={h} style={{ padding: "10px 14px", color: COLORS.slateDim, fontWeight: 600, borderBottom: "1px solid #E4E9EF" }}>
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {actionLog.map((a, i) => (
                      <tr key={i} style={{ borderBottom: "1px solid #EEF1F5" }}>
                        <td style={{ padding: "10px 14px", color: COLORS.navy, fontWeight: 600 }}>{a.booking_ref}</td>
                        <td style={{ padding: "10px 14px" }}>{actionLabel(a.action_type)}</td>
                        <td style={{ padding: "10px 14px" }}>
                          {a.status === "approved" ? (
                            <span style={{ color: COLORS.green, display: "flex", alignItems: "center", gap: 5 }}>
                              <CheckCircle2 size={13} /> Approved
                            </span>
                          ) : (
                            <span style={{ color: COLORS.redSolid, display: "flex", alignItems: "center", gap: 5 }}>
                              <XCircle size={13} /> Rejected
                            </span>
                          )}
                        </td>
                        <td style={{ padding: "10px 14px", color: COLORS.slateDim }}>
                          {a.ai_confirmed_value !== null && a.ai_confirmed_value !== undefined ? a.ai_confirmed_value.toLocaleString("en-US") : " - "}
                        </td>
                        <td style={{ padding: "10px 14px", color: COLORS.navy, fontWeight: 600 }}>
                          {a.human_confirmed_value !== null && a.human_confirmed_value !== undefined
                            ? a.human_confirmed_value.toLocaleString("en-US")
                            : " - "}
                        </td>
                        <td style={{ padding: "10px 14px", color: COLORS.slateDim }}>
                          {new Date(a.decided_at).toLocaleString("en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* ================= ASK COPILOT ================= */}
        {view === "chat" && (
          <div style={{ maxWidth: 720, margin: "0 auto" }}>
            <div style={{ marginBottom: 16 }}>
              <h2 style={{ fontFamily: FONT_DISPLAY, fontSize: 19, color: COLORS.navy, margin: "0 0 4px" }}>Ask Copilot</h2>
              <p style={{ fontSize: 13, color: COLORS.slateDim, margin: 0 }}>
                Ask about any active shipment. Answers are grounded only in the data on the Shipments tab  -  live
                Claude API call, no scripted responses.
              </p>
            </div>
            <div
              className="cc-scroll"
              style={{
                ...cardStyle,
                minHeight: 320,
                maxHeight: 440,
                overflowY: "auto",
                padding: 16,
                display: "flex",
                flexDirection: "column",
                gap: 10,
              }}
            >
              {chatMessages.length === 0 && (
                <div style={{ color: COLORS.slateDim, fontSize: 13, margin: "auto" }}>
                  Try: "Which of my shipments need my attention right now?"
                </div>
              )}
              {chatMessages.map((m, i) => (
                <div
                  key={i}
                  style={{
                    alignSelf: m.role === "user" ? "flex-end" : "flex-start",
                    maxWidth: "80%",
                    background: m.role === "user" ? COLORS.navy : "#F3F5F8",
                    color: m.role === "user" ? "#fff" : "#22303C",
                    padding: "9px 13px",
                    borderRadius: 12,
                    fontSize: 13,
                    lineHeight: 1.5,
                    whiteSpace: "pre-wrap",
                  }}
                >
                  {m.content}
                </div>
              ))}
              {chatLoading && (
                <div style={{ alignSelf: "flex-start", color: COLORS.slateDim, fontSize: 12.5, display: "flex", alignItems: "center", gap: 6 }}>
                  <Loader2 size={13} className="spin" /> Copilot is thinking...
                </div>
              )}
              {chatError && (
                <div style={{ alignSelf: "flex-start", color: COLORS.redSolid, fontSize: 12, background: "rgba(220,38,38,0.08)", padding: "8px 10px", borderRadius: 8 }}>
                  {chatError}
                </div>
              )}
            </div>
            <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
              <input
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") sendChat();
                }}
                placeholder="Ask about your shipments..."
                style={{
                  flex: 1,
                  padding: "11px 14px",
                  borderRadius: 9,
                  border: "1px solid #D7DEE6",
                  fontSize: 13.5,
                }}
              />
              <button
                onClick={sendChat}
                disabled={chatLoading || !chatInput.trim()}
                className="cc-btn-primary"
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  padding: "0 18px",
                  borderRadius: 9,
                  border: "none",
                  fontWeight: 700,
                  fontSize: 13,
                  cursor: chatLoading ? "default" : "pointer",
                  opacity: chatLoading || !chatInput.trim() ? 0.6 : 1,
                }}
              >
                <Send size={14} /> Send
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Footer note */}
      <div style={{ maxWidth: 1180, margin: "0 auto", padding: "0 20px 30px" }}>
        <div style={{ display: "flex", alignItems: "flex-start", gap: 8, fontSize: 11.5, color: COLORS.slateDim }}>
          <Info size={13} style={{ marginTop: 1, flexShrink: 0 }} />
          Prototype on synthetic data shaped like an ATLP export. Demurrage rates, dates, and cost figures are
          illustrative and unvalidated  -  not AD Ports' published tariffs. All proposed actions require human approval
          before anything reaches a customer.
        </div>
      </div>
    </div>
  );
}

function actionLabel(type) {
  const map = {
    expedite_customs_request: "Expedite customs request",
    rebook_truck_appointment: "Rebook truck appointment",
    notify_customer_proactive: "Notify customer proactively",
    escalate_to_ops: "Escalate to operations",
    no_action: "No action needed",
  };
  return map[type] || type;
}

function UrgencyBadge({ urgency }) {
  const map = {
    high: { bg: "rgba(220,38,38,0.12)", fg: "#DC2626", label: "High" },
    medium: { bg: "rgba(255,199,44,0.16)", fg: "#B98A00", label: "Medium" },
    low: { bg: "rgba(52,211,153,0.14)", fg: "#0F9D6D", label: "Low" },
  };
  const st = map[urgency] || map.medium;
  return (
    <span
      style={{
        fontSize: 10.5,
        fontWeight: 700,
        textTransform: "uppercase",
        letterSpacing: "0.04em",
        padding: "3px 8px",
        borderRadius: 6,
        background: st.bg,
        color: st.fg,
        flexShrink: 0,
      }}
    >
      {st.label}
    </span>
  );
}
