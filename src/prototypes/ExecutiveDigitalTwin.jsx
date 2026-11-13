import React, { useState, useRef, useMemo, useCallback, useEffect } from 'react';
import * as XLSX from 'xlsx';
import {
  Ship, Anchor, Boxes, ClipboardCheck, DollarSign, Wrench, HardHat, Users,
  AlertTriangle, CloudRain, Upload, CheckCircle2, Loader2, Send, Sparkles,
  MessageSquare, ChevronRight, ChevronDown, Info, TrendingUp, TrendingDown,
  RefreshCw, X, Gauge, FileSpreadsheet, ArrowUpRight, ArrowDownRight, Radio,
  Newspaper, Globe2, Copy, Check, CalendarDays
} from 'lucide-react';

/* ============================== helpers ============================== */

function pick(row, keys) {
  if (!row) return undefined;
  for (const k of keys) {
    if (row[k] !== undefined && row[k] !== '') return row[k];
  }
  const rowKeys = Object.keys(row);
  for (const k of keys) {
    const found = rowKeys.find((rk) => rk.trim().toLowerCase() === k.trim().toLowerCase());
    if (found && row[found] !== undefined && row[found] !== '') return row[found];
  }
  return undefined;
}
function num(v) {
  if (v === undefined || v === null || v === '') return 0;
  const n = parseFloat(String(v).replace(/[,%]/g, ''));
  return isNaN(n) ? 0 : n;
}
function truthy(v) {
  if (v === undefined || v === null) return false;
  const s = String(v).trim().toLowerCase();
  return s !== '' && s !== 'no' && s !== 'none' && s !== '0' && s !== 'false';
}
function avg(arr) { return arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0; }
function sum(arr) { return arr.reduce((a, b) => a + b, 0); }
function round(v) { return Math.round(v || 0); }
function clampScore(v) { return Math.max(0, Math.min(100, Math.round(v))); }
function findSheet(sheets, hints) {
  if (!sheets) return [];
  const names = Object.keys(sheets);
  for (const hint of hints) {
    const found = names.find((n) => n.toLowerCase().includes(hint.toLowerCase()));
    if (found) return sheets[found];
  }
  return [];
}
function fmtMoney(v) {
  const n = Math.round(v || 0);
  return '$' + n.toLocaleString('en-US');
}
function isPastDate(v) {
  if (!v) return false;
  const d = new Date(v);
  if (isNaN(d.getTime())) return false;
  return d.getTime() < Date.now();
}
function isWithinDays(v, days) {
  if (!v) return false;
  const d = new Date(v);
  if (isNaN(d.getTime())) return false;
  const now = Date.now();
  const target = now + days * 86400000;
  return d.getTime() <= target;
}

/* ============================== domain summarizers ============================== */

function summarizePCS(sheets) {
  const vessels = findSheet(sheets, ['vessel call', 'vessel']);
  const cargo = findSheet(sheets, ['cargo summary', 'cargo']);
  const docs = findSheet(sheets, ['trade document', 'document']);
  if (!vessels.length && !cargo.length && !docs.length) return null;

  const delayRows = vessels.map((v) => ({
    name: pick(v, ['Vessel Name', 'Vessel']) || 'Unnamed vessel',
    delay: num(pick(v, ['Delay (Minutes)', 'Delay'])),
  }));
  const delayed = delayRows.filter((r) => r.delay > 0);
  const avgDelay = round(avg(delayed.map((d) => d.delay)));
  const topDelayed = [...delayed].sort((a, b) => b.delay - a.delay).slice(0, 3);

  const importTEU = sum(cargo.map((c) => num(pick(c, ['Import TEU']))));
  const exportTEU = sum(cargo.map((c) => num(pick(c, ['Export TEU']))));
  const transTEU = sum(cargo.map((c) => num(pick(c, ['Transshipment TEU']))));
  const hazardous = sum(cargo.map((c) => num(pick(c, ['Hazardous Cargo']))));

  const missingDocs = docs.filter((d) => truthy(pick(d, ['Missing Documents']))).length;
  const inspectionReq = docs.filter((d) => truthy(pick(d, ['Inspection Required']))).length;

  const score = clampScore(100 - (delayed.length / (vessels.length || 1)) * 55 - missingDocs * 6 - inspectionReq * 2);

  const flags = [];
  if (delayed.length > 0) {
    flags.push({
      type: 'risk', severity: avgDelay > 120 ? 3 : 2,
      text: `${delayed.length} of ${vessels.length} vessel calls delayed, averaging ${avgDelay} min. Top: ${topDelayed.map((d) => d.name).join(', ') || '—'}.`,
    });
  }
  if (missingDocs > 0) {
    flags.push({ type: 'risk', severity: 2, text: `${missingDocs} vessel call(s) held up by missing trade documentation.` });
  }
  if (delayed.length === 0 && vessels.length > 0) {
    flags.push({ type: 'opportunity', severity: 1, text: `All ${vessels.length} vessel calls tracking on schedule — a clean window to accept additional traffic.` });
  }
  if (importTEU + exportTEU + transTEU > 0 && missingDocs === 0) {
    flags.push({ type: 'opportunity', severity: 1, text: `Trade documentation fully clear across ${docs.length} shipment record(s) — no clearance bottleneck.` });
  }

  return {
    headline: delayed.length > 0 ? `${delayed.length} vessel(s) delayed, avg ${avgDelay} min` : `${vessels.length} vessel calls, all on schedule`,
    score,
    metrics: [
      { label: 'Vessel Calls', value: vessels.length },
      { label: 'Delayed', value: delayed.length },
      { label: 'Total TEU', value: round(importTEU + exportTEU + transTEU).toLocaleString() },
      { label: 'Missing Docs', value: missingDocs },
    ],
    flags,
  };
}

function summarizeHarbour(sheets) {
  const berths = findSheet(sheets, ['berth utilisation', 'berth utilization', 'berth']);
  const marine = findSheet(sheets, ['marine services', 'marine']);
  const anchorage = findSheet(sheets, ['anchorage queue', 'anchorage']);
  if (!berths.length && !marine.length && !anchorage.length) return null;

  const occ = berths.map((b) => num(pick(b, ['Occupancy %', 'Occupancy'])));
  const avgOcc = round(avg(occ));
  const overUtilised = berths.filter((b) => num(pick(b, ['Occupancy %', 'Occupancy'])) > 90);
  const avgWait = round(avg(anchorage.map((a) => num(pick(a, ['Waiting Time'])))));

  const score = clampScore(100 - overUtilised.length * 10 - Math.min(30, anchorage.length * 6));

  const flags = [];
  if (overUtilised.length > 0) {
    flags.push({
      type: 'risk', severity: overUtilised.length > 2 ? 3 : 2,
      text: `${overUtilised.length} berth(s) running over 90% occupancy: ${overUtilised.map((b) => pick(b, ['Berth'])).join(', ')}.`,
    });
  }
  if (anchorage.length > 0) {
    flags.push({ type: 'risk', severity: avgWait > 180 ? 3 : 2, text: `${anchorage.length} vessel(s) queuing at anchorage, averaging ${avgWait} min wait.` });
  }
  if (avgOcc > 0 && avgOcc < 60) {
    flags.push({ type: 'opportunity', severity: 1, text: `Berth utilisation averaging just ${avgOcc}% — spare capacity to accommodate additional calls.` });
  }

  return {
    headline: overUtilised.length > 0 ? `${overUtilised.length} berth(s) over-utilised` : `Berths averaging ${avgOcc}% occupancy`,
    score,
    metrics: [
      { label: 'Avg Berth Occupancy', value: avgOcc + '%' },
      { label: 'Over-utilised Berths', value: overUtilised.length },
      { label: 'Anchorage Queue', value: anchorage.length },
    ],
    flags,
  };
}

function summarizeTerminal(sheets) {
  const yard = findSheet(sheets, ['yard operations', 'yard']);
  const crane = findSheet(sheets, ['crane productivity', 'crane']);
  const gate = findSheet(sheets, ['gate operations', 'gate']);
  if (!yard.length && !crane.length && !gate.length) return null;

  const yardOcc = avg(yard.map((y) => num(pick(y, ['Yard Occupancy']))));
  const craneDowntime = avg(crane.map((c) => num(pick(c, ['Downtime']))));
  const craneMoves = avg(crane.map((c) => num(pick(c, ['Moves per Hour']))));
  const gateTurnaround = avg(gate.map((g) => num(pick(g, ['Average Turnaround Time']))));
  const gateQueue = avg(gate.map((g) => num(pick(g, ['Gate Queue Length']))));

  const score = clampScore(100 - Math.max(0, yardOcc - 80) * 1.5 - craneDowntime * 2 - Math.max(0, gateQueue - 10) * 2);

  const flags = [];
  if (yardOcc > 85) flags.push({ type: 'risk', severity: 2, text: `Yard occupancy averaging ${round(yardOcc)}% — congestion building.` });
  if (craneDowntime > 10) flags.push({ type: 'risk', severity: 2, text: `Crane downtime averaging ${round(craneDowntime)}% — productivity at risk.` });
  if (gateQueue > 15) flags.push({ type: 'risk', severity: 2, text: `Gate queue averaging ${round(gateQueue)} trucks — turnaround delays likely.` });
  if (yardOcc > 0 && yardOcc < 60) flags.push({ type: 'opportunity', severity: 1, text: `Yard occupancy at ${round(yardOcc)}% — headroom for additional throughput.` });

  return {
    headline: craneDowntime > 10 ? `Crane downtime at ${round(craneDowntime)}%` : `Terminal running at ${round(yardOcc)}% yard occupancy`,
    score,
    metrics: [
      { label: 'Yard Occupancy', value: round(yardOcc) + '%' },
      { label: 'Crane Moves/hr', value: round(craneMoves) },
      { label: 'Gate Turnaround', value: round(gateTurnaround) + ' min' },
      { label: 'Gate Queue', value: round(gateQueue) },
    ],
    flags,
  };
}

