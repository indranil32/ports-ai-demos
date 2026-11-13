import React, { useState, useRef, useEffect } from 'react';
import * as XLSX from 'xlsx';
import {
  Cpu, Database, FileSearch, TrendingUp, ShieldAlert, Gavel, CheckCircle,
  XCircle, Play, RefreshCcw, AlertTriangle, Zap, Clock, FileDown, Upload,
} from 'lucide-react';

const FONT_SANS = "'IBM Plex Sans', ui-sans-serif, system-ui, sans-serif";
const FONT_MONO = "'IBM Plex Mono', ui-monospace, monospace";

const COLORS = {
  abyss: '#0A0F1D', hull: '#111A2E', steel: '#1E293B', mist: '#94A3B8',
  signal: '#22D3EE', agent: '#A78BFA', starboard: '#22C55E',
  caution: '#F59E0B', portmark: '#EF4444',
};

const INITIAL_MOCK_DATA = {
  CMA: {
    label: 'CMA Global Line Terminals', healthScore: 91,
    deferredWorkOrders: [],
    deferredMaintenanceCostUsd: 150000, handbackAllowanceUsd: 300000,
    lastInspection: '2026-04-12',
    reportedThroughput: 462000, verifiedThroughput: 462000, contractedThroughput: 450000,
    royaltyRatePerUnit: 18.2, unit: 'TEU',
    environmentalFlags: [],
  },
  CSP: {
    label: 'CSP Global Bulk Hub', healthScore: 63,
    deferredWorkOrders: [
      { id: 'WO-88401', desc: 'Quay Crane #1 gearbox overhaul — overdue 11 months', estCostUsd: 340000 },
      { id: 'WO-88402', desc: 'Quay Crane #3 rail alignment correction — overdue 7 months', estCostUsd: 210000 },
      { id: 'WO-88403', desc: 'Bulk conveyor belt #2 structural fatigue repair — overdue 5 months', estCostUsd: 410000 },
      { id: 'WO-88404', desc: 'Dust suppression pump replacement — overdue 3 months', estCostUsd: 90000 },
    ],
    deferredMaintenanceCostUsd: 1050000, handbackAllowanceUsd: 250000,
    lastInspection: '2025-09-30',
    reportedThroughput: 810000, verifiedThroughput: 902000, contractedThroughput: 750000,
    royaltyRatePerUnit: 6.9, unit: 'tonnes',
    environmentalFlags: ['Dust suppression system compliance review pending — Q3 2026'],
  },
  ADT: {
    label: 'ADT Container Services', healthScore: 94,
    deferredWorkOrders: [],
    deferredMaintenanceCostUsd: 40000, handbackAllowanceUsd: 350000,
    lastInspection: '2026-06-02',
    reportedThroughput: 610000, verifiedThroughput: 610000, contractedThroughput: 580000,
    royaltyRatePerUnit: 14.8, unit: 'TEU',
    environmentalFlags: [],
  },
  KPRT: {
    label: 'KPRT Multipurpose Terminal', healthScore: 84,
    deferredWorkOrders: [
      { id: 'WO-77210', desc: 'Warehouse roof sheeting minor corrosion — scheduled, not overdue', estCostUsd: 90000 },
    ],
    deferredMaintenanceCostUsd: 90000, handbackAllowanceUsd: 200000,
    lastInspection: '2026-05-10',
    reportedThroughput: 350000, verifiedThroughput: 350000, contractedThroughput: 320000,
    royaltyRatePerUnit: 12.6, unit: 'TEU',
    environmentalFlags: ['Minor noise threshold exceedance — Q2 2026 (resolved)'],
  },
};

const CLAUSE_TEXT = {
  handback: (d) => `Clause 9.3 (Handback Condition): Tenant shall return all leased infrastructure in a condition consistent with normal wear and tear. Dilapidation liability equals total overdue/deferred maintenance cost (per Maximo work order records) minus a permitted allowance of $${d.handbackAllowanceUsd.toLocaleString()}. Amounts exceeding the allowance are payable by the tenant prior to lease renewal.`,
  variable_rent: (d) => `Clause 6.1 (Variable Royalty): Royalty is payable at $${d.royaltyRatePerUnit}/${d.unit} on tenant-reported throughput, reconciled quarterly against independently gate-sensor-verified volumes. Any shortfall between reported and verified volume is payable retroactively at the same rate.`,
  environmental: () => `Clause 14.2 (Environmental & Safety Boundaries): Tenant shall maintain hazardous material storage, dust suppression, noise, and emissions systems in compliance with Port Authority EHS Standard PA-EHS-04. An unpermitted breach or an ignored maintenance alert may result in a formal Notice of Default and financial penalty.`,
};

function normalizeKey(k) {
  return String(k).trim().toLowerCase().replace(/[\s-]+/g, '_');
}

function rowGet(row, ...aliases) {
  const normalized = {};
  Object.keys(row).forEach((k) => { normalized[normalizeKey(k)] = row[k]; });
  for (const alias of aliases) {
    const nk = normalizeKey(alias);
    if (normalized[nk] !== undefined && normalized[nk] !== '') return normalized[nk];
  }
  return undefined;
}