function summarizeCustoms(sheets) {
  const clearance = findSheet(sheets, ['customs clearance', 'clearance']);
  const inspections = findSheet(sheets, ['inspections', 'inspection']);
  if (!clearance.length && !inspections.length) return null;

  const highRisk = clearance.filter((c) => String(pick(c, ['Risk Category'])).toLowerCase().includes('high'));
  const avgClear = avg(clearance.map((c) => num(pick(c, ['Clearance Time']))));
  const delayedInsp = inspections.filter((i) => num(pick(i, ['Delayed'])) > 0);
  const pendingInsp = sum(inspections.map((i) => num(pick(i, ['Pending']))));

  const score = clampScore(100 - highRisk.length * 4 - delayedInsp.length * 8 - Math.min(20, pendingInsp));

  const flags = [];
  if (highRisk.length > 0) flags.push({ type: 'risk', severity: 2, text: `${highRisk.length} declaration(s) flagged high-risk for customs review.` });
  if (delayedInsp.length > 0) flags.push({ type: 'risk', severity: 2, text: `${delayedInsp.length} agency/agencies reporting inspection delays.` });
  if (pendingInsp > 20) flags.push({ type: 'risk', severity: 2, text: `Inspection backlog of ${round(pendingInsp)} pending items.` });
  if (highRisk.length === 0 && delayedInsp.length === 0 && clearance.length > 0) {
    flags.push({ type: 'opportunity', severity: 1, text: `No high-risk declarations or inspection delays — clearance pipeline is clean.` });
  }

  return {
    headline: highRisk.length > 0 ? `${highRisk.length} high-risk declaration(s)` : `${clearance.length} declarations processing cleanly`,
    score,
    metrics: [
      { label: 'Declarations', value: clearance.length },
      { label: 'High Risk', value: highRisk.length },
      { label: 'Avg Clearance Time', value: round(avgClear) + ' hrs' },
      { label: 'Pending Inspections', value: round(pendingInsp) },
    ],
    flags,
  };
}

function summarizeFinance(sheets) {
  const revenue = findSheet(sheets, ['revenue']);
  const receivables = findSheet(sheets, ['receivables']);
  const budget = findSheet(sheets, ['budget vs actual', 'budget']);
  if (!revenue.length && !receivables.length && !budget.length) return null;

  const revenueCats = ['Marine Dues', 'Port Charges', 'Storage Revenue', 'Utility Revenue', 'Concession Revenue', 'Other Revenue'];
  const totalRevenue = sum(revenue.flatMap((r) => revenueCats.map((c) => num(pick(r, [c])))));
  const outstandingTotal = sum(receivables.map((r) => num(pick(r, ['Outstanding Amount']))));
  const highRiskRecv = receivables.filter((r) => String(pick(r, ['Risk Rating'])).toLowerCase().includes('high'));
  const negativeVariance = budget.filter((b) => num(pick(b, ['Variance'])) < 0);
  const worstVariance = [...budget].sort((a, b) => num(pick(a, ['Variance'])) - num(pick(b, ['Variance']))).slice(0, 3);

  const score = clampScore(100 - highRiskRecv.length * 6 - negativeVariance.length * 5);

  const flags = [];
  if (highRiskRecv.length > 0) {
    flags.push({ type: 'risk', severity: 2, text: `${highRiskRecv.length} customer(s) carrying high-risk outstanding balances totaling ${fmtMoney(sum(highRiskRecv.map((r) => num(pick(r, ['Outstanding Amount'])))))}.` });
  }
  if (negativeVariance.length > 0) {
    flags.push({ type: 'risk', severity: 2, text: `${negativeVariance.length} business unit(s) running budget deficits — worst: ${worstVariance.map((b) => pick(b, ['Business Unit'])).join(', ')}.` });
  }
  if (negativeVariance.length === 0 && budget.length > 0) {
    flags.push({ type: 'opportunity', severity: 1, text: `All tracked business units are within or above budget this period.` });
  }

  return {
    headline: negativeVariance.length > 0 ? `${negativeVariance.length} unit(s) over budget` : `Revenue ${fmtMoney(totalRevenue)}, budget on track`,
    score,
    metrics: [
      { label: 'Total Revenue', value: fmtMoney(totalRevenue) },
      { label: 'Outstanding', value: fmtMoney(outstandingTotal) },
      { label: 'High-Risk Receivables', value: highRiskRecv.length },
      { label: 'Units Over Budget', value: negativeVariance.length },
    ],
    flags,
  };
}

function summarizeAsset(sheets) {
  const register = findSheet(sheets, ['asset register', 'register']);
  const maintenance = findSheet(sheets, ['maintenance']);
  const performance = findSheet(sheets, ['asset performance', 'performance']);
  if (!register.length && !maintenance.length && !performance.length) return null;

  const lowHealth = register.filter((a) => num(pick(a, ['Current Health Score'])) < 50 && pick(a, ['Current Health Score']) !== undefined);
  const overdueMaint = maintenance.filter((m) => isPastDate(pick(m, ['Next Maintenance'])));
  const avgAvail = avg(performance.map((p) => num(pick(p, ['Availability']))));

  const score = clampScore(100 - lowHealth.length * 7 - overdueMaint.length * 5);

  const flags = [];
  if (lowHealth.length > 0) {
    flags.push({ type: 'risk', severity: lowHealth.length > 3 ? 3 : 2, text: `${lowHealth.length} asset(s) below a health score of 50 — candidates for replacement: ${lowHealth.slice(0, 3).map((a) => pick(a, ['Asset Name'])).join(', ')}.` });
  }
  if (overdueMaint.length > 0) {
    flags.push({ type: 'risk', severity: 2, text: `${overdueMaint.length} maintenance work order(s) overdue.` });
  }
  if (lowHealth.length === 0 && register.length > 0) {
    flags.push({ type: 'opportunity', severity: 1, text: `Asset fleet health is strong across ${register.length} tracked assets — no near-term capex pressure.` });
  }

  return {
    headline: lowHealth.length > 0 ? `${lowHealth.length} asset(s) below health threshold` : `Asset base healthy across ${register.length} assets`,
    score,
    metrics: [
      { label: 'Assets Tracked', value: register.length },
      { label: 'Low Health (<50)', value: lowHealth.length },
      { label: 'Overdue Maintenance', value: overdueMaint.length },
      { label: 'Avg Availability', value: round(avgAvail) + '%' },
    ],
    flags,
  };
}

function summarizeHSE(sheets) {
  const incidents = findSheet(sheets, ['safety incidents', 'incidents']);
  const nearMiss = findSheet(sheets, ['near misses', 'near miss']);
  const environmental = findSheet(sheets, ['environmental']);
  const permits = findSheet(sheets, ['permit to work', 'permit']);
  if (!incidents.length && !nearMiss.length && !environmental.length && !permits.length) return null;

  const openIncidents = incidents.filter((i) => !String(pick(i, ['Status'])).toLowerCase().includes('closed'));
  const highSeverity = incidents.filter((i) => /high|critical/i.test(String(pick(i, ['Severity']))));
  const highRiskNM = nearMiss.filter((n) => /high/i.test(String(pick(n, ['Risk Rating']))));
  const expiringPermits = permits.filter((p) => isWithinDays(pick(p, ['Expiry']), 7));

  const score = clampScore(100 - highSeverity.length * 15 - openIncidents.length * 5 - highRiskNM.length * 4 - expiringPermits.length * 3);

  const flags = [];
  if (highSeverity.length > 0) flags.push({ type: 'risk', severity: 3, text: `${highSeverity.length} high/critical severity safety incident(s) recorded.` });
  if (openIncidents.length > 0) flags.push({ type: 'risk', severity: 2, text: `${openIncidents.length} safety incident(s) still open.` });
  if (highRiskNM.length > 0) flags.push({ type: 'risk', severity: 2, text: `${highRiskNM.length} near-miss report(s) rated high risk.` });
  if (expiringPermits.length > 0) flags.push({ type: 'risk', severity: 1, text: `${expiringPermits.length} permit(s) to work expiring within 7 days.` });
  if (highSeverity.length === 0 && openIncidents.length === 0) flags.push({ type: 'opportunity', severity: 1, text: `No open high-severity safety incidents — HSE posture is stable.` });

  return {
    headline: highSeverity.length > 0 ? `${highSeverity.length} high-severity incident(s)` : `No open high-severity incidents`,
    score,
    metrics: [
      { label: 'Open Incidents', value: openIncidents.length },
      { label: 'High Severity', value: highSeverity.length },
      { label: 'High-Risk Near Misses', value: highRiskNM.length },
      { label: 'Permits Expiring', value: expiringPermits.length },
    ],
    flags,
  };
}

function summarizeCustomer(sheets) {
  const complaints = findSheet(sheets, ['complaints']);
  const sla = findSheet(sheets, ['sla performance', 'sla']);
  if (!complaints.length && !sla.length) return null;

  const openComplaints = complaints.filter((c) => !/closed|resolved/i.test(String(pick(c, ['Status']))));
  const highPriority = complaints.filter((c) => /high/i.test(String(pick(c, ['Priority']))));
  const avgCompliance = avg(sla.map((s) => num(pick(s, ['Compliance %']))));
  const breaching = sla.filter((s) => num(pick(s, ['Compliance %'])) < 90 && pick(s, ['Compliance %']) !== undefined);

  const score = clampScore(100 - highPriority.length * 8 - breaching.length * 10);

  const flags = [];
  if (highPriority.length > 0) flags.push({ type: 'risk', severity: 2, text: `${highPriority.length} high-priority complaint(s) still open.` });
  if (breaching.length > 0) flags.push({ type: 'risk', severity: 2, text: `${breaching.length} service(s) breaching SLA — average compliance ${round(avgCompliance)}%.` });
  if (breaching.length === 0 && sla.length > 0) flags.push({ type: 'opportunity', severity: 1, text: `All tracked services are meeting SLA targets.` });

  return {
    headline: breaching.length > 0 ? `${breaching.length} service(s) breaching SLA` : `SLA compliance averaging ${round(avgCompliance)}%`,
    score,
    metrics: [
      { label: 'Open Complaints', value: openComplaints.length },
      { label: 'High Priority', value: highPriority.length },
      { label: 'Avg SLA Compliance', value: round(avgCompliance) + '%' },
      { label: 'Services Breaching', value: breaching.length },
    ],
    flags,
  };
}

function summarizeRisk(sheets) {
  const register = findSheet(sheets, ['risk register']);
  const continuity = findSheet(sheets, ['business continuity', 'continuity']);
  if (!register.length && !continuity.length) return null;

  const criticalRisks = register.filter((r) => /high|critical/i.test(String(pick(r, ['Current Rating']))));
  const notReady = continuity.filter((c) => !/ready/i.test(String(pick(c, ['Current Status']))));

  const score = clampScore(100 - criticalRisks.length * 10 - notReady.length * 8);

  const flags = [];
  if (criticalRisks.length > 0) {
    flags.push({ type: 'risk', severity: 3, text: `${criticalRisks.length} enterprise risk(s) rated high/critical — top: ${criticalRisks.slice(0, 3).map((r) => pick(r, ['Risk'])).join(', ')}.` });
  }
  if (notReady.length > 0) flags.push({ type: 'risk', severity: 2, text: `${notReady.length} business continuity scenario(s) not marked ready.` });
  if (criticalRisks.length === 0 && register.length > 0) flags.push({ type: 'opportunity', severity: 1, text: `No risks currently rated high/critical across the register.` });

  return {
    headline: criticalRisks.length > 0 ? `${criticalRisks.length} high/critical risk(s)` : `Risk register clear of high/critical items`,
    score,
    metrics: [
      { label: 'Risks Tracked', value: register.length },
      { label: 'High/Critical', value: criticalRisks.length },
      { label: 'BC Scenarios Not Ready', value: notReady.length },
    ],
    flags,
  };
}

function summarizeWeather(sheets) {
  const weather = findSheet(sheets, ['weather']);
  const events = findSheet(sheets, ['external events', 'events']);
  if (!weather.length && !events.length) return null;

  const latest = weather[weather.length - 1] || weather[0];
  const eventFields = ['Cyclone', 'Strike', 'Canal Disruption', 'Geopolitical Event', 'Shipping Advisory'];
  const activeEvents = events.filter((e) => eventFields.some((f) => truthy(pick(e, [f]))));

  const score = clampScore(100 - activeEvents.length * 18);

  const flags = [];
  if (activeEvents.length > 0) {
    flags.push({ type: 'risk', severity: activeEvents.length > 1 ? 3 : 2, text: `${activeEvents.length} external disruption event(s) active with potential to affect throughput.` });
  } else if (events.length > 0) {
    flags.push({ type: 'opportunity', severity: 1, text: `No active external disruption events reported.` });
  }

  const metrics = [];
  if (latest) {
    const windSpeed = pick(latest, ['Wind Speed']);
    const visibility = pick(latest, ['Visibility']);
    const wave = pick(latest, ['Wave Height']);
    if (windSpeed !== undefined) metrics.push({ label: 'Wind Speed', value: windSpeed });
    if (visibility !== undefined) metrics.push({ label: 'Visibility', value: visibility });
    if (wave !== undefined) metrics.push({ label: 'Wave Height', value: wave });
  }
  metrics.push({ label: 'Active Disruptions', value: activeEvents.length });

  return {
    headline: activeEvents.length > 0 ? `${activeEvents.length} active external disruption(s)` : `No active weather/external disruptions`,
    score,
    metrics,
    flags,
  };
}

/* ============================== domain config ============================== */

const DOMAINS = [
  { id: 'pcs', label: 'Port Community System', short: 'PCS', icon: Ship, sheetHint: 'Vessel Calls · Cargo Summary · Trade Documents', summarize: summarizePCS },
  { id: 'harbour', label: 'Harbour Master & Marine Ops', short: 'Marine Ops', icon: Anchor, sheetHint: 'Berth Utilisation · Marine Services · Anchorage Queue', summarize: summarizeHarbour },
  { id: 'terminal', label: 'Terminal Operations', short: 'Terminal', icon: Boxes, sheetHint: 'Yard Operations · Crane Productivity · Gate Operations', summarize: summarizeTerminal },
  { id: 'customs', label: 'Customs & Trade Facilitation', short: 'Customs', icon: ClipboardCheck, sheetHint: 'Customs Clearance · Inspections', summarize: summarizeCustoms },
  { id: 'finance', label: 'Finance & Commercial', short: 'Finance', icon: DollarSign, sheetHint: 'Revenue · Receivables · Budget vs Actual', summarize: summarizeFinance },
  { id: 'asset', label: 'Enterprise Asset Management', short: 'Assets', icon: Wrench, sheetHint: 'Asset Register · Maintenance · Asset Performance', summarize: summarizeAsset },
  { id: 'hse', label: 'Health, Safety & Environment', short: 'HSE', icon: HardHat, sheetHint: 'Safety Incidents · Near Misses · Environmental · Permit to Work', summarize: summarizeHSE },
  { id: 'customer', label: 'Customer Experience', short: 'Customer', icon: Users, sheetHint: 'Complaints · SLA Performance', summarize: summarizeCustomer },
  { id: 'risk', label: 'Enterprise Risk', short: 'Risk', icon: AlertTriangle, sheetHint: 'Risk Register · Business Continuity', summarize: summarizeRisk },
  { id: 'weather', label: 'Weather & External Events', short: 'Weather', icon: CloudRain, sheetHint: 'Weather · External Events', summarize: summarizeWeather },
];

/* ============================== sample data ============================== */