function parseWorkbook(workbook) {
  const sheetNames = workbook.SheetNames;
  const findSheet = (target) => sheetNames.find((n) => normalizeKey(n) === normalizeKey(target));
  const tenantsSheetName = findSheet('tenants') || sheetNames[0];
  const workOrdersSheetName = findSheet('workorders') || findSheet('work_orders');
  const flagsSheetName = findSheet('environmentalflags') || findSheet('environmental_flags');

  if (!tenantsSheetName) return { newData: {}, errors: ['No sheets found in the uploaded workbook.'] };

  const tenantRows = XLSX.utils.sheet_to_json(workbook.Sheets[tenantsSheetName], { defval: '' });
  const workOrderRows = workOrdersSheetName ? XLSX.utils.sheet_to_json(workbook.Sheets[workOrdersSheetName], { defval: '' }) : [];
  const flagRows = flagsSheetName ? XLSX.utils.sheet_to_json(workbook.Sheets[flagsSheetName], { defval: '' }) : [];

  const errors = [];
  const newData = {};

  tenantRows.forEach((row, idx) => {
    const rowLabel = `Tenants row ${idx + 2}`;
    const code = String(rowGet(row, 'tenant_code', 'code', 'tenant') || '').trim();
    if (!code) { errors.push(`${rowLabel}: missing tenant_code`); return; }

    const label = String(rowGet(row, 'tenant_name', 'name', 'label') || code).trim();

    const numeric = (aliases) => {
      const raw = rowGet(row, ...aliases);
      const n = Number(raw);
      if (raw === undefined || raw === '' || isNaN(n)) {
        errors.push(`${rowLabel} (${code}): missing or invalid "${aliases[0]}"`);
        return null;
      }
      return n;
    };

    const healthScore = numeric(['health_score', 'maximo_health_score']);
    const deferredMaintenanceCostUsd = numeric(['deferred_maintenance_cost_usd', 'deferred_maintenance_cost']);
    const handbackAllowanceUsd = numeric(['handback_allowance_usd', 'handback_allowance']);
    const reportedThroughput = numeric(['reported_throughput']);
    const verifiedThroughput = numeric(['verified_throughput', 'ai_verified_throughput']);
    const contractedThroughput = numeric(['contracted_throughput']);
    const royaltyRatePerUnit = numeric(['royalty_rate_per_unit', 'royalty_rate']);
    const unit = String(rowGet(row, 'unit') || '').trim();
    const lastInspection = String(rowGet(row, 'last_inspection', 'inspection_date') || '').trim();

    if (!unit) errors.push(`${rowLabel} (${code}): missing "unit"`);
    if (!lastInspection) errors.push(`${rowLabel} (${code}): missing "last_inspection"`);

    const deferredWorkOrders = workOrderRows
      .filter((r) => normalizeKey(String(rowGet(r, 'tenant_code', 'code', 'tenant') || '')) === normalizeKey(code))
      .map((r) => ({
        id: String(rowGet(r, 'id', 'wo_id', 'work_order_id') || ''),
        desc: String(rowGet(r, 'description', 'desc') || ''),
        estCostUsd: Number(rowGet(r, 'est_cost_usd', 'estimated_cost_usd', 'cost_usd')) || 0,
      }));

    const environmentalFlags = flagRows
      .filter((r) => normalizeKey(String(rowGet(r, 'tenant_code', 'code', 'tenant') || '')) === normalizeKey(code))
      .map((r) => String(rowGet(r, 'flag', 'description', 'incident') || ''))
      .filter(Boolean);

    newData[code] = {
      label, healthScore, deferredMaintenanceCostUsd, handbackAllowanceUsd, lastInspection,
      reportedThroughput, verifiedThroughput, contractedThroughput, royaltyRatePerUnit, unit,
      deferredWorkOrders, environmentalFlags,
    };
  });

  return { newData, errors };
}

// NOTE: this sandbox blocks the native Anthropic `tools` (function-calling) request field,
// so these are documentation only — executeTool() below still keys off these same names/inputs.
// The actual tool-selection loop is driven by instructed JSON in plain text turns (see SYSTEM_PROMPT).
const TOOLS = [
  {
    name: 'get_asset_condition_report',
    description: "Fetch Maximo-linked asset condition data for the tenant's leased infrastructure: current health score (0-100), list of overdue/deferred maintenance work orders with estimated costs, and last inspection date.",
    input_schema: { type: 'object', properties: { tenant_code: { type: 'string' } }, required: ['tenant_code'] },
  },
  {
    name: 'get_lease_clause_text',
    description: 'Fetch the verbatim lease clause text for a given topic and tenant.',
    input_schema: {
      type: 'object',
      properties: { tenant_code: { type: 'string' }, topic: { type: 'string', enum: ['handback', 'variable_rent', 'environmental'] } },
      required: ['tenant_code', 'topic'],
    },
  },
  {
    name: 'get_throughput_reconciliation',
    description: 'Fetch contracted minimum throughput, tenant-reported throughput used for royalty billing, independently gate-sensor-verified throughput, and the royalty rate per unit.',
    input_schema: { type: 'object', properties: { tenant_code: { type: 'string' } }, required: ['tenant_code'] },
  },
  {
    name: 'get_environmental_incident_log',
    description: 'Fetch logged environmental/safety incidents or flags for the tenant.',
    input_schema: { type: 'object', properties: { tenant_code: { type: 'string' } }, required: ['tenant_code'] },
  },
  {
    name: 'propose_compliance_action',
    description: 'Propose a formal compliance action against the tenant. This DRAFTS the action only — it always requires human executive approval before being filed in Maximo. Use only after gathering sufficient evidence from the read tools.',
    input_schema: {
      type: 'object',
      properties: {
        tenant_code: { type: 'string' },
        action_type: { type: 'string', enum: ['dilapidation_claim', 'royalty_shortfall_claim', 'notice_of_default', 'no_action'] },
        amount_usd: { type: 'number', description: 'Proposed financial claim amount in USD, if applicable' },
        justification: { type: 'string', description: 'Evidence-based justification citing the specific figures gathered from the tools, including your arithmetic' },
      },
      required: ['tenant_code', 'action_type', 'justification'],
    },
  },
];