function buildSampleData() {
  return {
    pcs: {
      'Vessel Calls': [
        { 'Vessel Name': 'MV Horizon Star', 'IMO Number': '9456123', 'Shipping Line': 'MSC', Agent: 'Gulf Shipping Agency', ETA: '2026-07-30 06:00', ATA: '2026-07-30 08:10', 'Current Status': 'Berthed', 'Delay (Minutes)': 130, 'Assigned Berth': 'Berth 4' },
        { 'Vessel Name': 'MV Delta Pioneer', 'IMO Number': '9788231', 'Shipping Line': 'CMA CGM', Agent: 'Al Nasr Agencies', ETA: '2026-07-30 10:00', ATA: '2026-07-30 10:05', 'Current Status': 'Berthed', 'Delay (Minutes)': 5, 'Assigned Berth': 'Berth 2' },
        { 'Vessel Name': 'MV Crescent Trader', 'IMO Number': '9345671', 'Shipping Line': 'Maersk', Agent: 'Gulf Shipping Agency', ETA: '2026-07-30 14:00', ATA: '', 'Current Status': 'Inbound', 'Delay (Minutes)': 0, 'Assigned Berth': 'Berth 6' },
        { 'Vessel Name': 'MV Amber Wave', 'IMO Number': '9564213', 'Shipping Line': 'Hapag-Lloyd', Agent: 'Falcon Marine', ETA: '2026-07-30 05:00', ATA: '2026-07-30 08:40', 'Current Status': 'Berthed', 'Delay (Minutes)': 220, 'Assigned Berth': 'Berth 1' },
        { 'Vessel Name': 'MV Northern Light', 'IMO Number': '9678845', 'Shipping Line': 'ONE', Agent: 'Al Nasr Agencies', ETA: '2026-07-30 18:00', ATA: '', 'Current Status': 'Anchorage', 'Delay (Minutes)': 0, 'Assigned Berth': '' },
      ],
      'Cargo Summary': [
        { 'Cargo Type': 'Containerised', 'Import TEU': 4200, 'Export TEU': 3100, 'Transshipment TEU': 1800, 'Empty Containers': 640, 'Hazardous Cargo': 3, 'Reefer Containers': 210 },
        { 'Cargo Type': 'Bulk', 'Import TEU': 0, 'Export TEU': 0, 'Transshipment TEU': 0, 'Empty Containers': 0, 'Hazardous Cargo': 0, 'Reefer Containers': 0 },
      ],
      'Trade Documents': [
        { 'Manifest Status': 'Complete', 'Bill of Lading Status': 'Complete', 'Delivery Order Status': 'Pending', 'Missing Documents': 'Certificate of Origin', 'Inspection Required': 'Yes' },
        { 'Manifest Status': 'Complete', 'Bill of Lading Status': 'Complete', 'Delivery Order Status': 'Complete', 'Missing Documents': '', 'Inspection Required': 'No' },
        { 'Manifest Status': 'Pending', 'Bill of Lading Status': 'Complete', 'Delivery Order Status': 'Pending', 'Missing Documents': '', 'Inspection Required': 'No' },
      ],
    },
    harbour: {
      'Berth Utilisation': [
        { Berth: 'Berth 1', 'Occupancy %': 96, 'Vessel Assigned': 'MV Amber Wave', 'Maintenance Window': '' },
        { Berth: 'Berth 2', 'Occupancy %': 72, 'Vessel Assigned': 'MV Delta Pioneer', 'Maintenance Window': '' },
        { Berth: 'Berth 4', 'Occupancy %': 94, 'Vessel Assigned': 'MV Horizon Star', 'Maintenance Window': '' },
        { Berth: 'Berth 6', 'Occupancy %': 40, 'Vessel Assigned': '', 'Maintenance Window': '2026-08-02' },
      ],
      'Marine Services': [
        { 'Pilot Availability': '2 of 4 on duty', 'Tug Availability': '3 of 5 available', 'Channel Availability': 'Open' },
      ],
      'Anchorage Queue': [
        { Vessel: 'MV Northern Light', 'Waiting Time': 210, 'Reason for Delay': 'Berth congestion' },
        { Vessel: 'MV Silver Falcon', 'Waiting Time': 340, 'Reason for Delay': 'Awaiting pilot' },
      ],
    },
    terminal: {
      'Yard Operations': [
        { 'Yard Occupancy': 88, 'Available Capacity': 12, 'Reefer Slots': 180, 'Dangerous Goods Area Utilisation': 55 },
      ],
      'Crane Productivity': [
        { 'Crane ID': 'QC-01', 'Moves per Hour': 28, Downtime: 4, Utilisation: 82 },
        { 'Crane ID': 'QC-02', 'Moves per Hour': 22, Downtime: 18, Utilisation: 61 },
        { 'Crane ID': 'QC-03', 'Moves per Hour': 30, Downtime: 2, Utilisation: 90 },
      ],
      'Gate Operations': [
        { 'Trucks Processed': 640, 'Average Turnaround Time': 34, 'Gate Queue Length': 19, 'Peak Hour Traffic': '07:00–09:00' },
      ],
    },
    customs: {
      'Customs Clearance': [
        { 'Declaration Number': 'DEC-10021', 'Risk Category': 'High', 'Inspection Status': 'In Progress', 'Release Status': 'Held', 'Clearance Time': 26 },
        { 'Declaration Number': 'DEC-10022', 'Risk Category': 'Low', 'Inspection Status': 'Not Required', 'Release Status': 'Released', 'Clearance Time': 4 },
        { 'Declaration Number': 'DEC-10023', 'Risk Category': 'Medium', 'Inspection Status': 'Complete', 'Release Status': 'Released', 'Clearance Time': 9 },
      ],
      Inspections: [
        { Agency: 'Food Safety Authority', 'Inspection Type': 'Physical', Pending: 6, Completed: 14, Delayed: 2 },
        { Agency: 'Customs', 'Inspection Type': 'Document', Pending: 3, Completed: 40, Delayed: 0 },
      ],
    },
    finance: {
      Revenue: [
        { 'Marine Dues': 1250000, 'Port Charges': 2100000, 'Storage Revenue': 480000, 'Utility Revenue': 210000, 'Concession Revenue': 640000, 'Other Revenue': 90000 },
      ],
      Receivables: [
        { Customer: 'Al Waha Logistics', 'Outstanding Amount': 890000, Ageing: '90+ days', 'Risk Rating': 'High' },
        { Customer: 'Continental Freight LLC', 'Outstanding Amount': 210000, Ageing: '30 days', 'Risk Rating': 'Low' },
        { Customer: 'Meridian Shipping Co', 'Outstanding Amount': 460000, Ageing: '60 days', 'Risk Rating': 'Medium' },
      ],
      'Budget vs Actual': [
        { 'Business Unit': 'Terminal Operations', Budget: 5000000, Actual: 5320000, Variance: -320000 },
        { 'Business Unit': 'Marine Services', Budget: 2000000, Actual: 1890000, Variance: 110000 },
        { 'Business Unit': 'Corporate', Budget: 1200000, Actual: 1180000, Variance: 20000 },
      ],
    },
    asset: {
      'Asset Register': [
        { 'Asset ID': 'AST-001', 'Asset Name': 'Quay Crane 2', 'Asset Category': 'Crane', Criticality: 'High', 'Current Health Score': 42, 'Remaining Useful Life': '2 years' },
        { 'Asset ID': 'AST-002', 'Asset Name': 'Yard RTG 7', 'Asset Category': 'RTG', Criticality: 'Medium', 'Current Health Score': 78, 'Remaining Useful Life': '6 years' },
        { 'Asset ID': 'AST-003', 'Asset Name': 'Fender System B1', 'Asset Category': 'Marine Structure', Criticality: 'High', 'Current Health Score': 35, 'Remaining Useful Life': '1 year' },
      ],
      Maintenance: [
        { 'Work Order': 'WO-2201', 'Preventive or Corrective': 'Corrective', Status: 'Open', 'Next Maintenance': '2026-07-10', 'Estimated Cost': 45000 },
        { 'Work Order': 'WO-2202', 'Preventive or Corrective': 'Preventive', Status: 'Scheduled', 'Next Maintenance': '2026-09-01', 'Estimated Cost': 12000 },
      ],
      'Asset Performance': [
        { Availability: 91, MTBF: 420, MTTR: 6, 'Failure Count': 3 },
        { Availability: 76, MTBF: 180, MTTR: 14, 'Failure Count': 7 },
      ],
    },
    hse: {
      'Safety Incidents': [
        { 'Incident ID': 'INC-301', Date: '2026-07-22', Location: 'Terminal 2 Yard', Severity: 'High', 'Injury Classification': 'Lost Time Injury', Status: 'Open' },
        { 'Incident ID': 'INC-302', Date: '2026-07-25', Location: 'Berth 1', Severity: 'Low', 'Injury Classification': 'First Aid', Status: 'Closed' },
      ],
      'Near Misses': [
        { Area: 'Container Yard Block C', Description: 'Reach stacker near-collision', 'Risk Rating': 'High', 'Corrective Action': 'Revised traffic segregation' },
      ],
      Environmental: [
        { 'Oil Spill': 'None', 'Air Quality': 'Moderate', 'Water Quality': 'Good', 'Waste Disposal': 'Compliant', Noise: 'Within limits', 'Carbon Emissions': '2.1 tCO2/TEU' },
      ],
      'Permit to Work': [
        { 'Permit Number': 'PTW-551', 'Work Type': 'Hot Work', Contractor: 'Gulf Marine Services', Expiry: '2026-08-02', Status: 'Active' },
      ],
    },
    customer: {
      Complaints: [
        { Customer: 'Meridian Shipping Co', 'Complaint Category': 'Delayed Release', Priority: 'High', Status: 'Open', 'Resolution Time': '' },
        { Customer: 'Continental Freight LLC', 'Complaint Category': 'Billing Query', Priority: 'Low', Status: 'Resolved', 'Resolution Time': '2 days' },
      ],
      'SLA Performance': [
        { Service: 'Gate Turnaround', 'SLA Target': 30, Actual: 34, 'Compliance %': 84 },
        { Service: 'Vessel Berthing Window', 'SLA Target': 60, Actual: 58, 'Compliance %': 97 },
        { Service: 'Documentation Processing', 'SLA Target': 24, Actual: 22, 'Compliance %': 96 },
      ],
    },
    risk: {
      'Risk Register': [
        { Risk: 'Single point of failure — main gate scanner', Category: 'Operational', Likelihood: 'Medium', Impact: 'High', 'Current Rating': 'High', 'Risk Owner': 'Head of Terminal Ops' },
        { Risk: 'Cyber exposure — legacy PCS integration', Category: 'Technology', Likelihood: 'Medium', Impact: 'Critical', 'Current Rating': 'Critical', 'Risk Owner': 'CIO' },
        { Risk: 'Customer concentration — top 3 accounts', Category: 'Commercial', Likelihood: 'Low', Impact: 'Medium', 'Current Rating': 'Medium', 'Risk Owner': 'CCO' },
      ],
      'Business Continuity': [
        { Scenario: 'Extended power outage', Preparedness: 'Partial', 'Recovery Time Objective': '4 hours', 'Current Status': 'Not Ready' },
        { Scenario: 'Cyclone landfall', Preparedness: 'Full', 'Recovery Time Objective': '24 hours', 'Current Status': 'Ready' },
      ],
    },
    weather: {
      Weather: [
        { Temperature: '38°C', 'Wind Speed': '22 kn', Visibility: '8 nm', Tide: 'Rising', 'Wave Height': '1.2 m', Rainfall: '0 mm' },
      ],
      'External Events': [
        { Cyclone: 'No', Strike: 'No', 'Canal Disruption': 'No', 'Geopolitical Event': 'Regional shipping advisory — Red Sea rerouting', 'Shipping Advisory': 'Yes' },
      ],
    },
  };
}

/* ============================== markdown-ish renderer ============================== */

function InlineText({ text }) {
  const parts = String(text).split(/(\*\*[^*]+\*\*)/g);
  return (
    <>
      {parts.map((p, i) =>
        p.startsWith('**') && p.endsWith('**') ? <strong key={i} className="text-ivory font-semibold">{p.slice(2, -2)}</strong> : <span key={i}>{p}</span>
      )}
    </>
  );
}