const SYSTEM_PROMPT = `You are an autonomous lease compliance auditor for a port authority landlord. You do NOT have direct data access — you must request it, one call at a time, using the tools below.

Available tools:
- get_asset_condition_report {tenant_code} — Maximo health score, overdue/deferred work orders with costs, last inspection date
- get_lease_clause_text {tenant_code, topic: "handback" | "variable_rent" | "environmental"} — verbatim lease clause text
- get_throughput_reconciliation {tenant_code} — contracted / tenant-reported / independently-verified throughput, royalty rate per unit
- get_environmental_incident_log {tenant_code} — logged environmental/safety incidents
- propose_compliance_action {tenant_code, action_type: "dilapidation_claim" | "royalty_shortfall_claim" | "notice_of_default" | "no_action", amount_usd (if applicable), justification} — drafts a formal action; this ALWAYS requires human executive approval before it is filed, so use it only after gathering sufficient evidence

Investigate the tenant across three vectors: (1) handback/dilapidation liability, (2) throughput-linked variable royalty accuracy, (3) environmental & safety compliance. Reason strictly from figures the tools return — never invent numbers. When calculating any liability or shortfall, show your arithmetic explicitly in your justification.

Respond with EXACTLY ONE JSON object per turn and NOTHING else — no markdown code fences, no prose outside the JSON. Use one of these two shapes:

To call a tool: {"action": "call_tool", "tool": "<tool_name>", "input": {...}, "reasoning": "<one short sentence on why>"}
To conclude: {"action": "final_answer", "content": "<short structured summary: findings per vector, then your conclusion>", "reasoning": "<one short sentence on why you're concluding now>"}

Call at most one tool per turn. Only call propose_compliance_action after gathering evidence from the relevant read tools, and only propose a claim/notice if the evidence supports it — use action_type "no_action" if it does not.`;

function executeTool(name, input, data) {
  switch (name) {
    case 'get_asset_condition_report':
      return {
        health_score: data.healthScore,
        deferred_work_orders: data.deferredWorkOrders,
        total_deferred_maintenance_cost_usd: data.deferredMaintenanceCostUsd,
        last_inspection: data.lastInspection,
      };
    case 'get_lease_clause_text': {
      const fn = CLAUSE_TEXT[input.topic];
      return fn ? { clause_text: fn(data) } : { error: 'unknown topic' };
    }
    case 'get_throughput_reconciliation':
      return {
        contracted_minimum: data.contractedThroughput,
        tenant_reported_for_billing: data.reportedThroughput,
        independently_verified: data.verifiedThroughput,
        unit: data.unit,
        royalty_rate_per_unit_usd: data.royaltyRatePerUnit,
      };
    case 'get_environmental_incident_log':
      return { incidents: data.environmentalFlags.length ? data.environmentalFlags : ['No incidents logged'] };
    default:
      return { error: 'unknown tool' };
  }
}

const TOOL_META = {
  get_asset_condition_report: { Icon: Database, color: COLORS.signal },
  get_lease_clause_text: { Icon: FileSearch, color: COLORS.agent },
  get_throughput_reconciliation: { Icon: TrendingUp, color: COLORS.caution },
  get_environmental_incident_log: { Icon: ShieldAlert, color: COLORS.caution },
  propose_compliance_action: { Icon: Gavel, color: COLORS.portmark },
};

let traceIdCounter = 0;