function RichText({ text }) {
  if (!text) return null;
  const lines = text.split('\n');
  const blocks = [];
  let list = [];
  const flushList = (key) => {
    if (list.length) {
      blocks.push(
        <ul key={'ul' + key} className="mb-3 space-y-1.5 pl-1">
          {list.map((li, i) => (
            <li key={i} className="flex gap-2 text-sm leading-relaxed text-fog">
              <span className="mt-1.5 h-1 w-1 flex-shrink-0 rounded-full bg-cyan" />
              <span><InlineText text={li} /></span>
            </li>
          ))}
        </ul>
      );
      list = [];
    }
  };
  lines.forEach((line, idx) => {
    const trimmed = line.trim();
    if (!trimmed) { flushList(idx); return; }
    if (/^#{1,3}\s+/.test(trimmed)) {
      flushList(idx);
      const level = trimmed.match(/^#+/)[0].length;
      const content = trimmed.replace(/^#{1,3}\s+/, '');
      blocks.push(
        <div key={idx} className={level === 1 ? 'mt-4 mb-2 font-display text-base font-semibold tracking-wide text-cyan' : 'mt-4 mb-1.5 font-display text-sm font-semibold uppercase tracking-widest text-steel-light'}>
          {content}
        </div>
      );
    } else if (/^[-*]\s+/.test(trimmed)) {
      list.push(trimmed.replace(/^[-*]\s+/, ''));
    } else {
      flushList(idx);
      blocks.push(<p key={idx} className="mb-3 text-sm leading-relaxed text-fog"><InlineText text={trimmed} /></p>);
    }
  });
  flushList('end');
  return <div>{blocks}</div>;
}

/* ============================== gauge ============================== */

function HealthGauge({ score, loading }) {
  const has = score !== null && score !== undefined;
  const pct = has ? score : 0;
  const radius = 72;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - pct / 100);
  const color = !has ? '#4A5C74' : pct >= 75 ? '#5EEAD4' : pct >= 50 ? '#F5A623' : '#F0554A';

  return (
    <div className="relative flex flex-col items-center justify-center py-2">
      <div className="relative h-44 w-44">
        <div className="absolute inset-0 rounded-full radar-sweep opacity-30" />
        <svg width="176" height="176" viewBox="0 0 176 176" className="relative -rotate-90">
          <circle cx="88" cy="88" r={radius} fill="none" stroke="#1B2A42" strokeWidth="10" />
          <circle
            cx="88" cy="88" r={radius} fill="none" stroke={color} strokeWidth="10" strokeLinecap="round"
            strokeDasharray={circumference} strokeDashoffset={has ? offset : circumference}
            style={{ transition: 'stroke-dashoffset 900ms ease, stroke 500ms ease' }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          {loading ? (
            <Loader2 className="h-7 w-7 animate-spin text-cyan" />
          ) : (
            <>
              <span className="font-mono text-4xl font-semibold tabular-nums text-ivory">{has ? pct : '—'}</span>
              <span className="mt-0.5 text-10 uppercase tracking-2 text-steel">of 100</span>
            </>
          )}
        </div>
      </div>
      <div className="mt-3 font-display text-sm font-medium uppercase tracking-15 text-steel-light">Port Health Score</div>
    </div>
  );
}

/* ============================== small UI atoms ============================== */

function SeverityDot({ severity }) {
  const color = severity >= 3 ? '#F0554A' : severity === 2 ? '#F5A623' : '#5EEAD4';
  return <span className="mt-1.5 h-1.5 w-1.5 flex-shrink-0 rounded-full" style={{ backgroundColor: color }} />;
}

function FlagRow({ flag, domainLabel }) {
  return (
    <div className="flex gap-2.5 border-b border-line py-3 last:border-0">
      <SeverityDot severity={flag.severity} />
      <div className="min-w-0">
        <div className="text-10 font-medium uppercase tracking-wider text-steel-dim">{domainLabel}</div>
        <div className="text-sm leading-snug text-fog-light">{flag.text}</div>
      </div>
    </div>
  );
}

/* ============================== main app ============================== */

const CLAUDE_MODEL = 'claude-sonnet-4-6';

async function callClaudeRaw(body) {
  let response;
  try {
    response = await fetch('/api/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  } catch (networkErr) {
    throw new Error('Network error reaching the reasoning engine (fetch failed). Check connectivity and try again.');
  }
  if (!response.ok) {
    let detail = '';
    try {
      const errBody = await response.json();
      detail = errBody?.error?.message || JSON.stringify(errBody).slice(0, 300);
    } catch (parseErr) {
      detail = await response.text().catch(() => '');
    }
    throw new Error(`API request failed (${response.status}): ${detail || 'no further detail returned'}`);
  }
  return response.json();
}

async function callClaude(systemPrompt, userContent, { withWebSearch = false } = {}) {
  const baseBody = {
    model: CLAUDE_MODEL,
    max_tokens: 1000,
    system: systemPrompt,
    messages: [{ role: 'user', content: userContent }],
  };
  if (withWebSearch) {
    try {
      const data = await callClaudeRaw({ ...baseBody, tools: [{ type: 'web_search_20250305', name: 'web_search' }] });
      const text = (data.content || []).filter((b) => b.type === 'text').map((b) => b.text).join('\n');
      if (text) return text;
      // fall through to retry without web search if no text block came back
    } catch (searchErr) {
      // Web search may not be available in this environment — retry without it
      // rather than failing the whole feature.
    }
  }
  const data = await callClaudeRaw(baseBody);
  const text = (data.content || []).filter((b) => b.type === 'text').map((b) => b.text).join('\n');
  return text || 'No response generated.';
}

function formatDateTime(d) {
  if (!d) return '';
  return d.toLocaleString('en-US', { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}

function getWeekRangeLabel(d) {
  const day = d.getDay();
  const monday = new Date(d);
  monday.setDate(d.getDate() - ((day + 6) % 7));
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  const opts = { month: 'short', day: 'numeric' };
  return `${monday.toLocaleDateString('en-US', opts)} – ${sunday.toLocaleDateString('en-US', opts)}, ${sunday.getFullYear()}`;
}

function getMonthLabel(d) {
  return d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
}

async function copyToClipboard(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch (err) {
    return false;
  }
}

export default function App() {
  const [domainData, setDomainData] = useState({});
  const [view, setView] = useState('overview');
  const [toast, setToast] = useState(null);
  const [showMethodology, setShowMethodology] = useState(false);

  const [briefing, setBriefing] = useState('');
  const [briefingLoading, setBriefingLoading] = useState(false);
  const [briefingError, setBriefingError] = useState('');
  const [briefingGeneratedAt, setBriefingGeneratedAt] = useState(null);

  const [chatMessages, setChatMessages] = useState([]);
  const [chatInput, setChatInput] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const chatEndRef = useRef(null);

  const [whatIfInput, setWhatIfInput] = useState('');
  const [whatIfResult, setWhatIfResult] = useState('');
  const [whatIfLoading, setWhatIfLoading] = useState(false);

  const [newsletterPeriod, setNewsletterPeriod] = useState('weekly');
  const [newsletter, setNewsletter] = useState('');
  const [newsletterLoading, setNewsletterLoading] = useState(false);
  const [newsletterError, setNewsletterError] = useState('');
  const [newsletterGeneratedAt, setNewsletterGeneratedAt] = useState(null);

  const [copiedKey, setCopiedKey] = useState('');

  const fileInputRefs = useRef({});

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3200);
    return () => clearTimeout(t);
  }, [toast]);

  useEffect(() => {
    if (chatEndRef.current) chatEndRef.current.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages, chatLoading]);

  const summaries = useMemo(() => {
    const out = {};
    for (const d of DOMAINS) {
      const sheets = domainData[d.id];
      out[d.id] = sheets ? d.summarize(sheets) : null;
    }
    return out;
  }, [domainData]);

  const loadedCount = DOMAINS.filter((d) => summaries[d.id]).length;

  const overallScore = useMemo(() => {
    const scores = DOMAINS.map((d) => summaries[d.id]?.score).filter((s) => s !== undefined && s !== null);
    if (!scores.length) return null;
    return Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);
  }, [summaries]);

  const allFlags = useMemo(() => {
    const out = [];
    for (const d of DOMAINS) {
      const s = summaries[d.id];
      if (!s) continue;
      for (const f of s.flags) out.push({ ...f, domainLabel: d.short });
    }
    return out;
  }, [summaries]);

  const topRisks = useMemo(
    () => allFlags.filter((f) => f.type === 'risk').sort((a, b) => b.severity - a.severity).slice(0, 5),
    [allFlags]
  );
  const topOpportunities = useMemo(
    () => allFlags.filter((f) => f.type === 'opportunity').sort((a, b) => b.severity - a.severity).slice(0, 5),
    [allFlags]
  );

  const dataContext = useMemo(() => {
    const ctx = {};
    for (const d of DOMAINS) {
      const s = summaries[d.id];
      ctx[d.label] = s
        ? { status: 'data loaded', healthScore: s.score, headline: s.headline, metrics: s.metrics, flags: s.flags.map((f) => `[${f.type}] ${f.text}`) }
        : { status: 'no data uploaded for this system' };
    }
    return ctx;
  }, [summaries]);

  const handleFileUpload = useCallback((domainId, file) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const wb = XLSX.read(e.target.result, { type: 'array', cellDates: true });
        const sheets = {};
        wb.SheetNames.forEach((name) => {
          sheets[name] = XLSX.utils.sheet_to_json(wb.Sheets[name], { defval: '' });
        });
        setDomainData((prev) => ({ ...prev, [domainId]: sheets }));
        setToast({ type: 'success', text: `${file.name} loaded — ${wb.SheetNames.length} sheet(s) parsed.` });
      } catch (err) {
        setToast({ type: 'error', text: `Could not read ${file.name}. Please check the file format.` });
      }
    };
    reader.onerror = () => setToast({ type: 'error', text: `Failed to read ${file.name}.` });
    reader.readAsArrayBuffer(file);
  }, []);

  const handleLoadSample = useCallback(() => {
    setDomainData(buildSampleData());
    setToast({ type: 'success', text: 'Sample data loaded across all 10 systems.' });
  }, []);

  const handleReset = useCallback(() => {
    setDomainData({});
    setBriefing('');
    setBriefingGeneratedAt(null);
    setChatMessages([]);
    setWhatIfResult('');
    setNewsletter('');
    setNewsletterGeneratedAt(null);
    setToast({ type: 'success', text: 'All data cleared.' });
  }, []);

  const handleGenerateBriefing = useCallback(async () => {
    setBriefingLoading(true);
    setBriefingError('');
    try {
      const system = `You are an AI Chief of Staff for the CEO of a Port Authority, preparing today's Daily Brief. You have (1) a simulated real-time snapshot of the port's own enterprise systems, and (2) live web search for current global maritime, shipping, ports, and trade news. Some internal systems may show "no data uploaded" — acknowledge gaps briefly rather than inventing data. Run at most 2 focused web searches for the most decision-relevant global port/maritime/trade news from the last few days (e.g. shipping route disruptions, tariffs and trade policy, major port congestion or strikes elsewhere, fuel/bunker prices, regional geopolitical events affecting shipping) — do not over-search, most of your output budget should go to the brief itself, not search narration. Write a concise, board-ready Daily Brief using this structure with markdown headers (##): Executive Summary (2-3 sentences), Port Health Score & Rationale, Top Internal Risks (bullets, most severe first), Top Opportunities (bullets), Global & Industry Watch (2-4 bullets on external news, name the source for each, e.g. "(Reuters)"), Recommended Actions (bullets, specific and prioritized). Be direct, quantify wherever the data allows, and never fabricate numbers or news not grounded in the data or search results provided. Keep the whole brief tight enough to read in under two minutes.`;
      const user = `Overall Port Health Score (computed from available systems): ${overallScore ?? 'insufficient data'}.\n\nSystem-by-system snapshot (JSON):\n${JSON.stringify(dataContext, null, 2)}\n\nGenerate today's Daily Brief, combining this internal snapshot with current global maritime/trade news.`;
      const text = await callClaude(system, user, { withWebSearch: true });
      setBriefing(text);
      setBriefingGeneratedAt(new Date());
    } catch (err) {
      setBriefingError(`Could not generate the brief. ${err?.message || 'Please try again.'}`);
    } finally {
      setBriefingLoading(false);
    }
  }, [dataContext, overallScore]);

  const handleGenerateNewsletter = useCallback(async () => {
    setNewsletterLoading(true);
    setNewsletterError('');
    try {
      const now = new Date();
      const periodLabel = newsletterPeriod === 'weekly' ? `the week of ${getWeekRangeLabel(now)}` : `${getMonthLabel(now)}`;
      const system = `You are an AI Chief of Staff producing a ${newsletterPeriod} internal newsletter about port operations and the wider maritime/trade industry, meant to be copied into an email or Slack post for distribution to executives and stakeholders. You have a simulated snapshot of the port's own systems, and live web search for global maritime, shipping, ports, and trade news over the relevant period. Run at most 3 focused web searches covering the most significant recent global developments (shipping disruptions, trade policy/tariffs, major port news elsewhere, fuel prices, regional geopolitical events) — prioritize finishing a well-formed newsletter over exhaustive search. Write in a newsletter voice: warm but professional, scannable, no fluff. Structure with markdown headers (##): a one-line masthead-style opening, "This ${newsletterPeriod === 'weekly' ? 'Week' : 'Month'} at a Glance" (3-4 bullets on internal port performance, quantified from the data), "Industry & Market Watch" (3-5 bullets on external news, each naming its source), "Risk & Opportunity Radar" (2-3 bullets), "Looking Ahead" (2-3 bullets on what to watch next period). Never fabricate figures or news not grounded in the data or search results.`;
      const user = `Newsletter period: ${periodLabel}.\n\nOverall Port Health Score: ${overallScore ?? 'insufficient data'}.\n\nSystem-by-system snapshot (JSON):\n${JSON.stringify(dataContext, null, 2)}\n\nGenerate the ${newsletterPeriod} newsletter for ${periodLabel}.`;
      const text = await callClaude(system, user, { withWebSearch: true });
      setNewsletter(text);
      setNewsletterGeneratedAt(new Date());
    } catch (err) {
      setNewsletterError(`Could not generate the newsletter. ${err?.message || 'Please try again.'}`);
    } finally {
      setNewsletterLoading(false);
    }
  }, [dataContext, overallScore, newsletterPeriod]);

  const handleCopy = useCallback(async (text, key) => {
    const ok = await copyToClipboard(text);
    setToast(ok ? { type: 'success', text: 'Copied to clipboard.' } : { type: 'error', text: 'Could not copy — select and copy the text manually.' });
    if (ok) {
      setCopiedKey(key);
      setTimeout(() => setCopiedKey(''), 2000);
    }
  }, []);

  const handleSendChat = useCallback(async () => {
    const question = chatInput.trim();
    if (!question || chatLoading) return;
    const nextMessages = [...chatMessages, { role: 'user', content: question }];
    setChatMessages(nextMessages);
    setChatInput('');
    setChatLoading(true);
    try {
      const system = `You are an AI Chief of Staff for the CEO of a Port Authority, embedded in an Executive Digital Twin PoC. Answer the CEO's questions using only the simulated enterprise data snapshot provided below. If a system has no data uploaded, say so rather than guessing. Be direct, specific, and reference concrete figures from the data where relevant. Keep answers focused — a few short paragraphs or a tight bullet list, not an essay.\n\nCurrent enterprise data snapshot (JSON):\n${JSON.stringify(dataContext)}`;
      const conversation = nextMessages.map((m) => `${m.role === 'user' ? 'CEO' : 'Chief of Staff'}: ${m.content}`).join('\n\n');
      const text = await callClaude(system, conversation + '\n\nRespond as the Chief of Staff to the latest CEO message.');
      setChatMessages((prev) => [...prev, { role: 'assistant', content: text }]);
    } catch (err) {
      setChatMessages((prev) => [...prev, { role: 'assistant', content: `I ran into an issue reaching the reasoning engine: ${err?.message || 'unknown error'}. Please try asking again.` }]);
    } finally {
      setChatLoading(false);
    }
  }, [chatInput, chatLoading, chatMessages, dataContext]);

  const handleRunWhatIf = useCallback(async () => {
    const scenario = whatIfInput.trim();
    if (!scenario || whatIfLoading) return;
    setWhatIfLoading(true);
    setWhatIfResult('');
    try {
      const system = `You are an AI Chief of Staff for a Port Authority CEO running a "what-if" executive simulation inside an Executive Digital Twin PoC. Given a hypothetical scenario and the current simulated data snapshot of the port's systems, reason step by step across domains (marine, terminal, customs, finance, HSE, customer, risk, weather) about likely knock-on effects, then present a structured response with markdown headers (##): Immediate Impact, Cascading Effects Across Systems, Recommended Executive Response. Be specific and grounded in the data provided; flag clearly when you are extrapolating beyond the data rather than reading it directly.`;
      const user = `Current enterprise data snapshot (JSON):\n${JSON.stringify(dataContext)}\n\nExecutive what-if scenario: "${scenario}"\n\nSimulate the impact of this scenario.`;
      const text = await callClaude(system, user);
      setWhatIfResult(text);
    } catch (err) {
      setWhatIfResult(`Could not run the simulation. ${err?.message || 'Please try again.'}`);
    } finally {
      setWhatIfLoading(false);
    }
  }, [whatIfInput, whatIfLoading, dataContext]);

  const tabs = [
    { id: 'overview', label: 'Overview', icon: Gauge },
    { id: 'sources', label: 'Data Sources', icon: FileSpreadsheet },
    { id: 'briefing', label: 'Daily Brief', icon: Sparkles },
    { id: 'newsletter', label: 'Newsletter', icon: Newspaper },
    { id: 'chat', label: 'Ask the Chief of Staff', icon: MessageSquare },
    { id: 'whatif', label: 'What-If Simulator', icon: Radio },
  ];

  return (
    <div className="min-h-screen w-full bg-navy font-body text-ivory">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;600;700&family=Inter:wght@400;500;600&family=IBM+Plex+Mono:wght@400;500;600&display=swap');
        .font-display { font-family: 'Space Grotesk', ui-sans-serif, sans-serif; }
        .font-body { font-family: 'Inter', ui-sans-serif, sans-serif; }
        .font-mono { font-family: 'IBM Plex Mono', ui-monospace, monospace; }
        .chart-grid {
          background-image:
            linear-gradient(rgba(94,234,212,0.05) 1px, transparent 1px),
            linear-gradient(90deg, rgba(94,234,212,0.05) 1px, transparent 1px);
          background-size: 28px 28px;
        }
        .radar-sweep {
          background: conic-gradient(from 0deg, rgba(94,234,212,0.35), transparent 30%, transparent 100%);
          animation: spin 4s linear infinite;
        }
        @keyframes spin { to { transform: rotate(360deg); } }
        @media (prefers-reduced-motion: reduce) {
          .radar-sweep { animation: none; }
        }
        .scrollbar-thin::-webkit-scrollbar { width: 6px; height: 6px; }
        .scrollbar-thin::-webkit-scrollbar-thumb { background: #2A3B54; border-radius: 3px; }
        .scrollbar-thin::-webkit-scrollbar-track { background: transparent; }
        input[type=file] { color: transparent; }

        /* ---- color tokens (plain CSS classes: this artifact runtime has no
           Tailwind JIT compiler, so bg-[#xxxxxx] style arbitrary values are
           silently dropped — every color/size below must be a real class) ---- */
        .bg-navy { background-color: #0B1524; }
        .bg-panel { background-color: #101B2D; }
        .bg-cyan { background-color: #5EEAD4; }
        .bg-cyan-light { background-color: #7EF3E1; }
        .bg-slate { background-color: #3A4A62; }
        .bg-toast-error-bg { background-color: #1a1015; }
        .bg-toast-success-bg { background-color: #0f1f1c; }

        .text-steel-dim { color: #5A6E88; }
        .text-cyan { color: #5EEAD4; }
        .text-steel { color: #7C93AD; }
        .text-steel-light { color: #8FA3BC; }
        .text-ivory { color: #E8EDF4; }
        .text-fog { color: #C7D3E0; }
        .text-fog-light { color: #D5DEEA; }
        .text-navy { color: #0B1524; }
        .text-coral { color: #F0554A; }
        .text-slate-dim { color: #4A5C74; }
        .text-coral-light { color: #F0987F; }
        .text-line-light { color: #2A3B54; }

        .border-line { border-color: #1B2A42; }
        .border-line-light { border-color: #2A3B54; }
        .border-cyan { border-color: #5EEAD4; }
        .border-coral { border-color: #F0554A; }
        .border-line-dim { border-color: #161F30; }
        .border-toast-error { border-color: rgba(240,85,74,0.4); }
        .border-toast-success { border-color: rgba(94,234,212,0.3); }

        .text-11 { font-size: 11px; }
        .text-10 { font-size: 10px; }
        .text-9 { font-size: 9px; }
        .tracking-2 { letter-spacing: 0.2em; }
        .tracking-15 { letter-spacing: 0.15em; }
        .min-h-200 { min-height: 200px; }
        .h-440 { height: 440px; }
        .max-w-85p { max-width: 85%; }

        /* ---- interactive component classes (replace Tailwind hover: variants,
           which also require the JIT compiler and don't work here) ---- */
        .btn-primary { background-color: #5EEAD4; color: #0B1524; }
        .btn-primary:hover { background-color: #7EF3E1; }

        .btn-secondary { border-color: #2A3B54; background-color: #101B2D; color: #C7D3E0; }
        .btn-secondary:hover { border-color: #5EEAD4; color: #5EEAD4; }

        .btn-danger-ghost { border-color: #2A3B54; color: #8FA3BC; }
        .btn-danger-ghost:hover { border-color: #F0554A; color: #F0554A; }

        .link-muted { color: #5A6E88; }
        .link-muted:hover { color: #8FA3BC; }

        .upload-zone { border-color: #2A3B54; color: #8FA3BC; }
        .upload-zone:hover { border-color: #5EEAD4; color: #5EEAD4; }

        .chip { border-color: #2A3B54; color: #7C93AD; }
        .chip:hover { border-color: #5EEAD4; color: #5EEAD4; }

        .tab-btn { border-color: transparent; color: #7C93AD; }
        .tab-btn:hover { color: #C7D3E0; }
        .tab-btn.active { border-color: #5EEAD4; color: #5EEAD4; }

        .seg-btn { background-color: #101B2D; color: #7C93AD; }
        .seg-btn:hover { color: #C7D3E0; }
        .seg-btn.active { background-color: #5EEAD4; color: #0B1524; }

        .input-field { border-color: #2A3B54; background-color: #0B1524; color: #E8EDF4; }
        .input-field::placeholder { color: #4A5C74; }
        .input-field:focus { border-color: #5EEAD4; }
      `}</style>

      {/* header */}
      <div className="chart-grid border-b border-line">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-5 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-line-light bg-panel">
              <Radio className="h-5 w-5 text-cyan" />
            </div>
            <div>
              <div className="font-display text-lg font-semibold leading-tight tracking-tight">Executive Digital Twin</div>
              <div className="text-xs font-medium uppercase tracking-2 text-steel-dim">Port Authority · AI Chief of Staff</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="mr-2 hidden items-center gap-1.5 rounded-full border border-line-light px-3 py-1 text-xs text-steel-light sm:flex">
              <span className="h-1.5 w-1.5 rounded-full bg-cyan" />
              {loadedCount} of {DOMAINS.length} systems online
            </div>
            <button
              onClick={handleLoadSample}
              className="btn-secondary rounded-lg border px-3 py-2 text-xs font-medium transition"
            >
              Load Sample Data
            </button>
            <button
              onClick={handleReset}
              className="btn-danger-ghost flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-medium transition"
            >
              <RefreshCw className="h-3.5 w-3.5" /> Reset
            </button>
          </div>
        </div>
        <div className="mx-auto max-w-7xl px-5 pb-3 text-11 text-steel-dim">
          Proof of concept — operates entirely on uploaded Excel workbooks simulating enterprise systems. No live integrations.
        </div>
      </div>

      {/* tabs */}
      <div className="border-b border-line bg-navy/80">
        <div className="mx-auto flex max-w-7xl gap-1 overflow-x-auto px-5 scrollbar-thin">
          {tabs.map((t) => {
            const Icon = t.icon;
            const active = view === t.id;
            return (
              <button
                key={t.id}
                onClick={() => setView(t.id)}
                className={`flex flex-shrink-0 items-center gap-2 border-b-2 px-3 py-3 text-sm font-medium transition ${
                  active ? 'tab-btn active' : 'tab-btn'
                }`}
              >
                <Icon className="h-4 w-4" />
                {t.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-5 py-6">
        {/* ============ OVERVIEW ============ */}
        {view === 'overview' && (
          <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
            <div className="rounded-xl border border-line bg-panel p-5 lg:col-span-1">
              <HealthGauge score={overallScore} loading={false} />
              <button
                onClick={() => setShowMethodology((v) => !v)}
                className="link-muted mx-auto mt-2 flex items-center gap-1 text-xs transition"
              >
                <Info className="h-3.5 w-3.5" /> How is this calculated?
                <ChevronDown className={`h-3.5 w-3.5 transition-transform ${showMethodology ? 'rotate-180' : ''}`} />
              </button>
              {showMethodology && (
                <p className="mt-2 rounded-lg bg-navy p-3 text-xs leading-relaxed text-steel">
                  Each of the ten systems produces an illustrative 0–100 sub-score from simple, transparent penalty rules (e.g. delayed vessels, over-utilised berths, overdue maintenance, open high-severity incidents). The overall score is the average of sub-scores across systems with data loaded. This is a demo heuristic, not an audited KPI methodology.
                </p>
              )}
              {loadedCount === 0 && (
                <div className="mt-4 rounded-lg border border-dashed border-line-light p-4 text-center text-xs text-steel-dim">
                  No systems loaded yet. Upload Excel workbooks in <button onClick={() => setView('sources')} className="text-cyan underline underline-offset-2">Data Sources</button>, or use <button onClick={handleLoadSample} className="text-cyan underline underline-offset-2">Load Sample Data</button> to see the twin in action.
                </div>
              )}
              <div className="mt-5 grid grid-cols-2 gap-2">
                {DOMAINS.map((d) => {
                  const s = summaries[d.id];
                  const Icon = d.icon;
                  return (
                    <div key={d.id} className={`rounded-lg border p-2.5 ${s ? 'border-line-light bg-navy' : 'border-line-dim bg-transparent opacity-50'}`}>
                      <div className="flex items-center gap-1.5 text-10 font-medium uppercase tracking-wider text-steel-dim">
                        <Icon className="h-3 w-3" /> {d.short}
                      </div>
                      <div className="mt-1 truncate font-mono text-xs text-fog">{s ? s.score : '—'}</div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="rounded-xl border border-line bg-panel p-5 lg:col-span-1">
              <div className="mb-1 flex items-center gap-2">
                <TrendingDown className="h-4 w-4 text-coral" />
                <h3 className="font-display text-sm font-semibold uppercase tracking-wide text-fog-light">Top Executive Risks</h3>
              </div>
              <p className="mb-2 text-xs text-steel-dim">Ranked by severity across all loaded systems.</p>
              {topRisks.length === 0 ? (
                <div className="py-8 text-center text-sm text-steel-dim">No risks flagged from the data loaded so far.</div>
              ) : (
                <div>{topRisks.map((f, i) => <FlagRow key={i} flag={f} domainLabel={f.domainLabel} />)}</div>
              )}
            </div>

            <div className="rounded-xl border border-line bg-panel p-5 lg:col-span-1">
              <div className="mb-1 flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-cyan" />
                <h3 className="font-display text-sm font-semibold uppercase tracking-wide text-fog-light">Top Opportunities</h3>
              </div>
              <p className="mb-2 text-xs text-steel-dim">Spare capacity and clean-status signals worth acting on.</p>
              {topOpportunities.length === 0 ? (
                <div className="py-8 text-center text-sm text-steel-dim">No opportunities surfaced yet.</div>
              ) : (
                <div>{topOpportunities.map((f, i) => <FlagRow key={i} flag={f} domainLabel={f.domainLabel} />)}</div>
              )}
            </div>

            <div className="lg:col-span-3">
              <h3 className="mb-3 font-display text-sm font-semibold uppercase tracking-wide text-steel-light">System Modules</h3>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
                {DOMAINS.map((d) => {
                  const s = summaries[d.id];
                  const Icon = d.icon;
                  return (
                    <div key={d.id} className="rounded-xl border border-line bg-panel p-4">
                      <div className="mb-2 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Icon className="h-4 w-4 text-steel" />
                          <span className="font-display text-xs font-semibold tracking-wide text-fog">{d.short}</span>
                        </div>
                        {s ? <CheckCircle2 className="h-3.5 w-3.5 text-cyan" /> : <span className="h-1.5 w-1.5 rounded-full bg-slate" />}
                      </div>
                      {s ? (
                        <>
                          <div className="mb-2 text-xs leading-snug text-steel-light">{s.headline}</div>
                          <div className="grid grid-cols-2 gap-1.5">
                            {s.metrics.slice(0, 4).map((m, i) => (
                              <div key={i}>
                                <div className="font-mono text-sm font-medium text-ivory">{m.value}</div>
                                <div className="text-9 uppercase tracking-wide text-steel-dim">{m.label}</div>
                              </div>
                            ))}
                          </div>
                        </>
                      ) : (
                        <div className="text-xs text-slate-dim">Not connected</div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* ============ DATA SOURCES ============ */}
        {view === 'sources' && (
          <div>
            <h2 className="mb-1 font-display text-lg font-semibold">Data Sources</h2>
            <p className="mb-5 text-sm text-steel">Upload one Excel workbook per enterprise system. Each workbook simulates that system's live feed into the digital twin.</p>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
              {DOMAINS.map((d) => {
                const s = summaries[d.id];
                const Icon = d.icon;
                return (
                  <div key={d.id} className="rounded-xl border border-line bg-panel p-4">
                    <div className="mb-2 flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2.5">
                        <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg border border-line-light bg-navy">
                          <Icon className="h-4 w-4 text-cyan" />
                        </div>
                        <div>
                          <div className="font-display text-sm font-semibold text-ivory">{d.label}</div>
                          <div className="text-11 text-steel-dim">{d.sheetHint}</div>
                        </div>
                      </div>
                      {s && <CheckCircle2 className="h-4 w-4 flex-shrink-0 text-cyan" />}
                    </div>
                    <label className="upload-zone mt-2 flex cursor-pointer items-center justify-center gap-2 rounded-lg border border-dashed py-3 text-xs font-medium transition">
                      <Upload className="h-3.5 w-3.5" />
                      {s ? 'Replace workbook (.xlsx)' : 'Upload workbook (.xlsx)'}
                      <input
                        type="file"
                        accept=".xlsx,.xls"
                        className="hidden"
                        onChange={(e) => handleFileUpload(d.id, e.target.files?.[0])}
                      />
                    </label>
                    {s && <div className="mt-2 font-mono text-11 text-steel-dim">{s.headline}</div>}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ============ BRIEFING ============ */}
        {view === 'briefing' && (
          <div className="mx-auto max-w-3xl">
            <div className="mb-2 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="font-display text-lg font-semibold">Daily Brief</h2>
                <p className="text-sm text-steel">Internal system snapshot plus live global maritime &amp; trade news, combined into one board-ready brief.</p>
              </div>
              <button
                onClick={handleGenerateBriefing}
                disabled={briefingLoading}
                className="btn-primary flex flex-shrink-0 items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold transition disabled:opacity-60"
              >
                {briefingLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                {briefing ? 'Regenerate Brief' : 'Generate Daily Brief'}
              </button>
            </div>
            <div className="mb-4 flex items-center gap-1.5 text-11 text-steel-dim">
              <Globe2 className="h-3 w-3" /> Includes a live web search for current port, shipping &amp; trade news
            </div>
            {loadedCount === 0 && !briefing && (
              <div className="mb-4 rounded-lg border border-dashed border-line-light p-4 text-center text-xs text-steel-dim">
                No systems loaded — the brief will note data gaps. Consider <button onClick={handleLoadSample} className="text-cyan underline underline-offset-2">loading sample data</button> first.
              </div>
            )}
            <div className="rounded-xl border border-line bg-panel p-6 min-h-200">
              {briefingLoading && !briefing && (
                <div className="flex flex-col items-center justify-center gap-3 py-16 text-steel-dim">
                  <Loader2 className="h-6 w-6 animate-spin text-cyan" />
                  <span className="text-sm">Reasoning across systems and searching current news…</span>
                </div>
              )}
              {briefingError && <div className="text-sm text-coral">{briefingError}</div>}
              {!briefingLoading && !briefing && !briefingError && (
                <div className="py-16 text-center text-sm text-steel-dim">No brief generated yet.</div>
              )}
              {briefing && (
                <>
                  <RichText text={briefing} />
                  <div className="mt-4 flex items-center justify-between border-t border-line pt-4">
                    <span className="text-11 text-steel-dim">Generated {formatDateTime(briefingGeneratedAt)}</span>
                    <button onClick={() => handleCopy(briefing, 'briefing')} className="btn-secondary flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-11 font-medium transition">
                      {copiedKey === 'briefing' ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                      {copiedKey === 'briefing' ? 'Copied' : 'Copy'}
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        {/* ============ NEWSLETTER ============ */}
        {view === 'newsletter' && (
          <div className="mx-auto max-w-3xl">
            <div className="mb-2 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="font-display text-lg font-semibold">Newsletter</h2>
                <p className="text-sm text-steel">A shareable digest of port performance and industry news — ready to paste into an email or Slack post.</p>
              </div>
            </div>
            <div className="mb-4 flex flex-wrap items-center gap-3">
              <div className="flex overflow-hidden rounded-lg border border-line-light">
                <button
                  onClick={() => setNewsletterPeriod('weekly')}
                  className={`seg-btn flex items-center gap-1.5 px-3 py-2 text-xs font-medium transition ${newsletterPeriod === 'weekly' ? 'active' : ''}`}
                >
                  <CalendarDays className="h-3.5 w-3.5" /> Weekly
                </button>
                <button
                  onClick={() => setNewsletterPeriod('monthly')}
                  className={`seg-btn flex items-center gap-1.5 px-3 py-2 text-xs font-medium transition ${newsletterPeriod === 'monthly' ? 'active' : ''}`}
                >
                  <CalendarDays className="h-3.5 w-3.5" /> Monthly
                </button>
              </div>
              <button
                onClick={handleGenerateNewsletter}
                disabled={newsletterLoading}
                className="btn-primary flex flex-shrink-0 items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold transition disabled:opacity-60"
              >
                {newsletterLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Newspaper className="h-4 w-4" />}
                {newsletter ? 'Regenerate Newsletter' : `Generate ${newsletterPeriod === 'weekly' ? 'Weekly' : 'Monthly'} Newsletter`}
              </button>
            </div>
            <div className="mb-4 flex items-center gap-1.5 text-11 text-steel-dim">
              <Globe2 className="h-3 w-3" /> Includes a live web search for current port, shipping &amp; trade news
            </div>
            {loadedCount === 0 && !newsletter && (
              <div className="mb-4 rounded-lg border border-dashed border-line-light p-4 text-center text-xs text-steel-dim">
                No systems loaded — the newsletter will note data gaps. Consider <button onClick={handleLoadSample} className="text-cyan underline underline-offset-2">loading sample data</button> first.
              </div>
            )}
            <div className="rounded-xl border border-line bg-panel p-6 min-h-200">
              {newsletterLoading && !newsletter && (
                <div className="flex flex-col items-center justify-center gap-3 py-16 text-steel-dim">
                  <Loader2 className="h-6 w-6 animate-spin text-cyan" />
                  <span className="text-sm">Compiling {newsletterPeriod} performance and industry news…</span>
                </div>
              )}
              {newsletterError && <div className="text-sm text-coral">{newsletterError}</div>}
              {!newsletterLoading && !newsletter && !newsletterError && (
                <div className="py-16 text-center text-sm text-steel-dim">No newsletter generated yet.</div>
              )}
              {newsletter && (
                <>
                  <RichText text={newsletter} />
                  <div className="mt-4 flex items-center justify-between border-t border-line pt-4">
                    <span className="text-11 text-steel-dim">Generated {formatDateTime(newsletterGeneratedAt)}</span>
                    <button onClick={() => handleCopy(newsletter, 'newsletter')} className="btn-secondary flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-11 font-medium transition">
                      {copiedKey === 'newsletter' ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                      {copiedKey === 'newsletter' ? 'Copied' : 'Copy'}
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        {/* ============ CHAT ============ */}
        {view === 'chat' && (
          <div className="mx-auto flex max-w-3xl flex-col">
            <h2 className="mb-1 font-display text-lg font-semibold">Ask the Chief of Staff</h2>
            <p className="mb-4 text-sm text-steel">Ask executive questions about vessels, terminals, finance, risk, HSE, or anything across the loaded systems.</p>
            <div className="flex h-440 flex-col rounded-xl border border-line bg-panel">
              <div className="flex-1 space-y-4 overflow-y-auto p-5 scrollbar-thin">
                {chatMessages.length === 0 && (
                  <div className="flex h-full flex-col items-center justify-center gap-2 text-center text-sm text-steel-dim">
                    <MessageSquare className="h-6 w-6 text-line-light" />
                    <span>Try: "Which vessels are delayed?" or "What's driving the finance risk today?"</span>
                  </div>
                )}
                {chatMessages.map((m, i) => (
                  <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-85p rounded-xl px-4 py-2.5 text-sm leading-relaxed ${
                      m.role === 'user' ? 'bg-cyan text-navy' : 'border border-line bg-navy text-fog-light'
                    }`}>
                      {m.role === 'user' ? m.content : <RichText text={m.content} />}
                    </div>
                  </div>
                ))}
                {chatLoading && (
                  <div className="flex justify-start">
                    <div className="flex items-center gap-2 rounded-xl border border-line bg-navy px-4 py-2.5 text-sm text-steel">
                      <Loader2 className="h-3.5 w-3.5 animate-spin" /> Thinking…
                    </div>
                  </div>
                )}
                <div ref={chatEndRef} />
              </div>
              <div className="flex items-center gap-2 border-t border-line p-3">
                <input
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSendChat(); } }}
                  placeholder="Ask an executive question…"
                  className="input-field flex-1 rounded-lg border px-3 py-2.5 text-sm outline-none"
                />
                <button
                  onClick={handleSendChat}
                  disabled={chatLoading || !chatInput.trim()}
                  className="btn-primary flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg transition disabled:opacity-40"
                >
                  <Send className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ============ WHAT-IF ============ */}
        {view === 'whatif' && (
          <div className="mx-auto max-w-3xl">
            <h2 className="mb-1 font-display text-lg font-semibold">What-If Simulator</h2>
            <p className="mb-4 text-sm text-steel">Describe a hypothetical scenario and see how it cascades across systems.</p>
            <div className="rounded-xl border border-line bg-panel p-4">
              <textarea
                value={whatIfInput}
                onChange={(e) => setWhatIfInput(e.target.value)}
                placeholder='e.g. "What if Berth 1 goes into emergency maintenance for 48 hours?"'
                rows={3}
                className="input-field w-full resize-none rounded-lg border p-3 text-sm outline-none"
              />
              <div className="mt-3 flex flex-wrap gap-2">
                {['What if a customs strike delays clearance by 3 days?', 'What if two quay cranes fail simultaneously?', 'What if a top-5 customer defaults on receivables?'].map((ex) => (
                  <button
                    key={ex}
                    onClick={() => setWhatIfInput(ex)}
                    className="chip rounded-full border px-3 py-1 text-11 transition"
                  >
                    {ex}
                  </button>
                ))}
              </div>
              <button
                onClick={handleRunWhatIf}
                disabled={whatIfLoading || !whatIfInput.trim()}
                className="btn-primary mt-4 flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold transition disabled:opacity-50"
              >
                {whatIfLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Radio className="h-4 w-4" />}
                Run Simulation
              </button>
            </div>
            {(whatIfLoading || whatIfResult) && (
              <div className="mt-4 rounded-xl border border-line bg-panel p-6">
                {whatIfLoading && !whatIfResult && (
                  <div className="flex flex-col items-center justify-center gap-3 py-12 text-steel-dim">
                    <Loader2 className="h-6 w-6 animate-spin text-cyan" />
                    <span className="text-sm">Simulating cross-system impact…</span>
                  </div>
                )}
                {whatIfResult && <RichText text={whatIfResult} />}
              </div>
            )}
          </div>
        )}
      </div>

      {toast && (
        <div className={`fixed bottom-5 left-1/2 z-50 -translate-x-1/2 rounded-lg border px-4 py-2.5 text-sm shadow-lg ${
          toast.type === 'error' ? 'border-toast-error bg-toast-error-bg text-coral-light' : 'border-toast-success bg-toast-success-bg text-cyan'
        }`}>
          {toast.text}
        </div>
      )}
    </div>
  );
}