export default function AgenticLeaseAuditor() {
  const [tenantCode, setTenantCode] = useState('CSP');
  const [mockData, setMockData] = useState(() => JSON.parse(JSON.stringify(INITIAL_MOCK_DATA)));
  const [trace, setTrace] = useState([]);
  const [isRunning, setIsRunning] = useState(false);
  const [finalAnswer, setFinalAnswer] = useState(null);
  const [error, setError] = useState(null);
  const [pendingAction, setPendingAction] = useState(null);
  const [uploadedFileName, setUploadedFileName] = useState(null);
  const [uploadError, setUploadError] = useState(null);

  const traceScrollRef = useRef(null);
  const approvalResolveRef = useRef(null);
  const cardStyle = { backgroundColor: COLORS.hull, border: `1px solid ${COLORS.steel}` };

  useEffect(() => {
    if (traceScrollRef.current) traceScrollRef.current.scrollTop = traceScrollRef.current.scrollHeight;
  }, [trace, pendingAction]);

  const addTrace = (item) => {
    traceIdCounter += 1;
    setTrace((prev) => [...prev, { id: traceIdCounter, ...item }]);
  };

  const updateMockField = (field, value) => {
    setMockData((prev) => ({ ...prev, [tenantCode]: { ...prev[tenantCode], [field]: value } }));
  };

  const resetInputs = () => {
    setMockData((prev) => ({ ...prev, [tenantCode]: JSON.parse(JSON.stringify(INITIAL_MOCK_DATA[tenantCode] || prev[tenantCode])) }));
  };

  const downloadTemplate = () => {
    const tenantRows = Object.entries(INITIAL_MOCK_DATA).map(([code, d]) => ({
      tenant_code: code, tenant_name: d.label, health_score: d.healthScore,
      deferred_maintenance_cost_usd: d.deferredMaintenanceCostUsd, handback_allowance_usd: d.handbackAllowanceUsd,
      last_inspection: d.lastInspection, reported_throughput: d.reportedThroughput,
      verified_throughput: d.verifiedThroughput, contracted_throughput: d.contractedThroughput,
      royalty_rate_per_unit: d.royaltyRatePerUnit, unit: d.unit,
    }));
    const workOrderRows = [];
    Object.entries(INITIAL_MOCK_DATA).forEach(([code, d]) => {
      d.deferredWorkOrders.forEach((wo) => workOrderRows.push({ tenant_code: code, id: wo.id, description: wo.desc, est_cost_usd: wo.estCostUsd }));
    });
    const flagRows = [];
    Object.entries(INITIAL_MOCK_DATA).forEach(([code, d]) => {
      d.environmentalFlags.forEach((f) => flagRows.push({ tenant_code: code, flag: f }));
    });
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(tenantRows), 'Tenants');
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(workOrderRows), 'WorkOrders');
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(flagRows), 'EnvironmentalFlags');
    XLSX.writeFile(wb, 'lease-audit-template.xlsx');
  };

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setUploadError(null);
    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const wb = XLSX.read(evt.target.result, { type: 'array' });
        const { newData, errors } = parseWorkbook(wb);
        if (errors.length > 0) { setUploadError(errors.join(' · ')); return; }
        if (Object.keys(newData).length === 0) { setUploadError('No tenant rows found in the uploaded file.'); return; }
        setMockData(newData);
        setTenantCode(Object.keys(newData)[0]);
        setUploadedFileName(file.name);
        setTrace([]); setFinalAnswer(null); setError(null); setPendingAction(null);
      } catch (err) {
        setUploadError('Could not parse file: ' + err.message);
      }
    };
    reader.readAsArrayBuffer(file);
    e.target.value = '';
  };

  const restoreDemoData = () => {
    setMockData(JSON.parse(JSON.stringify(INITIAL_MOCK_DATA)));
    setTenantCode('CSP');
    setUploadedFileName(null);
    setUploadError(null);
    setTrace([]); setFinalAnswer(null); setError(null); setPendingAction(null);
  };

  const waitForApproval = (details) => {
    setPendingAction(details);
    return new Promise((resolve) => { approvalResolveRef.current = resolve; });
  };

  const handleApprove = () => {
    const r = approvalResolveRef.current;
    approvalResolveRef.current = null;
    setPendingAction(null);
    if (r) r({ approved: true });
  };

  const handleReject = () => {
    const r = approvalResolveRef.current;
    approvalResolveRef.current = null;
    setPendingAction(null);
    if (r) r({ approved: false });
  };

  function extractJson(text) {
    let t = (text || '').trim();
    const fenceMatch = t.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (fenceMatch) t = fenceMatch[1].trim();
    try {
      return JSON.parse(t);
    } catch (e) {
      const start = t.indexOf('{');
      const end = t.lastIndexOf('}');
      if (start !== -1 && end !== -1 && end > start) {
        try { return JSON.parse(t.slice(start, end + 1)); } catch (e2) { /* fall through */ }
      }
      throw new Error('Could not parse a JSON object from the model output: ' + t.slice(0, 200));
    }
  }

  async function callClaude(promptText) {
    const res = await fetch('/api/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'claude-sonnet-5',
        max_tokens: 1000,
        system: SYSTEM_PROMPT,
        messages: [{ role: 'user', content: promptText }],
      }),
    });
    const json = await res.json();
    if (!res.ok || json.type === 'error') {
      throw new Error(json?.error?.message || `HTTP ${res.status}`);
    }
    return json;
  }

  function buildPrompt(tenant, data, history, correction) {
    let text = `Run a full compliance audit for tenant ${tenant} (${data.label}) ahead of their lease review. Investigate all three vectors and propose appropriate action(s).\n\n`;
    if (history.length === 0) {
      text += 'No data has been gathered yet — this is the first turn.\n';
    } else {
      text += 'Tool calls made so far, and their results:\n\n';
      history.forEach((h, i) => {
        text += `${i + 1}. ${h.tool}(${JSON.stringify(h.input)})\n   → ${JSON.stringify(h.result)}\n\n`;
      });
    }
    if (correction) text += `\n${correction}\n`;
    text += '\nRespond now with exactly one JSON object as instructed (call_tool or final_answer), reflecting everything gathered so far. Do not repeat a tool call already made above unless you have a specific reason to.';
    return text;
  }

  const runAudit = async () => {
    setIsRunning(true);
    setTrace([]);
    setFinalAnswer(null);
    setError(null);
    setPendingAction(null);

    const data = mockData[tenantCode];
    addTrace({ type: 'user', text: `Audit started for ${tenantCode} (${data.label}).` });

    const history = [];
    let turns = 0;
    let parseRetries = 0;
    let correction = null;
    try {
      while (turns < 12) {
        turns += 1;
        const promptText = buildPrompt(tenantCode, data, history, correction);
        correction = null;
        const t0 = performance.now();
        const response = await callClaude(promptText);
        const dt = Math.round(performance.now() - t0);
        addTrace({ type: 'meta', text: `Claude API round-trip #${turns} — ${dt}ms` });

        const textBlock = (response.content || []).find((b) => b.type === 'text');
        const rawText = textBlock ? textBlock.text : '';

        let parsed;
        try {
          parsed = extractJson(rawText);
        } catch (e) {
          parseRetries += 1;
          if (parseRetries > 2) throw new Error('Model did not return valid JSON after repeated attempts.');
          addTrace({ type: 'meta', text: `Response was not valid JSON (attempt ${parseRetries}) — retrying.` });
          correction = 'Your last response was not a valid single JSON object. Respond with exactly one JSON object as instructed, and nothing else.';
          continue;
        }

        if (parsed.reasoning) addTrace({ type: 'reasoning', text: parsed.reasoning });

        if (parsed.action === 'call_tool') {
          addTrace({ type: 'tool_call', name: parsed.tool, input: parsed.input || {} });
          let result;
          if (parsed.tool === 'propose_compliance_action') {
            const decision = await waitForApproval({ tenantCode, ...(parsed.input || {}) });
            result = decision.approved
              ? { status: 'approved_and_filed', reference: `REF-${Math.floor(Math.random() * 90000 + 10000)}`, note: 'Approved by executive reviewer and filed in Maximo.' }
              : { status: 'rejected', note: 'Rejected by executive reviewer. Provide an alternative recommendation or stand down.' };
          } else {
            result = executeTool(parsed.tool, parsed.input || {}, data);
          }
          addTrace({ type: 'tool_result', name: parsed.tool, result });
          history.push({ tool: parsed.tool, input: parsed.input || {}, result });
          continue;
        }

        if (parsed.action === 'final_answer') {
          setFinalAnswer(parsed.content || '(No content returned.)');
          break;
        }

        addTrace({ type: 'meta', text: `Unrecognized response shape from model: ${JSON.stringify(parsed).slice(0, 200)}` });
        break;
      }
    } catch (e) {
      setError(`${e.message || 'Unknown error calling Claude.'} (failed on round-trip #${turns})`);
    }
    setIsRunning(false);
  };

  const data = mockData[tenantCode];

  return (
    <div style={{ backgroundColor: COLORS.abyss, color: '#f1f5f9', fontFamily: FONT_SANS, minHeight: '100vh', position: 'relative' }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@400;500;600;700&family=IBM+Plex+Mono:wght@400;500;600;700&display=swap');
        @keyframes pulseDot { 0%,100% { opacity:1;} 50% { opacity:0.35;} }
        .pulse-dot { animation: pulseDot 1.4s ease-in-out infinite; }
        #trace-scroll::-webkit-scrollbar { width: 6px; }
        #trace-scroll::-webkit-scrollbar-thumb { background: #1E293B; border-radius: 3px; }
        #trace-scroll::-webkit-scrollbar-track { background: transparent; }
      `}</style>

      <div style={{ maxWidth: 900, margin: '0 auto', padding: '24px 20px 60px' }}>

        {/* HEADER */}
        <div className="flex items-center gap-2" style={{ marginBottom: 6 }}>
          <Zap size={16} color={COLORS.signal} />
          <p style={{ fontFamily: FONT_MONO, fontSize: 10, letterSpacing: '0.15em', color: COLORS.signal, textTransform: 'uppercase', margin: 0 }}>
            Live Claude tool-use — nothing below is pre-scripted
          </p>
        </div>
        <h1 style={{ fontSize: 22, fontWeight: 600, color: '#fff', margin: 0 }}>Agentic Lease Compliance Auditor</h1>
        <p style={{ fontSize: 13, color: COLORS.mist, marginTop: 6, lineHeight: 1.6 }}>
          Claude decides which Maximo/lease/throughput tools to call, reasons over the actual numbers returned, and only proposes a financial or legal
          action after gathering evidence — which then requires your approval before it's "filed." Edit the inputs below and re-run to prove it's live reasoning, not a script.
        </p>

        {/* DATA SOURCE */}
        <div style={{ ...cardStyle, borderRadius: 12, padding: 18, marginTop: 20 }}>
          <p style={{ fontSize: 13, fontWeight: 600, color: '#fff', margin: '0 0 4px' }}>Data Source</p>
          <p style={{ fontSize: 11, color: COLORS.mist, marginBottom: 12, lineHeight: 1.6 }}>
            No live Maximo connection in this environment — upload an Excel export instead. The tools below read from this data exactly as they would from a real Maximo/lease/TOS integration.
          </p>
          <div className="flex items-center gap-2 flex-wrap" style={{ marginBottom: 10 }}>
            <button
              onClick={downloadTemplate}
              disabled={isRunning}
              className="flex items-center gap-1.5"
              style={{ backgroundColor: 'rgba(30,41,59,0.7)', border: `1px solid ${COLORS.steel}`, color: '#e2e8f0', fontSize: 11, fontWeight: 500, padding: '8px 12px', borderRadius: 8, cursor: isRunning ? 'not-allowed' : 'pointer', opacity: isRunning ? 0.5 : 1 }}
            >
              <FileDown size={13} /> Download Template (.xlsx)
            </button>
            <label
              className="flex items-center gap-1.5"
              style={{ backgroundColor: COLORS.signal, color: COLORS.abyss, fontSize: 11, fontWeight: 600, padding: '8px 12px', borderRadius: 8, cursor: isRunning ? 'not-allowed' : 'pointer', opacity: isRunning ? 0.5 : 1 }}
            >
              <Upload size={13} /> Upload Excel Data
              <input type="file" accept=".xlsx,.xls" onChange={handleFileUpload} disabled={isRunning} style={{ display: 'none' }} />
            </label>
            {uploadedFileName && (
              <button
                onClick={restoreDemoData}
                disabled={isRunning}
                className="flex items-center gap-1.5"
                style={{ background: 'none', border: `1px solid ${COLORS.steel}`, color: COLORS.mist, fontSize: 11, fontWeight: 500, padding: '8px 12px', borderRadius: 8, cursor: isRunning ? 'not-allowed' : 'pointer' }}
              >
                <RefreshCcw size={12} /> Restore Demo Data
              </button>
            )}
          </div>
          <p style={{ fontSize: 11, color: uploadedFileName ? COLORS.starboard : COLORS.mist, margin: 0 }}>
            {uploadedFileName
              ? `✓ Using ${Object.keys(mockData).length} tenant(s) from "${uploadedFileName}"`
              : `Using built-in demo data (${Object.keys(mockData).length} tenants) — upload your own to replace it`}
          </p>
          {uploadError && (
            <div style={{ backgroundColor: 'rgba(239,68,68,0.1)', border: `1px solid rgba(239,68,68,0.4)`, borderRadius: 8, padding: 10, marginTop: 10 }}>
              <p style={{ fontSize: 11, color: COLORS.portmark, margin: 0, lineHeight: 1.6 }}>{uploadError}</p>
            </div>
          )}
          <details style={{ marginTop: 10 }}>
            <summary style={{ fontSize: 11, color: COLORS.signal, cursor: 'pointer' }}>Expected file format</summary>
            <div style={{ fontSize: 10, color: COLORS.mist, marginTop: 8, lineHeight: 1.8, fontFamily: FONT_MONO }}>
              <strong style={{ color: '#cbd5e1' }}>Tenants</strong> sheet (required, one row per tenant): tenant_code, tenant_name, health_score, deferred_maintenance_cost_usd, handback_allowance_usd, last_inspection, reported_throughput, verified_throughput, contracted_throughput, royalty_rate_per_unit, unit<br /><br />
              <strong style={{ color: '#cbd5e1' }}>WorkOrders</strong> sheet (optional, one row per work order): tenant_code, id, description, est_cost_usd<br /><br />
              <strong style={{ color: '#cbd5e1' }}>EnvironmentalFlags</strong> sheet (optional, one row per incident): tenant_code, flag
            </div>
          </details>
        </div>

        {/* TENANT SELECT */}
        <div className="flex gap-2 flex-wrap" style={{ marginTop: 20, marginBottom: 16 }}>
          {Object.keys(mockData).map((code) => (
            <button
              key={code}
              disabled={isRunning}
              onClick={() => { setTenantCode(code); setTrace([]); setFinalAnswer(null); setError(null); setPendingAction(null); }}
              style={{
                fontFamily: FONT_MONO, fontSize: 12, fontWeight: 600, padding: '8px 14px', borderRadius: 8, cursor: isRunning ? 'not-allowed' : 'pointer',
                backgroundColor: tenantCode === code ? COLORS.signal : 'rgba(30,41,59,0.7)',
                color: tenantCode === code ? COLORS.abyss : '#e2e8f0',
                border: `1px solid ${tenantCode === code ? COLORS.signal : COLORS.steel}`,
                opacity: isRunning ? 0.5 : 1,
              }}
            >
              {code}
            </button>
          ))}
        </div>

        {/* EDITABLE MOCK INPUTS */}
        <div style={{ ...cardStyle, borderRadius: 12, padding: 18, marginBottom: 20 }}>
          <div className="flex items-center justify-between" style={{ marginBottom: 12 }}>
            <p style={{ fontSize: 13, fontWeight: 600, color: '#fff', margin: 0 }}>{data.label} — Maximo/Lease Inputs (editable)</p>
            <button onClick={resetInputs} disabled={isRunning} style={{ background: 'none', border: 'none', color: COLORS.mist, cursor: isRunning ? 'not-allowed' : 'pointer', fontSize: 11, display: 'flex', alignItems: 'center', gap: 4 }}>
              <RefreshCcw size={12} /> Reset
            </button>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {[
              { field: 'healthScore', label: 'Maximo Health Score' },
              { field: 'deferredMaintenanceCostUsd', label: 'Deferred Maintenance ($)' },
              { field: 'handbackAllowanceUsd', label: 'Handback Allowance ($)' },
              { field: 'reportedThroughput', label: `Reported Throughput (${data.unit})` },
              { field: 'verifiedThroughput', label: `AI-Verified Throughput (${data.unit})` },
            ].map(({ field, label }) => (
              <label key={field} style={{ display: 'block' }}>
                <span style={{ fontFamily: FONT_MONO, fontSize: 9, textTransform: 'uppercase', color: COLORS.mist }}>{label}</span>
                <input
                  type="number"
                  disabled={isRunning}
                  value={data[field]}
                  onChange={(e) => updateMockField(field, Number(e.target.value))}
                  style={{
                    display: 'block', width: '100%', marginTop: 4, fontFamily: FONT_MONO, fontSize: 13,
                    backgroundColor: 'rgba(10,15,29,0.7)', border: `1px solid ${COLORS.steel}`, borderRadius: 6,
                    padding: '6px 8px', color: '#fff',
                  }}
                />
              </label>
            ))}
          </div>
        </div>

        {/* RUN BUTTON */}
        <button
          onClick={runAudit}
          disabled={isRunning}
          className="w-full flex items-center justify-center gap-2"
          style={{
            background: isRunning ? 'rgba(34,211,238,0.3)' : `linear-gradient(90deg, ${COLORS.signal}, #0891b2)`,
            border: 'none', color: COLORS.abyss, fontSize: 13, fontWeight: 600, padding: '13px 0', borderRadius: 10,
            cursor: isRunning ? 'not-allowed' : 'pointer', marginBottom: 20,
          }}
        >
          {isRunning ? <><Cpu size={16} className="pulse-dot" /> Claude is reasoning…</> : <><Play size={16} /> Run Agentic Audit</>}
        </button>

        {error && (
          <div style={{ backgroundColor: 'rgba(239,68,68,0.1)', border: `1px solid rgba(239,68,68,0.4)`, borderRadius: 10, padding: 14, marginBottom: 20 }}>
            <div className="flex items-center gap-2">
              <AlertTriangle size={14} color={COLORS.portmark} />
              <p style={{ fontSize: 12, fontWeight: 600, color: COLORS.portmark, margin: 0 }}>API Error</p>
            </div>
            <p style={{ fontSize: 12, color: COLORS.mist, marginTop: 6 }}>{error}</p>
          </div>
        )}

        {/* TRACE */}
        {trace.length > 0 && (
          <div style={{ ...cardStyle, borderRadius: 12, padding: 18, marginBottom: 20 }}>
            <p style={{ fontSize: 13, fontWeight: 600, color: '#fff', margin: '0 0 12px' }}>Live Agent Trace</p>
            <div id="trace-scroll" ref={traceScrollRef} className="space-y-3" style={{ maxHeight: 480, overflowY: 'auto', paddingRight: 4 }}>
              {trace.map((item) => {
                if (item.type === 'user') {
                  return (
                    <div key={item.id} style={{ fontSize: 12, color: '#cbd5e1', backgroundColor: 'rgba(10,15,29,0.6)', border: `1px solid ${COLORS.steel}`, borderRadius: 8, padding: 10 }}>
                      <span style={{ fontFamily: FONT_MONO, fontSize: 10, color: COLORS.mist, textTransform: 'uppercase' }}>Task → </span>{item.text}
                    </div>
                  );
                }
                if (item.type === 'meta') {
                  return (
                    <div key={item.id} className="flex items-center gap-2" style={{ fontSize: 10, color: COLORS.mist, fontFamily: FONT_MONO }}>
                      <Clock size={11} /> {item.text}
                    </div>
                  );
                }
                if (item.type === 'reasoning') {
                  return (
                    <div key={item.id} style={{ fontSize: 12, color: '#e2e8f0', lineHeight: 1.6, borderLeft: `2px solid ${COLORS.agent}`, paddingLeft: 10 }}>
                      <span style={{ fontFamily: FONT_MONO, fontSize: 10, color: COLORS.agent, fontWeight: 600 }}>CLAUDE: </span>{item.text}
                    </div>
                  );
                }
                if (item.type === 'tool_call') {
                  const meta = TOOL_META[item.name] || { Icon: Database, color: COLORS.signal };
                  const Icon = meta.Icon;
                  return (
                    <div key={item.id} style={{ backgroundColor: 'rgba(10,15,29,0.6)', border: `1px solid ${meta.color}40`, borderRadius: 8, padding: 10 }}>
                      <div className="flex items-center gap-2" style={{ marginBottom: 4 }}>
                        <Icon size={13} color={meta.color} />
                        <span style={{ fontFamily: FONT_MONO, fontSize: 11, fontWeight: 600, color: meta.color }}>TOOL CALL: {item.name}</span>
                      </div>
                      <pre style={{ fontFamily: FONT_MONO, fontSize: 10, color: COLORS.mist, margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                        {JSON.stringify(item.input, null, 2)}
                      </pre>
                    </div>
                  );
                }
                if (item.type === 'tool_result') {
                  return (
                    <div key={item.id} style={{ backgroundColor: 'rgba(10,15,29,0.6)', border: `1px solid rgba(34,197,94,0.3)`, borderRadius: 8, padding: 10 }}>
                      <div className="flex items-center gap-2" style={{ marginBottom: 4 }}>
                        <CheckCircle size={13} color={COLORS.starboard} />
                        <span style={{ fontFamily: FONT_MONO, fontSize: 11, fontWeight: 600, color: COLORS.starboard }}>TOOL RESULT: {item.name}</span>
                      </div>
                      <pre style={{ fontFamily: FONT_MONO, fontSize: 10, color: COLORS.mist, margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                        {JSON.stringify(item.result, null, 2)}
                      </pre>
                    </div>
                  );
                }
                return null;
              })}
            </div>
          </div>
        )}

        {/* PENDING APPROVAL */}
        {pendingAction && (
          <div style={{ ...cardStyle, borderColor: 'rgba(245,158,11,0.5)', borderRadius: 12, padding: 18, marginBottom: 20 }}>
            <div className="flex items-center gap-2" style={{ marginBottom: 10 }}>
              <ShieldAlert size={16} color={COLORS.caution} />
              <p style={{ fontSize: 13, fontWeight: 600, color: '#fff', margin: 0 }}>Claude is requesting approval to act</p>
            </div>
            <p style={{ fontFamily: FONT_MONO, fontSize: 12, color: '#fff', margin: 0 }}>{pendingAction.action_type}{pendingAction.amount_usd ? ` — $${pendingAction.amount_usd.toLocaleString()}` : ''}</p>
            <p style={{ fontSize: 12, color: COLORS.mist, marginTop: 8, lineHeight: 1.6 }}>{pendingAction.justification}</p>
            <div className="flex gap-2" style={{ marginTop: 14 }}>
              <button onClick={handleReject} className="flex items-center gap-1.5" style={{ border: `1px solid ${COLORS.steel}`, backgroundColor: 'transparent', color: COLORS.mist, fontSize: 12, fontWeight: 500, padding: '8px 14px', borderRadius: 6, cursor: 'pointer' }}>
                <XCircle size={13} /> Reject
              </button>
              <button onClick={handleApprove} className="flex items-center gap-1.5" style={{ border: 'none', backgroundColor: COLORS.starboard, color: '#062010', fontSize: 12, fontWeight: 600, padding: '8px 14px', borderRadius: 6, cursor: 'pointer' }}>
                <CheckCircle size={13} /> Approve
              </button>
            </div>
          </div>
        )}

        {/* FINAL ANSWER */}
        {finalAnswer && (
          <div style={{ ...cardStyle, borderColor: 'rgba(34,211,238,0.4)', borderRadius: 12, padding: 18, marginBottom: 20 }}>
            <p style={{ fontSize: 13, fontWeight: 600, color: COLORS.signal, margin: '0 0 8px' }}>Claude's Final Recommendation</p>
            <p style={{ fontSize: 13, color: '#e2e8f0', lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>{finalAnswer}</p>
          </div>
        )}

        {/* HOW THIS EXTENDS TO PRODUCTION */}
        <div style={{ borderTop: `1px solid ${COLORS.steel}`, paddingTop: 16, marginTop: 8 }}>
          <p style={{ fontSize: 11, color: COLORS.mist, lineHeight: 1.7 }}>
            <strong style={{ color: '#cbd5e1' }}>A note on how this is wired:</strong> this sandbox blocks the native Anthropic <code style={{ fontFamily: FONT_MONO }}>tools</code> (function-calling) request field, so Claude can't emit structured <code style={{ fontFamily: FONT_MONO }}>tool_use</code> blocks here. Instead, each turn Claude returns a small JSON object (<code style={{ fontFamily: FONT_MONO }}>call_tool</code> or <code style={{ fontFamily: FONT_MONO }}>final_answer</code>) that this code parses and acts on — same agentic behavior (Claude still decides what to look up, when it has enough evidence, and whether to act), just driven by plain-text turns instead of the native tool-calling API. In a real deployment with API access, this becomes native function-calling against the same 5 tool definitions, each backed by a real Maximo/TOS/document-store call instead of the mock JSON in this file, with the approval gate unchanged.
          </p>
        </div>
      </div>
    </div>
  );
}
