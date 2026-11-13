import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import {
  AlertTriangle,
  Weight,
  BatteryLow,
  Anchor,
  ArrowDownToLine,
  DoorClosed,
  FlaskConical,
  Wrench,
  Package,
  Truck,
  Route,
  Sparkles,
  Save,
  FileText,
  Radar,
  ClipboardList,
  LayoutDashboard,
  SlidersHorizontal,
  Trash2,
  Loader2,
  CircleCheck,
  CircleAlert,
  Mic,
  Camera,
  Plus,
  Bell,
  ToggleLeft,
  ToggleRight,
  Download,
  UserCircle2,
  Upload,
  ArrowLeftRight,
  Info,
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Cell,
  ResponsiveContainer,
} from "recharts";
import * as XLSX from "xlsx";
import Papa from "papaparse";

/* ---------------------------------------------------------------------- */
/* Domain data                                                             */
/* ---------------------------------------------------------------------- */

const CATEGORIES = [
  {
    id: "struck_by",
    label: "Struck-by / Caught-between",
    shortLabel: "Struck-by",
    color: "#C0392B",
    icon: AlertTriangle,
    fields: [
      { key: "equipment_type", label: "Equipment type" },
      { key: "exclusion_zone_active", label: "Exclusion zone active" },
    ],
  },
  {
    id: "suspended_load",
    label: "Suspended Load / Lift Zone",
    shortLabel: "Lift zone",
    color: "#E67E22",
    icon: Weight,
    fields: [
      { key: "load_weight_tons", label: "Load weight (tons)" },
      { key: "wind_speed_kmh", label: "Wind speed (km/h)" },
      { key: "operator_shift_hours", label: "Operator hrs into shift" },
    ],
  },
  {
    id: "fatigue",
    label: "Operator Fatigue Near-Miss",
    shortLabel: "Fatigue",
    color: "#8E44AD",
    icon: BatteryLow,
    fields: [
      { key: "shift_length_hours", label: "Shift length (hrs)" },
      { key: "consecutive_days", label: "Consecutive days worked" },
      { key: "time_since_break_hours", label: "Hrs since last break" },
    ],
  },
  {
    id: "mooring",
    label: "Mooring / Snap-back Zone",
    shortLabel: "Mooring",
    color: "#16A085",
    icon: Anchor,
    fields: [
      { key: "vessel_size", label: "Vessel size" },
      { key: "sea_state", label: "Sea state" },
      { key: "mooring_line_type", label: "Mooring line type" },
    ],
  },
  {
    id: "fall_height",
    label: "Fall From Height",
    shortLabel: "Fall",
    color: "#2980B9",
    icon: ArrowDownToLine,
    fields: [
      { key: "height_meters", label: "Height (m)" },
      { key: "fall_protection_used", label: "Fall protection used" },
      { key: "task_type", label: "Task type" },
    ],
  },
  {
    id: "confined_space",
    label: "Confined Space Entry",
    shortLabel: "Confined sp.",
    color: "#34495E",
    icon: DoorClosed,
    fields: [
      { key: "gas_test_reading", label: "Gas test reading" },
      { key: "permit_number", label: "Permit number" },
      { key: "entry_exit_logged", label: "Entry/exit logged" },
    ],
  },
  {
    id: "dangerous_goods",
    label: "Dangerous Goods Handling",
    shortLabel: "Dang. goods",
    color: "#F1C40F",
    textDark: true,
    icon: FlaskConical,
    fields: [
      { key: "imdg_class", label: "IMDG class" },
      { key: "cargo_id", label: "Cargo / container ID" },
      { key: "discovery_method", label: "Discovery method" },
    ],
  },
  {
    id: "equipment_precursor",
    label: "Equipment Failure Precursor",
    shortLabel: "Equip. precursor",
    color: "#7F8C8D",
    icon: Wrench,
    fields: [
      { key: "equipment_id", label: "Equipment ID" },
      { key: "vibration_reading", label: "Vibration reading" },
      { key: "temperature_reading", label: "Temperature reading" },
    ],
  },
  {
    id: "cargo_stability",
    label: "Break Bulk / General Cargo Handling",
    shortLabel: "Break bulk",
    color: "#D35400",
    icon: Package,
    fields: [
      { key: "cargo_type", label: "Cargo type" },
      { key: "lifting_gear_type", label: "Lifting gear used" },
      { key: "stack_condition", label: "Stack / stow condition" },
    ],
  },
  {
    id: "roro_marshalling",
    label: "RoRo / Vehicle Marshalling",
    shortLabel: "RoRo",
    color: "#2C3E50",
    icon: Truck,
    fields: [
      { key: "vehicle_type", label: "Vehicle type" },
      { key: "ramp_involved", label: "Ship ramp involved" },
      { key: "securing_method", label: "Securing / lashing method" },
    ],
  },
  {
    id: "rail_operations",
    label: "Rail / Wagon Operations",
    shortLabel: "Rail",
    color: "#1ABC9C",
    icon: Route,
    fields: [
      { key: "wagon_type", label: "Wagon type" },
      { key: "shunting_operation", label: "Shunting in progress" },
      { key: "track_section", label: "Track / siding section" },
    ],
  },
];

const SEVERITIES = [
  { id: "near_miss", label: "Near miss", color: "#27AE60" },
  { id: "minor", label: "Minor", color: "#F1C40F", textDark: true },
  { id: "lost_time", label: "Lost time", color: "#E67E22" },
  { id: "fatality", label: "Fatality", color: "#C0392B" },
];

const STATUSES = [
  { id: "open", label: "Open", color: "#C0392B" },
  { id: "investigating", label: "Under Investigation", color: "#2980B9" },
  { id: "action_assigned", label: "Corrective Action Assigned", color: "#E67E22" },
  { id: "verified", label: "Verified", color: "#8E44AD" },
  { id: "closed", label: "Closed", color: "#27AE60" },
];

const ROLES = ["Reporter", "Safety Officer", "Manager"];

const CONTRIBUTING_FACTORS = [
  { id: "fatigue", label: "Fatigue" },
  { id: "weather", label: "Weather" },
  { id: "ppe_noncompliance", label: "PPE non-compliance" },
  { id: "procedure_gap", label: "Procedure gap" },
  { id: "equipment_condition", label: "Equipment condition" },
  { id: "communication_failure", label: "Communication failure" },
  { id: "training_gap", label: "Training gap" },
  { id: "staffing_pressure", label: "Staffing pressure" },
  { id: "other", label: "Other" },
];
const cfLabel = (id) => (CONTRIBUTING_FACTORS.find((c) => c.id === id) || {}).label || id;

const CHANNELS = [
  { id: "dashboard", label: "Dashboard only" },
  { id: "email", label: "Email (simulated)" },
  { id: "sms", label: "SMS (simulated)" },
  { id: "email_sms", label: "Email + SMS (simulated)" },
];

const DEFAULT_RULES = [
  {
    id: "rule-cluster",
    name: "Rising near-miss / minor cluster",
    category: "any",
    per_category: true,
    severities: ["near_miss", "minor"],
    severity_field: "severity",
    threshold_count: 2,
    window_days: 90,
    notify_role: "Terminal HSE Manager",
    channel: "dashboard",
    notify_email: "",
    notify_whatsapp: "",
    enabled: true,
  },
  {
    id: "rule-severe",
    name: "Any lost-time or fatality incident",
    category: "any",
    per_category: false,
    severities: ["lost_time", "fatality"],
    severity_field: "severity",
    threshold_count: 1,
    window_days: 0,
    notify_role: "Terminal Manager + HSE Manager",
    channel: "email_sms",
    notify_email: "",
    notify_whatsapp: "",
    enabled: true,
  },
  {
    id: "rule-hipo",
    name: "High-potential near-miss (HiPo)",
    category: "any",
    per_category: false,
    severities: ["lost_time", "fatality"],
    severity_field: "potential_severity",
    threshold_count: 1,
    window_days: 0,
    notify_role: "Terminal Manager + HSE Manager",
    channel: "dashboard",
    notify_email: "",
    notify_whatsapp: "",
    enabled: true,
  },
  {
    id: "rule-fatigue",
    name: "Fatigue-linked incidents rising",
    category: "fatigue",
    per_category: false,
    severities: ["near_miss", "minor", "lost_time", "fatality"],
    severity_field: "severity",
    threshold_count: 2,
    window_days: 60,
    notify_role: "Shift Scheduling Lead",
    channel: "dashboard",
    notify_email: "",
    notify_whatsapp: "",
    enabled: true,
  },
];

const catById = (id) => CATEGORIES.find((c) => c.id === id) || CATEGORIES[0];
const sevById = (id) => SEVERITIES.find((s) => s.id === id) || SEVERITIES[0];
const statusById = (id) => STATUSES.find((s) => s.id === id) || STATUSES[0];
const channelLabel = (id) => (CHANNELS.find((c) => c.id === id) || {}).label || id;
const canManageRole = (role) => role === "Safety Officer" || role === "Manager";
const isManagerRole = (role) => role === "Manager";

/* ---------------------------------------------------------------------- */
/* Import mapping & normalization                                          */
/* ---------------------------------------------------------------------- */

function normalizeKey(s) {
  return (s || "").toString().toLowerCase().replace(/[^a-z0-9]/g, "");
}

const FIELD_SYNONYMS = {
  category: ["category", "incidenttype", "type", "hazardtype", "eventtype"],
  severity: ["severity", "consequence", "injurytype", "outcome"],
  status: ["status", "incidentstatus"],
  zone_location: ["zone", "location", "site", "area", "berth", "yard", "zonelocation"],
  equipment_involved: ["equipment", "asset", "machine", "equipmentinvolved"],
  weather_snapshot: ["weather", "conditions", "weatherconditions"],
  shift_context_hours: ["shifthours", "hoursintoshift", "shift"],
  witness_count: ["witnesses", "witnesscount", "numberofwitnesses"],
  assignee: ["assignee", "assignedto", "responsible", "owner", "actionowner"],
  due_date: ["duedate", "targetdate", "actiondate"],
  reported_by: ["reportedby", "reporter", "raisedby", "loggedby"],
  root_cause_summary: ["description", "rootcause", "incidentdescription", "narrative", "details", "summary"],
  suggested_corrective_action: ["correctiveaction", "action", "remedialaction", "recommendation"],
  timestamp: ["date", "incidentdate", "datetime", "reporteddate", "timestamp", "occurreddate"],
  site_code: ["sitecode", "portcode", "locode", "facility", "terminal", "unlocode"],
};

const IMPORT_TARGET_FIELDS = [
  { key: "category", label: "Category" },
  { key: "severity", label: "Severity" },
  { key: "status", label: "Status" },
  { key: "zone_location", label: "Zone / location" },
  { key: "equipment_involved", label: "Equipment involved" },
  { key: "weather_snapshot", label: "Weather snapshot" },
  { key: "shift_context_hours", label: "Hours into shift" },
  { key: "witness_count", label: "Witness count" },
  { key: "assignee", label: "Assignee" },
  { key: "due_date", label: "Due date" },
  { key: "reported_by", label: "Reported by" },
  { key: "root_cause_summary", label: "Description / root cause" },
  { key: "suggested_corrective_action", label: "Corrective action" },
  { key: "timestamp", label: "Date / timestamp" },
  { key: "site_code", label: "Site code (UN/LOCODE etc.)" },
];

function autoMapHeaders(headers) {
  const mapping = {};
  Object.keys(FIELD_SYNONYMS).forEach((field) => {
    const syns = FIELD_SYNONYMS[field];
    const match = headers.find((h) => syns.includes(normalizeKey(h)));
    mapping[field] = match || "";
  });
  return mapping;
}

function normalizeCategoryValue(v) {
  if (!v) return null;
  const n = normalizeKey(v);
  const found = CATEGORIES.find((c) => normalizeKey(c.label) === n || normalizeKey(c.shortLabel) === n || c.id === n);
  return found ? found.id : null;
}

function normalizeSeverityValue(v) {
  if (!v) return null;
  const n = normalizeKey(v);
  const found = SEVERITIES.find((s) => normalizeKey(s.label) === n || s.id === n);
  return found ? found.id : null;
}

function normalizeStatusValue(v) {
  if (!v) return null;
  const n = normalizeKey(v);
  const found = STATUSES.find((s) => normalizeKey(s.label) === n || s.id === n);
  return found ? found.id : null;
}

/* ---------------------------------------------------------------------- */
/* ISO-aligned interchange export                                          */
/* ---------------------------------------------------------------------- */

function griClassFor(severityId) {
  if (severityId === "fatality") return "Fatality";
  if (severityId === "lost_time") return "High-consequence injury";
  if (severityId === "minor") return "Recordable injury";
  return "Near-miss";
}

function buildIsoExportPayload(incidents) {
  return {
    schema: "quaywatch-hse-interchange-v1",
    generated_at: new Date().toISOString(),
    standard_notes:
      "Timestamps use ISO 8601. Severity classes are labelled to align with GRI 403 (2018) Occupational Health and Safety disclosure terms and ISO 45001 OH&S terminology. Dangerous-goods fields follow IMDG classification. There is no single universal ISO schema for HSE incident interchange, so this is a documented, field-mapped JSON structure intended to be crosswalked into other systems.",
    records: incidents.map((i) => ({
      incident_id: i.id,
      site_code: i.site_code || "",
      category: i.category,
      category_label: catById(i.category).label,
      severity: i.severity,
      severity_label: sevById(i.severity).label,
      gri_403_class: griClassFor(i.severity),
      status: i.status || "open",
      zone_location: i.zone_location || "",
      equipment_involved: i.equipment_involved || "",
      root_cause_summary: i.root_cause_summary || "",
      corrective_action: i.suggested_corrective_action || "",
      assignee: i.assignee || "",
      due_date: i.due_date || "",
      reported_by: i.reported_by || "",
      source_system: i.source || "quaywatch",
      occurred_at: i.timestamp,
      attachments_count: i.attachment_count || 0,
    })),
  };
}

function downloadIsoJson(incidents) {
  const payload = buildIsoExportPayload(incidents);
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `quaywatch-iso-export-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

/* ---------------------------------------------------------------------- */
/* Reporting periods & safety rate KPIs                                    */
/* ---------------------------------------------------------------------- */

function getPeriodRange(periodType, year, quarter, month) {
  if (periodType === "monthly" && month) {
    const start = new Date(`${month}-01T00:00:00.000Z`);
    const end = new Date(start);
    end.setUTCMonth(end.getUTCMonth() + 1);
    const label = start.toLocaleString("en-US", { month: "long", year: "numeric", timeZone: "UTC" });
    return { start, end, label };
  }
  if (periodType === "quarterly") {
    const qStartMonth = (quarter - 1) * 3;
    const start = new Date(Date.UTC(year, qStartMonth, 1));
    const end = new Date(Date.UTC(year, qStartMonth + 3, 1));
    return { start, end, label: `Q${quarter} ${year}` };
  }
  if (periodType === "yearly") {
    const start = new Date(Date.UTC(year, 0, 1));
    const end = new Date(Date.UTC(year + 1, 0, 1));
    return { start, end, label: `${year}` };
  }
  return { start: null, end: null, label: "All time" };
}

function filterIncidentsByPeriod(incidents, range) {
  if (!range.start) return incidents;
  return incidents.filter((i) => {
    const t = new Date(i.timestamp).getTime();
    return t >= range.start.getTime() && t < range.end.getTime();
  });
}

function calcSafetyRates(periodIncidents, hoursWorked) {
  const hours = parseFloat(hoursWorked) || 0;
  const recordable = periodIncidents.filter((i) => ["minor", "lost_time", "fatality"].includes(i.severity)).length;
  const lostTime = periodIncidents.filter((i) => ["lost_time", "fatality"].includes(i.severity)).length;
  const nearMiss = periodIncidents.filter((i) => i.severity === "near_miss").length;
  const fatalities = periodIncidents.filter((i) => i.severity === "fatality").length;
  const trir = hours > 0 ? (recordable * 200000) / hours : null;
  const ltifr = hours > 0 ? (lostTime * 1000000) / hours : null;
  return { recordable, lostTime, nearMiss, fatalities, trir, ltifr, hours };
}

const SAMPLE_INCIDENTS = [
  {
    id: "INC-0001",
    category: "struck_by",
    severity: "minor",
    potential_severity: "lost_time",
    contributing_factors: [],
    confidence: "high",
    classification_rationale:
      "Struck-by risk from limited operator visibility at a blind yard corner; no PPE or weather factors indicated.",
    status: "closed",
    assignee: "Yard Supervisor",
    due_date: "2026-06-10",
    zone_location: "Yard Block C14",
    equipment_involved: "Reach stacker",
    weather_snapshot: "Clear, 15 km/h wind",
    shift_context_hours: "6",
    witness_count: "1",
    root_cause_summary:
      "Reach stacker operator had limited visibility of ground personnel near a blind corner during container placement.",
    suggested_corrective_action:
      "Install convex mirrors and enforce radio check-in before entering the Block C14 blind corner.",
    category_details: { equipment_type: "Reach stacker", exclusion_zone_active: "No" },
    attachment_count: 0,
    reported_by: "J. Fernandes",
    ai_suggested: {
      category: "struck_by",
      severity: "minor",
      potential_severity: "lost_time",
      contributing_factors: [],
      confidence: "high",
    },
    human_corrected: false,
    history: [
      { timestamp: "2026-06-02T08:14:00Z", user: "J. Fernandes", action: "Logged incident" },
      { timestamp: "2026-06-09T10:00:00Z", user: "A. Rashid", action: "Status changed from Open to Closed" },
    ],
    timestamp: "2026-06-02T08:14:00Z",
  },
  {
    id: "INC-0002",
    category: "suspended_load",
    severity: "near_miss",
    potential_severity: "fatality",
    contributing_factors: ["weather"],
    confidence: "high",
    classification_rationale:
      "Load sway from high wind during a heavy lift created potential for a fatal strike on personnel below had the lift not been paused in time.",
    status: "open",
    assignee: "",
    due_date: "",
    zone_location: "Berth 3 Lift Zone",
    equipment_involved: "Quay crane 2",
    weather_snapshot: "Gusting, 32 km/h wind",
    shift_context_hours: "4",
    witness_count: "3",
    root_cause_summary:
      "High wind gusts during a 25-ton lift caused load sway; the lift was paused before contact.",
    suggested_corrective_action:
      "Lower the wind-speed threshold for suspended lifts from 30 km/h to 22 km/h.",
    category_details: { load_weight_tons: "25", wind_speed_kmh: "32", operator_shift_hours: "4" },
    attachment_count: 0,
    reported_by: "M. Al Nuaimi",
    ai_suggested: {
      category: "suspended_load",
      severity: "near_miss",
      potential_severity: "fatality",
      contributing_factors: ["weather"],
      confidence: "high",
    },
    human_corrected: false,
    history: [{ timestamp: "2026-06-05T11:40:00Z", user: "M. Al Nuaimi", action: "Logged incident" }],
    timestamp: "2026-06-05T11:40:00Z",
  },
  {
    id: "INC-0003",
    category: "suspended_load",
    severity: "near_miss",
    potential_severity: "lost_time",
    contributing_factors: ["procedure_gap"],
    confidence: "medium",
    classification_rationale:
      "Uneven weight distribution not caught before hoisting points to a manifest cross-check gap rather than an equipment failure.",
    status: "investigating",
    assignee: "Lift Planning Lead",
    due_date: "",
    zone_location: "Berth 1 Lift Zone",
    equipment_involved: "Quay crane 4",
    weather_snapshot: "Overcast, 28 km/h wind",
    shift_context_hours: "9",
    witness_count: "2",
    root_cause_summary:
      "Load began swinging during hoist due to uneven container weight distribution not flagged on the manifest.",
    suggested_corrective_action:
      "Cross-check manifest weight distribution against lift plan before hoisting begins.",
    category_details: { load_weight_tons: "18", wind_speed_kmh: "28", operator_shift_hours: "9" },
    attachment_count: 0,
    reported_by: "J. Fernandes",
    ai_suggested: {
      category: "suspended_load",
      severity: "near_miss",
      potential_severity: "lost_time",
      contributing_factors: ["procedure_gap"],
      confidence: "medium",
    },
    human_corrected: false,
    history: [
      { timestamp: "2026-06-11T15:05:00Z", user: "J. Fernandes", action: "Logged incident" },
      { timestamp: "2026-06-12T09:00:00Z", user: "A. Rashid", action: "Status changed from Open to Under Investigation" },
    ],
    timestamp: "2026-06-11T15:05:00Z",
  },
  {
    id: "INC-0004",
    category: "fatigue",
    severity: "near_miss",
    potential_severity: "lost_time",
    contributing_factors: ["fatigue", "staffing_pressure"],
    confidence: "high",
    classification_rationale:
      "Operator fatigue on hour 11 of a double shift directly caused the misjudged placement; scheduling pressure is the underlying driver.",
    status: "investigating",
    assignee: "Shift Scheduling Lead",
    due_date: "2026-07-05",
    zone_location: "RTG Row 7",
    equipment_involved: "RTG crane",
    weather_snapshot: "Clear, 10 km/h wind",
    shift_context_hours: "11",
    witness_count: "1",
    root_cause_summary:
      "RTG operator on hour 11 of a 12-hour shift misjudged stack alignment during a routine placement.",
    suggested_corrective_action: "Cap consecutive shift length at 10 hours for RTG operators.",
    category_details: {
      shift_length_hours: "12",
      consecutive_days: "5",
      time_since_break_hours: "4",
    },
    attachment_count: 0,
    reported_by: "M. Al Nuaimi",
    ai_suggested: {
      category: "fatigue",
      severity: "near_miss",
      potential_severity: "lost_time",
      contributing_factors: ["fatigue", "staffing_pressure"],
      confidence: "high",
    },
    human_corrected: false,
    history: [
      { timestamp: "2026-06-14T22:30:00Z", user: "M. Al Nuaimi", action: "Logged incident" },
      { timestamp: "2026-06-15T08:00:00Z", user: "A. Rashid", action: "Status changed from Open to Under Investigation" },
    ],
    timestamp: "2026-06-14T22:30:00Z",
  },
  {
    id: "INC-0005",
    category: "fatigue",
    severity: "near_miss",
    potential_severity: "minor",
    contributing_factors: ["fatigue"],
    confidence: "medium",
    classification_rationale:
      "Lane drift on a sixth consecutive night shift is consistent with cumulative fatigue rather than a one-off lapse.",
    status: "open",
    assignee: "",
    due_date: "",
    zone_location: "Yard Block B3",
    equipment_involved: "Yard truck",
    weather_snapshot: "Clear, 8 km/h wind",
    shift_context_hours: "10",
    witness_count: "0",
    root_cause_summary:
      "Yard truck driver on the sixth consecutive night shift drifted from the marked lane briefly before self-correcting.",
    suggested_corrective_action: "Introduce mandatory rest day after 4 consecutive night shifts.",
    category_details: {
      shift_length_hours: "10",
      consecutive_days: "6",
      time_since_break_hours: "5",
    },
    attachment_count: 0,
    reported_by: "J. Fernandes",
    ai_suggested: {
      category: "fatigue",
      severity: "near_miss",
      potential_severity: "minor",
      contributing_factors: ["fatigue"],
      confidence: "medium",
    },
    human_corrected: false,
    history: [{ timestamp: "2026-06-18T02:10:00Z", user: "J. Fernandes", action: "Logged incident" }],
    timestamp: "2026-06-18T02:10:00Z",
  },
  {
    id: "INC-0006",
    category: "mooring",
    severity: "minor",
    potential_severity: "lost_time",
    contributing_factors: [],
    confidence: "high",
    classification_rationale:
      "Snap-back from a parted mooring line under tension carries real injury potential for anyone within the exclusion zone.",
    status: "closed",
    assignee: "Marine Ops Supervisor",
    due_date: "2026-06-27",
    zone_location: "Berth 1",
    equipment_involved: "Mooring line - stern",
    weather_snapshot: "Moderate swell",
    shift_context_hours: "3",
    witness_count: "2",
    root_cause_summary:
      "A mooring line recoiled unexpectedly during vessel departure; a crew member was briefly within the snap-back zone.",
    suggested_corrective_action: "Re-mark snap-back exclusion zones with high-visibility paint at Berth 1.",
    category_details: {
      vessel_size: "Panamax",
      sea_state: "Moderate",
      mooring_line_type: "Synthetic fiber",
    },
    attachment_count: 0,
    reported_by: "M. Al Nuaimi",
    ai_suggested: {
      category: "mooring",
      severity: "minor",
      potential_severity: "lost_time",
      contributing_factors: [],
      confidence: "high",
    },
    human_corrected: false,
    history: [
      { timestamp: "2026-06-20T06:50:00Z", user: "M. Al Nuaimi", action: "Logged incident" },
      { timestamp: "2026-06-26T09:00:00Z", user: "A. Rashid", action: "Status changed from Corrective Action Assigned to Closed" },
    ],
    timestamp: "2026-06-20T06:50:00Z",
  },
  {
    id: "INC-0007",
    category: "fall_height",
    severity: "lost_time",
    potential_severity: "fatality",
    contributing_factors: ["ppe_noncompliance", "procedure_gap"],
    confidence: "medium",
    classification_rationale:
      "Initial description read as a minor slip, but the confirmed unclipped lanyard on a boom walkway indicates a genuine lost-time fall with fatal potential if unaddressed.",
    status: "action_assigned",
    assignee: "Crane Maintenance Lead",
    due_date: "2026-08-01",
    zone_location: "Quay Crane 4 - boom access",
    equipment_involved: "Quay crane 4",
    weather_snapshot: "Clear, 12 km/h wind",
    shift_context_hours: "2",
    witness_count: "1",
    root_cause_summary:
      "Technician fell 2.5m while accessing the boom walkway during scheduled maintenance; the fall-arrest lanyard was not anchored.",
    suggested_corrective_action: "Mandatory anchor-point inspection checklist before any boom access.",
    category_details: {
      height_meters: "2.5",
      fall_protection_used: "No",
      task_type: "Scheduled maintenance",
    },
    attachment_count: 0,
    reported_by: "J. Fernandes",
    ai_suggested: {
      category: "fall_height",
      severity: "minor",
      potential_severity: "fatality",
      contributing_factors: ["ppe_noncompliance"],
      confidence: "medium",
    },
    human_corrected: true,
    history: [
      { timestamp: "2026-06-22T09:25:00Z", user: "J. Fernandes", action: "Logged incident" },
      { timestamp: "2026-06-23T09:00:00Z", user: "A. Rashid", action: "Status changed from Open to Corrective Action Assigned" },
    ],
    timestamp: "2026-06-22T09:25:00Z",
  },
  {
    id: "INC-0008",
    category: "dangerous_goods",
    severity: "near_miss",
    potential_severity: "fatality",
    contributing_factors: ["procedure_gap"],
    confidence: "high",
    classification_rationale:
      "Undeclared lithium batteries in general cargo pose a real fire and explosion risk that could easily have gone undetected without the gate inspection.",
    status: "action_assigned",
    assignee: "Customs Liaison",
    due_date: "2026-07-20",
    zone_location: "Gate 2 / Container Yard",
    equipment_involved: "N/A",
    weather_snapshot: "Clear",
    shift_context_hours: "5",
    witness_count: "2",
    root_cause_summary:
      "A container manifested as general cargo was found to contain an unlabeled Class 3 flammable liquid during a routine inspection.",
    suggested_corrective_action:
      "Increase random inspection rate for high-risk trade lanes flagged by the customs risk profile.",
    category_details: {
      imdg_class: "Class 3 (Flammable liquid)",
      cargo_id: "MSKU-771204",
      discovery_method: "Routine gate inspection",
    },
    attachment_count: 0,
    reported_by: "M. Al Nuaimi",
    ai_suggested: {
      category: "dangerous_goods",
      severity: "near_miss",
      potential_severity: "fatality",
      contributing_factors: ["procedure_gap"],
      confidence: "high",
    },
    human_corrected: false,
    history: [
      { timestamp: "2026-06-25T13:15:00Z", user: "M. Al Nuaimi", action: "Logged incident" },
      { timestamp: "2026-06-26T09:00:00Z", user: "A. Rashid", action: "Status changed from Open to Corrective Action Assigned" },
    ],
    timestamp: "2026-06-25T13:15:00Z",
  },
  {
    id: "INC-0009",
    category: "cargo_stability",
    severity: "minor",
    potential_severity: "lost_time",
    contributing_factors: ["procedure_gap"],
    confidence: "medium",
    classification_rationale:
      "The dunnage placement error causing a partial stack shift is consistent with a stacking procedure gap rather than equipment failure.",
    status: "closed",
    assignee: "Break Bulk Supervisor",
    due_date: "2026-07-02",
    zone_location: "Break Bulk Shed 2",
    equipment_involved: "Mobile crane, wire slings",
    weather_snapshot: "Clear, 14 km/h wind",
    shift_context_hours: "7",
    witness_count: "2",
    root_cause_summary:
      "A steel coil stack shifted during offloading after dunnage was placed unevenly, causing one coil to roll partially off the stack.",
    suggested_corrective_action: "Enforce standard dunnage spacing checklist before coil stacking begins.",
    category_details: { cargo_type: "Steel coils", lifting_gear_type: "Wire slings", stack_condition: "Uneven dunnage" },
    attachment_count: 0,
    reported_by: "J. Fernandes",
    ai_suggested: {
      category: "cargo_stability",
      severity: "minor",
      potential_severity: "lost_time",
      contributing_factors: ["procedure_gap"],
      confidence: "medium",
    },
    human_corrected: false,
    history: [
      { timestamp: "2026-06-28T10:05:00Z", user: "J. Fernandes", action: "Logged incident" },
      { timestamp: "2026-07-01T09:00:00Z", user: "A. Rashid", action: "Status changed from Corrective Action Assigned to Closed" },
    ],
    timestamp: "2026-06-28T10:05:00Z",
  },
  {
    id: "INC-0010",
    category: "roro_marshalling",
    severity: "near_miss",
    potential_severity: "fatality",
    contributing_factors: [],
    confidence: "high",
    classification_rationale:
      "A terminal tractor passing within a metre of a pedestrian in an active marshalling lane has clear fatal struck-by potential.",
    status: "open",
    assignee: "",
    due_date: "",
    zone_location: "RoRo Marshalling Yard 1",
    equipment_involved: "Terminal tractor",
    weather_snapshot: "Clear, 10 km/h wind",
    shift_context_hours: "6",
    witness_count: "1",
    root_cause_summary:
      "A terminal tractor moving vehicles toward the ship ramp came within a metre of a marshalling yard worker crossing between vehicle rows.",
    suggested_corrective_action: "Mark dedicated pedestrian walkways through the RoRo marshalling yard.",
    category_details: { vehicle_type: "Passenger vehicles (import)", ramp_involved: "No", securing_method: "N/A" },
    attachment_count: 0,
    reported_by: "M. Al Nuaimi",
    ai_suggested: {
      category: "roro_marshalling",
      severity: "near_miss",
      potential_severity: "fatality",
      contributing_factors: [],
      confidence: "high",
    },
    human_corrected: false,
    history: [{ timestamp: "2026-07-03T14:20:00Z", user: "M. Al Nuaimi", action: "Logged incident" }],
    timestamp: "2026-07-03T14:20:00Z",
  },
  {
    id: "INC-0011",
    category: "rail_operations",
    severity: "lost_time",
    potential_severity: "fatality",
    contributing_factors: ["procedure_gap"],
    confidence: "high",
    classification_rationale:
      "Manual coupling without confirming the wagon had fully stopped is a known high-risk practice with potential for far more serious crush injury.",
    status: "investigating",
    assignee: "Rail Operations Lead",
    due_date: "2026-07-25",
    zone_location: "Rail Siding 3",
    equipment_involved: "Freight wagon",
    weather_snapshot: "Clear",
    shift_context_hours: "8",
    witness_count: "2",
    root_cause_summary:
      "A shunter sustained a hand injury while manually coupling wagons during a siding shunting move without confirming the wagon was fully stopped.",
    suggested_corrective_action: "Reinforce stop-confirm-couple procedure and add a spotter for all manual coupling.",
    category_details: { wagon_type: "Container flat wagon", shunting_operation: "Yes", track_section: "Siding 3, Point 2" },
    attachment_count: 0,
    reported_by: "J. Fernandes",
    ai_suggested: {
      category: "rail_operations",
      severity: "lost_time",
      potential_severity: "fatality",
      contributing_factors: ["procedure_gap"],
      confidence: "high",
    },
    human_corrected: false,
    history: [
      { timestamp: "2026-07-08T07:40:00Z", user: "J. Fernandes", action: "Logged incident" },
      { timestamp: "2026-07-08T11:00:00Z", user: "A. Rashid", action: "Status changed from Open to Under Investigation" },
    ],
    timestamp: "2026-07-08T07:40:00Z",
  },
];

/* ---------------------------------------------------------------------- */
/* Rule engine                                                             */
/* ---------------------------------------------------------------------- */

function evaluateAllRules(rules, incidents) {
  const now = Date.now();
  const results = [];
  rules
    .filter((r) => r.enabled)
    .forEach((rule) => {
      const windowMs = rule.window_days > 0 ? rule.window_days * 86400000 : Infinity;
      const sevField = rule.severity_field === "potential_severity" ? "potential_severity" : "severity";
      const candidates = incidents.filter((inc) => {
        const catMatch = rule.category === "any" || inc.category === rule.category;
        const sevMatch = rule.severities.includes(inc[sevField] || inc.severity);
        const t = new Date(inc.timestamp).getTime();
        const withinWindow = windowMs === Infinity ? true : now - t <= windowMs;
        return catMatch && sevMatch && withinWindow;
      });
      if (rule.category === "any" && rule.per_category) {
        const groups = {};
        candidates.forEach((inc) => {
          groups[inc.category] = groups[inc.category] || [];
          groups[inc.category].push(inc);
        });
        Object.entries(groups).forEach(([catId, list]) => {
          if (list.length >= rule.threshold_count) {
            results.push({ rule, category: catId, count: list.length, incidentIds: list.map((i) => i.id) });
          }
        });
      } else if (candidates.length >= rule.threshold_count) {
        results.push({
          rule,
          category: rule.category === "any" ? null : rule.category,
          count: candidates.length,
          incidentIds: candidates.map((i) => i.id),
        });
      }
    });
  return results;
}

function describeRule(rule) {
  const sevLabels = rule.severities.map((s) => sevById(s).label.toLowerCase()).join("/");
  const catPhrase =
    rule.category === "any"
      ? rule.per_category
        ? "in any single category"
        : "across all categories combined"
      : `in ${catById(rule.category).label}`;
  const windowPhrase = rule.window_days > 0 ? `within ${rule.window_days} days` : "at any time";
  const sevFieldPhrase = rule.severity_field === "potential_severity" ? " (based on potential severity, i.e. HiPo)" : "";
  return `Alert when >= ${rule.threshold_count} ${sevLabels} incident${
    rule.threshold_count === 1 ? "" : "s"
  } occur ${catPhrase}, ${windowPhrase}${sevFieldPhrase}.`;
}

function alertKey(a) {
  return `${a.rule.id}::${a.category || "all"}`;
}

function buildAlertMessage(a) {
  const catLine = a.category ? `Category: ${catById(a.category).label}` : "Category: All categories";
  const subject = `Quaywatch Alert: ${a.rule.name}${a.category ? ` (${catById(a.category).label})` : ""}`;
  const bodyLines = [
    `Rule: ${a.rule.name}`,
    catLine,
    `Matching incidents: ${a.count}`,
    `Incident IDs: ${a.incidentIds.join(", ")}`,
    "",
    "Sent from Quaywatch HSE incident intelligence.",
  ];
  return { subject, body: bodyLines.join("\n") };
}

function mailtoLink(rule, subject, body) {
  const to = rule.notify_email ? encodeURIComponent(rule.notify_email.trim()) : "";
  return `mailto:${to}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

function whatsappLink(rule, subject, body) {
  const digits = (rule.notify_whatsapp || "").replace(/[^0-9]/g, "");
  const text = `${subject}\n\n${body}`;
  return `https://wa.me/${digits}?text=${encodeURIComponent(text)}`;
}

/* ---------------------------------------------------------------------- */
/* Claude API helper                                                       */
/* ---------------------------------------------------------------------- */

async function callClaude(systemPrompt, userContent, maxTokens = 1000) {
  const response = await fetch("/api/messages", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "claude-sonnet-4-6",
      max_tokens: maxTokens,
      system: systemPrompt,
      messages: [{ role: "user", content: userContent }],
    }),
  });
  if (!response.ok) throw new Error(`API error: ${response.status}`);
  const data = await response.json();
  const text = (data.content || [])
    .filter((b) => b.type === "text")
    .map((b) => b.text)
    .join("\n");
  return text;
}

function parseJsonLoose(text) {
  const cleaned = text.replace(/```json|```/g, "").trim();
  return JSON.parse(cleaned);
}

const CLASSIFY_SYSTEM_PROMPT = `You are an HSE incident classification engine for port terminal operations spanning containers, general cargo, break bulk, RoRo, and rail. Given a raw incident description (and optionally one or more photos, or a single frame extracted from a video) plus contextual fields, classify the incident and extract structured data.

The description may be in English or another language, or may be an imperfect voice-to-text transcription with grammatical errors, filler words, or transcription mistakes - reason around this rather than penalizing unclear phrasing. Always respond in English regardless of the input language.

Categories (choose exactly one PRIMARY id - the most direct, severe cause):
- struck_by: Struck-by / caught-between incidents involving moving containers, vehicles or machinery, EXCEPT when the incident is specifically a RoRo vehicle-marshalling or rail-wagon context - use roro_marshalling or rail_operations instead for those
- suspended_load: Incidents during crane lifts / suspended loads over lift zones (typically container or unitized loads)
- fatigue: Operator fatigue-linked near-misses (crane/yard equipment operators)
- mooring: Mooring / snap-back zone incidents during vessel mooring
- fall_height: Falls from height (lashing, crane maintenance access etc.)
- confined_space: Confined space entry incidents (vessel holds, tanks)
- dangerous_goods: Dangerous goods / hazardous cargo handling incidents
- equipment_precursor: Equipment failure precursor patterns (vibration, wear, temperature anomalies) not yet a safety incident
- cargo_stability: Break bulk / general cargo handling incidents - cargo stack or stow instability, sling or lifting-gear failure on non-containerized cargo (steel coils, timber, bagged or palletized goods, project cargo)
- roro_marshalling: RoRo vehicle marshalling yard or ship ramp incidents - vehicle-pedestrian contact in the marshalling yard, ramp falls, vehicle securing/lashing failure, vehicle rollover
- rail_operations: Rail siding / shunting incidents - struck by a wagon during shunting, coupling/uncoupling injury, wagon loading/unloading incidents, level-crossing incidents

If more than one hazard type is present (e.g. a fatigued operator caused a struck-by incident), choose the PRIMARY category as the most direct cause of the actual or potential harm, and list the others under contributing_factors instead of inventing a second category.

Severity (choose exactly one - the ACTUAL outcome that occurred): near_miss, minor, lost_time, fatality

potential_severity (choose exactly one, same scale) - the worst credible outcome if this exact scenario recurred, independent of what actually happened this time. This is frequently HIGHER than the actual severity for near-misses that had real potential for serious harm (a "high-potential near-miss") - do not default it to match severity out of habit; assess it deliberately from the mechanics of what almost happened.

contributing_factors: a list of zero or more items from this fixed vocabulary only - fatigue, weather, ppe_noncompliance, procedure_gap, equipment_condition, communication_failure, training_gap, staffing_pressure, other. Do not invent new labels. Leave the list empty if none are clearly indicated.

confidence (choose exactly one): high, medium, low - how certain you are in this classification given what was provided. Use "low" when the description is vague, contradictory, or when photo evidence conflicts with the text description. Use "medium" when key details (like severity) had to be inferred rather than stated directly.

classification_rationale: one plain sentence explaining why you chose this category and severity - this is shown to a human reviewer, so make it genuinely informative, not generic.

If images are provided, incorporate visible evidence (hazards, PPE compliance, equipment condition, environmental/weather conditions) into your root_cause_summary and confidence. If an image is a single frame extracted from a video, treat it only as a still photo of the scene and do not assume knowledge of motion or events outside that frame.

Respond with ONLY valid JSON, no markdown fences, no preamble, matching exactly this shape:
{"category":"<one id above>","severity":"<one severity above>","potential_severity":"<one severity above>","contributing_factors":["<zero or more from the fixed vocabulary>"],"confidence":"high|medium|low","classification_rationale":"<one sentence>","root_cause_summary":"<1-2 plain sentences>","suggested_corrective_action":"<1 sentence>","category_details":{"<field_key>":"<value or null>"}}

Only include category_details keys relevant to the chosen category, using these field keys per category:
struck_by: equipment_type, exclusion_zone_active
suspended_load: load_weight_tons, wind_speed_kmh, operator_shift_hours
fatigue: shift_length_hours, consecutive_days, time_since_break_hours
mooring: vessel_size, sea_state, mooring_line_type
fall_height: height_meters, fall_protection_used, task_type
confined_space: gas_test_reading, permit_number, entry_exit_logged
dangerous_goods: imdg_class, cargo_id, discovery_method
equipment_precursor: equipment_id, vibration_reading, temperature_reading
cargo_stability: cargo_type, lifting_gear_type, stack_condition
roro_marshalling: vehicle_type, ramp_involved, securing_method
rail_operations: wagon_type, shunting_operation, track_section

Use null for any category_details field not mentioned or clearly implied. Do not invent specific numbers that are not stated.

Two worked examples of the reasoning expected (do not copy their wording, they are for calibration only):

Example A - potential severity diverging from actual severity:
Input: "25-ton container swung out during a lift at Berth 3 in gusting wind and passed about a metre over two dockworkers standing below before the crane operator stopped it. No one was hurt."
Expected reasoning: severity is "near_miss" (no injury occurred), but potential_severity is "fatality" (an uncontrolled swinging load of that weight passing over workers below has genuine potential for fatal crush injury), contributing_factors includes "weather", confidence "high" since the mechanics are clearly described.

Example B - RoRo vs generic struck-by boundary:
Input: "A worker in the vehicle marshalling yard was almost hit by a terminal tractor moving a car toward the ship ramp."
Expected reasoning: category is "roro_marshalling", not "struck_by", because the context is specifically a RoRo marshalling yard and ship ramp movement, which has its own category by design.`;

const REPORT_SYSTEM_PROMPT = `You are generating a concise ISO 45001-aligned HSE compliance report for port terminal management, based on aggregated incident data provided as JSON. The JSON may include a "period_label" (e.g. a month, quarter, or year), "safety_rates" (TRIR, LTIFR and related counts), "contributing_factors" (a tally of contributing-factor tags across incidents), and "ai_accuracy" (how often a human had to correct the AI's suggested classification) - if present, reference these specifically in the Executive Summary and Trend Analysis rather than ignoring them; contributing-factor tallies are especially useful for the Top Recurring Root Causes section since a factor like fatigue can recur across several different incident categories. Structure your response with these sections, each starting with a line beginning "## ": Executive Summary, Incident Breakdown, Trend Analysis, Top Recurring Root Causes, Corrective Action Log, Watch List. Use lines beginning "- " for bullet points within a section. Be concise, factual and professional. Do not invent data that is not present in the input JSON.`;

/* ---------------------------------------------------------------------- */
/* Media helpers (photo / video-frame capture)                             */
/* ---------------------------------------------------------------------- */

function fileToResizedBase64(file, maxWidth = 480, quality = 0.6) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("read failed"));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error("image decode failed"));
      img.onload = () => {
        const scale = Math.min(1, maxWidth / img.width);
        const w = Math.round(img.width * scale);
        const h = Math.round(img.height * scale);
        const canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL("image/jpeg", quality).split(",")[1]);
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

function videoFileToFrameBase64(file, seekTime = 0.3, maxWidth = 480, quality = 0.6) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const video = document.createElement("video");
    video.src = url;
    video.muted = true;
    video.playsInline = true;
    video.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("video load failed"));
    };
    video.onloadedmetadata = () => {
      video.currentTime = Math.min(seekTime, Math.max(0, video.duration - 0.1));
    };
    video.onseeked = () => {
      const scale = Math.min(1, maxWidth / video.videoWidth);
      const w = Math.round(video.videoWidth * scale);
      const h = Math.round(video.videoHeight * scale);
      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d");
      ctx.drawImage(video, 0, 0, w, h);
      URL.revokeObjectURL(url);
      resolve(canvas.toDataURL("image/jpeg", quality).split(",")[1]);
    };
  });
}

/* ---------------------------------------------------------------------- */
/* Excel export                                                            */
/* ---------------------------------------------------------------------- */

function exportIncidentsToExcel(incidents) {
  const rows = incidents.map((i) => ({
    ID: i.id,
    Category: catById(i.category).label,
    Severity: sevById(i.severity).label,
    Status: statusById(i.status || "open").label,
    Zone: i.zone_location || "",
    Equipment: i.equipment_involved || "",
    Weather: i.weather_snapshot || "",
    "Hours into shift": i.shift_context_hours || "",
    Witnesses: i.witness_count || "",
    "Root cause": i.root_cause_summary || "",
    "Corrective action": i.suggested_corrective_action || "",
    Assignee: i.assignee || "",
    "Due date": i.due_date || "",
    "Reported by": i.reported_by || "",
    Attachments: i.attachment_count || 0,
    Timestamp: i.timestamp,
  }));
  const ws = XLSX.utils.json_to_sheet(rows);
  ws["!cols"] = Object.keys(rows[0] || {}).map(() => ({ wch: 20 }));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Incidents");
  XLSX.writeFile(wb, `quaywatch-incidents-${new Date().toISOString().slice(0, 10)}.xlsx`);
}

/* ---------------------------------------------------------------------- */
/* Small building blocks                                                   */
/* ---------------------------------------------------------------------- */

function Pill({ color, textDark, children, icon: Icon }) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        padding: "4px 10px",
        borderRadius: 999,
        fontSize: 12,
        fontWeight: 600,
        fontFamily: "'IBM Plex Sans', sans-serif",
        background: color,
        color: textDark ? "#10233A" : "#FFFFFF",
        whiteSpace: "nowrap",
      }}
    >
      {Icon && <Icon size={13} />}
      {children}
    </span>
  );
}

function Field({ label, children }) {
  return (
    <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 12.5 }}>
      <span style={{ color: "#5B6B7C", fontWeight: 600, letterSpacing: "0.02em" }}>{label.toUpperCase()}</span>
      {children}
    </label>
  );
}

const inputStyle = {
  padding: "9px 10px",
  borderRadius: 6,
  border: "1px solid #D6DCE2",
  fontSize: 14,
  fontFamily: "'IBM Plex Sans', sans-serif",
  color: "#10233A",
  background: "#FCFDFE",
  outline: "none",
};

const cardStyle = {
  background: "#FFFFFF",
  borderRadius: 10,
  border: "1px solid #E2E7EB",
  boxShadow: "0 1px 2px rgba(16,35,58,0.04)",
};

const smallButtonStyle = {
  display: "inline-flex",
  alignItems: "center",
  gap: 6,
  padding: "8px 12px",
  borderRadius: 6,
  border: "1px solid #D6DCE2",
  background: "#FFFFFF",
  color: "#10233A",
  fontSize: 12.5,
  fontWeight: 600,
  cursor: "pointer",
};

const iconButtonStyle = {
  display: "flex",
  alignItems: "center",
  gap: 4,
  padding: "6px 10px",
  borderRadius: 6,
  border: "1px solid #D6DCE2",
  background: "#FFF",
  fontSize: 12.5,
  fontWeight: 600,
  color: "#10233A",
};

/* ---------------------------------------------------------------------- */
/* Main app                                                                */
/* ---------------------------------------------------------------------- */

export default function App() {
  const [view, setView] = useState("intake");
  const [incidents, setIncidents] = useState([]);
  const [rules, setRules] = useState(DEFAULT_RULES);
  const [notifications, setNotifications] = useState([]);
  const [initializing, setInitializing] = useState(true);
  const [dataReady, setDataReady] = useState(false);

  const [currentUser, setCurrentUser] = useState(null);
  const [showUserModal, setShowUserModal] = useState(false);
  const [userDraftName, setUserDraftName] = useState("");
  const [userDraftRole, setUserDraftRole] = useState("Reporter");

  const role = currentUser ? currentUser.role : "Reporter";
  const canManage = canManageRole(role);
  const isManager = isManagerRole(role);

  const [rawText, setRawText] = useState("");
  const [zone, setZone] = useState("");
  const [equipment, setEquipment] = useState("");
  const [weather, setWeather] = useState("");
  const [shiftHours, setShiftHours] = useState("");
  const [witnessCount, setWitnessCount] = useState("");

  const [attachments, setAttachments] = useState([]);
  const [attachmentError, setAttachmentError] = useState(null);

  const [isRecording, setIsRecording] = useState(false);
  const [speechError, setSpeechError] = useState(null);
  const recognitionRef = useRef(null);
  const speechSupported =
    typeof window !== "undefined" && !!(window.SpeechRecognition || window.webkitSpeechRecognition);

  const [analysis, setAnalysis] = useState(null);
  const [aiSuggestion, setAiSuggestion] = useState(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [analyzeError, setAnalyzeError] = useState(null);
  const [savedFlash, setSavedFlash] = useState(null);

  const [report, setReport] = useState(null);
  const [generatingReport, setGeneratingReport] = useState(false);
  const [reportError, setReportError] = useState(null);

  const [attachmentCache, setAttachmentCache] = useState({});
  const [expandedId, setExpandedId] = useState(null);
  const [statusFilter, setStatusFilter] = useState("all");
  const [fieldDrafts, setFieldDrafts] = useState({});

  const [csvHeaders, setCsvHeaders] = useState([]);
  const [csvRows, setCsvRows] = useState([]);
  const [fieldMapping, setFieldMapping] = useState({});
  const [importing, setImporting] = useState(false);
  const [importProgress, setImportProgress] = useState(null);
  const [importSummary, setImportSummary] = useState(null);
  const [importError, setImportError] = useState(null);

  const [periodType, setPeriodType] = useState("all");
  const now = new Date();
  const [periodMonth, setPeriodMonth] = useState(
    `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`
  );
  const [periodQuarter, setPeriodQuarter] = useState(Math.floor(now.getMonth() / 3) + 1);
  const [periodYear, setPeriodYear] = useState(now.getFullYear());
  const [hoursWorked, setHoursWorked] = useState("");

  useEffect(() => {
    (async () => {
      let loadedIncidents = [];
      let loadedRules = null;
      let loadedNotifications = [];
      let loadedUser = null;
      try {
        const r = await window.storage.get("incidents", true);
        if (r && r.value) loadedIncidents = JSON.parse(r.value);
      } catch (e) {}
      try {
        const r = await window.storage.get("hse_rules", true);
        if (r && r.value) loadedRules = JSON.parse(r.value);
      } catch (e) {}
      try {
        const r = await window.storage.get("hse_notifications", true);
        if (r && r.value) loadedNotifications = JSON.parse(r.value);
      } catch (e) {}
      try {
        const r = await window.storage.get("current_user_v1", false);
        if (r && r.value) loadedUser = JSON.parse(r.value);
      } catch (e) {}
      setIncidents(loadedIncidents);
      if (loadedRules && loadedRules.length) {
        setRules(loadedRules);
      } else {
        setRules(DEFAULT_RULES);
        try {
          await window.storage.set("hse_rules", JSON.stringify(DEFAULT_RULES), true);
        } catch (e) {}
      }
      setNotifications(loadedNotifications);
      if (loadedUser && loadedUser.name) {
        setCurrentUser(loadedUser);
      } else {
        setShowUserModal(true);
      }
      setInitializing(false);
      setDataReady(true);
    })();
  }, []);

  const persist = useCallback(async (next) => {
    setIncidents(next);
    try {
      await window.storage.set("incidents", JSON.stringify(next), true);
    } catch (e) {
      console.error("Storage error", e);
    }
  }, []);

  const persistRules = useCallback(async (next) => {
    setRules(next);
    try {
      await window.storage.set("hse_rules", JSON.stringify(next), true);
    } catch (e) {
      console.error("Storage error", e);
    }
  }, []);

  function handleConfirmUser() {
    if (!userDraftName.trim()) return;
    const user = { name: userDraftName.trim(), role: userDraftRole };
    setCurrentUser(user);
    setShowUserModal(false);
    window.storage.set("current_user_v1", JSON.stringify(user), false).catch((e) => console.error(e));
  }

  function openSwitchUser() {
    setUserDraftName(currentUser ? currentUser.name : "");
    setUserDraftRole(currentUser ? currentUser.role : "Reporter");
    setShowUserModal(true);
  }

  const activeAlerts = useMemo(() => evaluateAllRules(rules, incidents), [rules, incidents]);

  const prevKeysRef = useRef(null);
  useEffect(() => {
    if (!dataReady) return;
    const currentKeys = new Set(activeAlerts.map(alertKey));
    if (prevKeysRef.current === null) {
      prevKeysRef.current = currentKeys;
      return;
    }
    const newOnes = activeAlerts.filter((a) => !prevKeysRef.current.has(alertKey(a)));
    if (newOnes.length) {
      const newNotifs = newOnes.map((a) => ({
        id: `ntf-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        timestamp: new Date().toISOString(),
        message: `Would notify ${a.rule.notify_role} via ${channelLabel(a.rule.channel)} - "${a.rule.name}"${
          a.category ? ` (${catById(a.category).label})` : ""
        }: ${a.count} matching incident${a.count === 1 ? "" : "s"}.`,
      }));
      setNotifications((prev) => {
        const next = [...newNotifs, ...prev].slice(0, 50);
        window.storage.set("hse_notifications", JSON.stringify(next), true).catch((e) => console.error(e));
        return next;
      });
    }
    prevKeysRef.current = currentKeys;
  }, [activeAlerts, dataReady]);

  function resetForm() {
    setRawText("");
    setZone("");
    setEquipment("");
    setWeather("");
    setShiftHours("");
    setWitnessCount("");
    setAnalysis(null);
    setAiSuggestion(null);
    setAnalyzeError(null);
    setAttachments([]);
    setAttachmentError(null);
  }

  async function handleFileSelect(e) {
    const files = Array.from(e.target.files || []);
    e.target.value = "";
    if (!files.length) return;
    setAttachmentError(null);
    const room = 5 - attachments.length;
    if (room <= 0) {
      setAttachmentError("Maximum 5 attachments per incident.");
      return;
    }
    const toProcess = files.slice(0, room);
    for (const file of toProcess) {
      try {
        let b64, kind;
        if (file.type.startsWith("image/")) {
          b64 = await fileToResizedBase64(file);
          kind = "photo";
        } else if (file.type.startsWith("video/")) {
          b64 = await videoFileToFrameBase64(file);
          kind = "video_frame";
        } else {
          setAttachmentError("Unsupported file type - attach an image or video.");
          continue;
        }
        setAttachments((prev) => [...prev, { data: b64, media_type: "image/jpeg", kind }]);
      } catch (err) {
        setAttachmentError("Could not process one of the files.");
      }
    }
    if (files.length > room) {
      setAttachmentError(`Only added ${room} file(s) - maximum 5 attachments per incident.`);
    }
  }

  function removeAttachment(idx) {
    setAttachments((prev) => prev.filter((_, i) => i !== idx));
  }

  function handleCsvUpload(e) {
    const file = e.target.files && e.target.files[0];
    e.target.value = "";
    if (!file) return;
    setImportError(null);
    setImportSummary(null);
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        const headers = results.meta.fields || [];
        if (!headers.length) {
          setImportError("Could not find any columns in that file.");
          return;
        }
        setCsvHeaders(headers);
        setCsvRows(results.data);
        setFieldMapping(autoMapHeaders(headers));
      },
      error: () => setImportError("Could not parse that CSV file."),
    });
  }

  function clearImportStaging() {
    setCsvHeaders([]);
    setCsvRows([]);
    setFieldMapping({});
    setImportSummary(null);
    setImportError(null);
  }

  async function runImport() {
    if (!csvRows.length) return;
    setImporting(true);
    setImportError(null);
    const reporterName = currentUser && currentUser.name ? currentUser.name : "Unknown";
    let classifiedCount = 0;
    const newRecords = [];
    setImportProgress({ done: 0, total: csvRows.length });
    for (let idx = 0; idx < csvRows.length; idx++) {
      const row = csvRows[idx];
      const get = (field) => (fieldMapping[field] ? (row[fieldMapping[field]] || "") : "");
      let category = normalizeCategoryValue(get("category"));
      let severity = normalizeSeverityValue(get("severity"));
      let potentialSeverity = null;
      let contributingFactors = [];
      let confidence = "medium";
      const description = get("root_cause_summary") || get("suggested_corrective_action") || "";
      if ((!category || !severity) && description) {
        try {
          const text = await callClaude(
            CLASSIFY_SYSTEM_PROMPT,
            `Incident description:\n${description}\n\nContext:\nZone/location: ${
              get("zone_location") || "not provided"
            }\nEquipment involved: ${get("equipment_involved") || "not provided"}`,
            700
          );
          const parsed = parseJsonLoose(text);
          if (!category) category = parsed.category;
          if (!severity) severity = parsed.severity;
          potentialSeverity = parsed.potential_severity || severity;
          contributingFactors = parsed.contributing_factors || [];
          confidence = parsed.confidence || "medium";
          classifiedCount++;
        } catch (e) {
          /* fall through to defaults below */
        }
      }
      category = category || "equipment_precursor";
      severity = severity || "near_miss";
      potentialSeverity = potentialSeverity || severity;
      const rawDate = get("timestamp");
      const parsedDate = rawDate ? new Date(rawDate) : null;
      const timestamp =
        parsedDate && !isNaN(parsedDate.getTime()) ? parsedDate.toISOString() : new Date().toISOString();
      const nextId = `SEN-${String(incidents.length + newRecords.length + 1).padStart(4, "0")}`;
      newRecords.push({
        id: nextId,
        category,
        severity,
        potential_severity: potentialSeverity,
        contributing_factors: contributingFactors,
        confidence,
        classification_rationale: "",
        status: normalizeStatusValue(get("status")) || "open",
        assignee: get("assignee"),
        due_date: get("due_date"),
        zone_location: get("zone_location"),
        equipment_involved: get("equipment_involved"),
        weather_snapshot: get("weather_snapshot"),
        shift_context_hours: get("shift_context_hours"),
        witness_count: get("witness_count"),
        root_cause_summary: description || "(imported without a description field)",
        suggested_corrective_action: get("suggested_corrective_action"),
        category_details: {},
        attachment_count: 0,
        reported_by: get("reported_by") || reporterName,
        source: "senyar_import",
        site_code: get("site_code"),
        history: [
          { timestamp: new Date().toISOString(), user: reporterName, action: "Imported from external HSE system" },
        ],
        timestamp,
      });
      setImportProgress({ done: idx + 1, total: csvRows.length });
    }
    const next = [...incidents, ...newRecords];
    await persist(next);
    setImportSummary({ imported: newRecords.length, classified: classifiedCount });
    setCsvHeaders([]);
    setCsvRows([]);
    setImporting(false);
    setImportProgress(null);
  }

  function toggleRecording() {
    if (!speechSupported) {
      setSpeechError("Voice input isn't supported in this browser.");
      return;
    }
    if (isRecording) {
      recognitionRef.current && recognitionRef.current.stop();
      return;
    }
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    const rec = new SR();
    rec.continuous = true;
    rec.interimResults = false;
    rec.lang = "en-US";
    rec.onresult = (e) => {
      let finalText = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        if (e.results[i].isFinal) finalText += e.results[i][0].transcript + " ";
      }
      if (finalText) setRawText((prev) => (prev ? prev.trim() + " " : "") + finalText.trim());
    };
    rec.onerror = (e) => {
      setSpeechError("Microphone error: " + (e.error || "unknown"));
      setIsRecording(false);
    };
    rec.onend = () => setIsRecording(false);
    recognitionRef.current = rec;
    setSpeechError(null);
    try {
      rec.start();
      setIsRecording(true);
    } catch (err) {
      setSpeechError("Could not start the microphone.");
    }
  }

  async function handleAnalyze() {
    if (!rawText.trim() && attachments.length === 0) return;
    setAnalyzing(true);
    setAnalyzeError(null);
    setAnalysis(null);
    setAiSuggestion(null);
    try {
      const userPromptText = `Incident description:\n${
        rawText || "(no text description provided - classify from the image(s) only)"
      }\n\nContext:\nZone/location: ${zone || "not provided"}\nEquipment involved: ${
        equipment || "not provided"
      }\nWeather: ${weather || "not provided"}\nHours into shift: ${
        shiftHours || "not provided"
      }\nWitness count: ${witnessCount || "not provided"}`;

      let content = userPromptText;
      if (attachments.length > 0) {
        content = [
          ...attachments.map((a) => ({ type: "image", source: { type: "base64", media_type: a.media_type, data: a.data } })),
          { type: "text", text: userPromptText },
        ];
      }

      const text = await callClaude(CLASSIFY_SYSTEM_PROMPT, content, 900);
      const parsed = parseJsonLoose(text);
      if (!parsed.contributing_factors) parsed.contributing_factors = [];
      if (!parsed.potential_severity) parsed.potential_severity = parsed.severity;
      if (!parsed.confidence) parsed.confidence = "medium";
      setAnalysis(parsed);
      setAiSuggestion(JSON.parse(JSON.stringify(parsed))); // frozen snapshot of the original AI output
    } catch (e) {
      setAnalyzeError("Analysis failed. Try rephrasing the description, or try again.");
    } finally {
      setAnalyzing(false);
    }
  }

  function updateAnalysisField(key, value) {
    setAnalysis((a) => ({ ...a, [key]: value }));
  }

  function updateDetailField(key, value) {
    setAnalysis((a) => ({ ...a, category_details: { ...(a.category_details || {}), [key]: value } }));
  }

  function handleCategoryOverride(newCat) {
    setAnalysis((a) => ({ ...a, category: newCat, category_details: {} }));
  }

  function toggleContributingFactor(factorId) {
    setAnalysis((a) => {
      const current = a.contributing_factors || [];
      const has = current.includes(factorId);
      return { ...a, contributing_factors: has ? current.filter((f) => f !== factorId) : [...current, factorId] };
    });
  }

  async function handleSave() {
    if (!analysis) return;
    const nextId = `INC-${String(incidents.length + 1).padStart(4, "0")}`;
    const reporterName = currentUser && currentUser.name ? currentUser.name : "Unknown";
    const humanCorrected = aiSuggestion
      ? aiSuggestion.category !== analysis.category ||
        aiSuggestion.severity !== analysis.severity ||
        aiSuggestion.potential_severity !== analysis.potential_severity ||
        JSON.stringify((aiSuggestion.contributing_factors || []).slice().sort()) !==
          JSON.stringify((analysis.contributing_factors || []).slice().sort())
      : false;
    const record = {
      id: nextId,
      category: analysis.category,
      severity: analysis.severity,
      potential_severity: analysis.potential_severity || analysis.severity,
      contributing_factors: analysis.contributing_factors || [],
      confidence: analysis.confidence || "medium",
      classification_rationale: analysis.classification_rationale || "",
      status: "open",
      assignee: "",
      due_date: "",
      zone_location: zone,
      equipment_involved: equipment,
      weather_snapshot: weather,
      shift_context_hours: shiftHours,
      witness_count: witnessCount,
      root_cause_summary: analysis.root_cause_summary,
      suggested_corrective_action: analysis.suggested_corrective_action,
      category_details: analysis.category_details || {},
      attachment_count: attachments.length,
      reported_by: reporterName,
      source: "quaywatch",
      site_code: "",
      ai_suggested: aiSuggestion
        ? {
            category: aiSuggestion.category,
            severity: aiSuggestion.severity,
            potential_severity: aiSuggestion.potential_severity,
            contributing_factors: aiSuggestion.contributing_factors || [],
            confidence: aiSuggestion.confidence,
          }
        : null,
      human_corrected: humanCorrected,
      history: [{ timestamp: new Date().toISOString(), user: reporterName, action: "Logged incident" }],
      timestamp: new Date().toISOString(),
    };
    const next = [...incidents, record];
    await persist(next);
    if (attachments.length > 0) {
      try {
        await window.storage.set(`photo:${nextId}`, JSON.stringify({ items: attachments }), true);
      } catch (e) {
        console.error("Attachment storage error", e);
      }
    }
    setSavedFlash(nextId);
    resetForm();
    setTimeout(() => setSavedFlash(null), 3500);
  }

  async function loadSampleData() {
    await persist(SAMPLE_INCIDENTS);
  }

  async function clearAll() {
    if (!window.confirm("Clear all logged incidents? This cannot be undone.")) return;
    await persist([]);
    setReport(null);
    setAttachmentCache({});
    setExpandedId(null);
  }

  async function toggleDetails(id) {
    if (expandedId === id) {
      setExpandedId(null);
      return;
    }
    if (!attachmentCache[id]) {
      try {
        const res = await window.storage.get(`photo:${id}`, true);
        if (res && res.value) {
          setAttachmentCache((prev) => ({ ...prev, [id]: JSON.parse(res.value) }));
        }
      } catch (e) {
        /* no attachments for this incident */
      }
    }
    setExpandedId(id);
  }

  async function updateIncidentStatus(id, newStatus) {
    const reporterName = currentUser && currentUser.name ? currentUser.name : "Unknown";
    const next = incidents.map((inc) => {
      if (inc.id !== id) return inc;
      const entry = {
        timestamp: new Date().toISOString(),
        user: reporterName,
        action: `Status changed from ${statusById(inc.status || "open").label} to ${statusById(newStatus).label}`,
      };
      return { ...inc, status: newStatus, history: [...(inc.history || []), entry] };
    });
    await persist(next);
  }

  async function updateIncidentField(id, field, value) {
    const reporterName = currentUser && currentUser.name ? currentUser.name : "Unknown";
    const label = field === "assignee" ? "assignee" : field === "due_date" ? "due date" : field;
    const next = incidents.map((inc) => {
      if (inc.id !== id) return inc;
      const entry = { timestamp: new Date().toISOString(), user: reporterName, action: `Updated ${label} to "${value}"` };
      return { ...inc, [field]: value, history: [...(inc.history || []), entry] };
    });
    await persist(next);
  }

  function draftKey(id, field) {
    return `${id}:${field}`;
  }
  function getFieldValue(inc, field) {
    const k = draftKey(inc.id, field);
    return fieldDrafts[k] !== undefined ? fieldDrafts[k] : inc[field] || "";
  }
  function handleDraftChange(id, field, value) {
    setFieldDrafts((prev) => ({ ...prev, [draftKey(id, field)]: value }));
  }
  async function commitDraft(id, field) {
    const k = draftKey(id, field);
    const value = fieldDrafts[k];
    if (value === undefined) return;
    setFieldDrafts((prev) => {
      const next = { ...prev };
      delete next[k];
      return next;
    });
    await updateIncidentField(id, field, value);
  }

  const bySeverity = SEVERITIES.reduce((acc, s) => {
    acc[s.id] = incidents.filter((i) => i.severity === s.id).length;
    return acc;
  }, {});

  const byCategory = CATEGORIES.map((c) => ({
    id: c.id,
    label: c.shortLabel,
    color: c.color,
    count: incidents.filter((i) => i.category === c.id).length,
  }));

  const filteredIncidents =
    statusFilter === "all" ? incidents : incidents.filter((i) => (i.status || "open") === statusFilter);

  const aiTrackedIncidents = incidents.filter((i) => i.ai_suggested);
  const aiAccuracy = {
    tracked: aiTrackedIncidents.length,
    unchanged: aiTrackedIncidents.filter((i) => !i.human_corrected).length,
    corrected: aiTrackedIncidents.filter((i) => i.human_corrected).length,
    lowConfidenceCount: incidents.filter((i) => i.confidence === "low").length,
  };

  const contributingFactorTally = CONTRIBUTING_FACTORS.map((f) => ({
    id: f.id,
    label: f.label,
    count: incidents.filter((i) => (i.contributing_factors || []).includes(f.id)).length,
  })).filter((f) => f.count > 0);

  const periodRange = useMemo(
    () => getPeriodRange(periodType, periodYear, periodQuarter, periodMonth),
    [periodType, periodYear, periodQuarter, periodMonth]
  );
  const periodIncidents = useMemo(
    () => filterIncidentsByPeriod(incidents, periodRange),
    [incidents, periodRange]
  );
  const safetyRates = useMemo(
    () => calcSafetyRates(periodIncidents, hoursWorked),
    [periodIncidents, hoursWorked]
  );

  async function handleGenerateReport() {
    setGeneratingReport(true);
    setReportError(null);
    setReport(null);
    try {
      const periodByCategory = CATEGORIES.map((c) => ({
        label: c.shortLabel,
        count: periodIncidents.filter((i) => i.category === c.id).length,
      })).filter((c) => c.count > 0);
      const periodBySeverity = SEVERITIES.reduce((acc, s) => {
        acc[s.id] = periodIncidents.filter((i) => i.severity === s.id).length;
        return acc;
      }, {});
      const summary = {
        period_label: periodRange.label,
        total_incidents: periodIncidents.length,
        by_severity: periodBySeverity,
        by_category: periodByCategory,
        open_or_investigating: periodIncidents.filter((i) => ["open", "investigating"].includes(i.status || "open"))
          .length,
        safety_rates:
          safetyRates.hours > 0
            ? {
                hours_worked: safetyRates.hours,
                trir: Number(safetyRates.trir.toFixed(2)),
                ltifr: Number(safetyRates.ltifr.toFixed(2)),
                recordable_incidents: safetyRates.recordable,
                lost_time_incidents: safetyRates.lostTime,
                near_miss_incidents: safetyRates.nearMiss,
                fatalities: safetyRates.fatalities,
              }
            : "not provided - add hours worked for this period to calculate TRIR/LTIFR",
        root_causes: periodIncidents.map((i) => i.root_cause_summary).filter(Boolean),
        corrective_actions: periodIncidents.map((i) => i.suggested_corrective_action).filter(Boolean),
        contributing_factors:
          contributingFactorTally.length > 0
            ? contributingFactorTally.map((f) => ({ factor: f.label, count: f.count }))
            : "none tagged yet",
        ai_accuracy:
          aiAccuracy.tracked > 0
            ? {
                incidents_with_ai_suggestion: aiAccuracy.tracked,
                unchanged_by_human: aiAccuracy.unchanged,
                corrected_by_human: aiAccuracy.corrected,
                unchanged_rate_pct: Number(((aiAccuracy.unchanged / aiAccuracy.tracked) * 100).toFixed(1)),
                low_confidence_incidents: aiAccuracy.lowConfidenceCount,
              }
            : "not enough AI-classified incidents yet to compute",
        watch_list: activeAlerts.map((a) => ({
          rule: a.rule.name,
          category: a.category ? catById(a.category).label : "All categories",
          count: a.count,
          notify_role: a.rule.notify_role,
        })),
      };
      const text = await callClaude(REPORT_SYSTEM_PROMPT, JSON.stringify(summary, null, 2), 1000);
      setReport(text);
    } catch (e) {
      setReportError("Report generation failed. Please try again.");
    } finally {
      setGeneratingReport(false);
    }
  }

  function renderReport(text) {
    return text
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line, i) => {
        if (line.startsWith("## ")) {
          return (
            <h3
              key={i}
              style={{
                fontFamily: "'Space Grotesk', sans-serif",
                fontSize: 16,
                fontWeight: 700,
                color: "#10233A",
                marginTop: i === 0 ? 0 : 20,
                marginBottom: 8,
                paddingBottom: 6,
                borderBottom: "2px solid #FFC72C",
              }}
            >
              {line.replace("## ", "")}
            </h3>
          );
        }
        if (line.startsWith("- ")) {
          return (
            <div key={i} style={{ display: "flex", gap: 8, marginBottom: 5 }}>
              <span style={{ color: "#F5A623", fontWeight: 700 }}>-</span>
              <span style={{ fontSize: 14, color: "#33424F", lineHeight: 1.5 }}>{line.replace("- ", "")}</span>
            </div>
          );
        }
        return (
          <p key={i} style={{ fontSize: 14, color: "#33424F", lineHeight: 1.6, margin: "0 0 8px" }}>
            {line}
          </p>
        );
      });
  }

  const selectedCat = analysis ? catById(analysis.category) : null;

  return (
    <div style={{ minHeight: "100vh", background: "#EEF1F4", fontFamily: "'IBM Plex Sans', sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;600;700&family=IBM+Plex+Sans:wght@400;500;600&family=IBM+Plex+Mono:wght@400;500&display=swap');
        * { box-sizing: border-box; }
        ::placeholder { color: #9AA7B2; }
        button { cursor: pointer; font-family: 'IBM Plex Sans', sans-serif; }
        button:focus-visible, select:focus-visible, input:focus-visible, textarea:focus-visible {
          outline: 2px solid #F5A623; outline-offset: 1px;
        }
        table { border-collapse: collapse; width: 100%; }
        @media (prefers-reduced-motion: reduce) {
          .hazard-stripe { animation: none !important; }
        }
        @keyframes stripeSlide {
          from { background-position: 0 0; }
          to { background-position: 80px 0; }
        }
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>

      {showUserModal && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(16,35,58,0.55)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 50,
            padding: 20,
          }}
        >
          <div style={{ background: "#FFFFFF", borderRadius: 12, padding: 26, maxWidth: 380, width: "100%" }}>
            <h2 style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 18, color: "#10233A", margin: "0 0 6px" }}>
              Who's using Quaywatch?
            </h2>
            <p style={{ fontSize: 13, color: "#5B6B7C", margin: "0 0 16px" }}>
              This data is shared across everyone using this tool at the site {"—"} your name is attached to
              what you log and change.
            </p>
            <Field label="Your name">
              <input
                style={inputStyle}
                value={userDraftName}
                onChange={(e) => setUserDraftName(e.target.value)}
                placeholder="e.g. A. Rashid"
              />
            </Field>
            <div style={{ marginTop: 12 }}>
              <Field label="Role">
                <select style={inputStyle} value={userDraftRole} onChange={(e) => setUserDraftRole(e.target.value)}>
                  {ROLES.map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </select>
              </Field>
            </div>
            <button
              onClick={handleConfirmUser}
              disabled={!userDraftName.trim()}
              style={{
                marginTop: 18,
                width: "100%",
                padding: "11px 14px",
                borderRadius: 7,
                border: "none",
                background: userDraftName.trim() ? "#F5A623" : "#C9D2D8",
                color: "#10233A",
                fontWeight: 700,
                fontSize: 14,
              }}
            >
              Continue
            </button>
          </div>
        </div>
      )}

      <div style={{ background: "#10233A" }}>
        <div
          style={{
            maxWidth: 1140,
            margin: "0 auto",
            padding: "18px 20px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: 12,
          }}
        >
          <div>
            <div
              style={{
                fontFamily: "'Space Grotesk', sans-serif",
                fontSize: 22,
                fontWeight: 700,
                color: "#FFFFFF",
                letterSpacing: "0.01em",
              }}
            >
              Quaywatch
            </div>
            <div style={{ fontSize: 12.5, color: "#93A5B8", marginTop: 1 }}>
              Port HSE incident intelligence - prototype
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            <button
              onClick={openSwitchUser}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                padding: "6px 10px",
                borderRadius: 999,
                border: "1px solid #2E4560",
                background: "rgba(255,255,255,0.06)",
                color: "#C7D2DB",
                fontSize: 12,
                fontWeight: 600,
              }}
            >
              <UserCircle2 size={14} />
              {currentUser ? currentUser.name : "Guest"} {"·"} {role}
            </button>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              <TabButton active={view === "intake"} onClick={() => setView("intake")} icon={ClipboardList} label="Log incident" />
              <TabButton active={view === "dashboard"} onClick={() => setView("dashboard")} icon={LayoutDashboard} label="Dashboard & report" />
              <TabButton active={view === "rules"} onClick={() => setView("rules")} icon={SlidersHorizontal} label="Rules" />
              <TabButton active={view === "importExport"} onClick={() => setView("importExport")} icon={ArrowLeftRight} label="Import / Export" />
            </div>
          </div>
        </div>
      </div>
      <div
        className="hazard-stripe"
        style={{
          height: 6,
          backgroundImage: "repeating-linear-gradient(135deg, #10233A 0 10px, #FFC72C 10px 20px)",
          animation: "stripeSlide 14s linear infinite",
        }}
      />

      <div style={{ maxWidth: 1140, margin: "0 auto", padding: "28px 20px 60px" }}>
        {view === "intake" && (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(360px, 1fr))", gap: 20, alignItems: "start" }}>
            <div style={{ ...cardStyle, padding: 22 }}>
              <h2 style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 17, color: "#10233A", margin: "0 0 4px" }}>
                Log an incident
              </h2>
              <p style={{ fontSize: 13, color: "#5B6B7C", margin: "0 0 16px" }}>
                Describe what happened, attach up to 5 photos or videos, or dictate it - AI will classify it and
                suggest structured fields.
              </p>

              <Field label="What happened">
                <textarea
                  value={rawText}
                  onChange={(e) => setRawText(e.target.value)}
                  placeholder="e.g. RTG operator on the last hour of a double shift misjudged the stack alignment while placing a container in Row 7..."
                  rows={5}
                  style={{ ...inputStyle, resize: "vertical" }}
                />
              </Field>

              <div style={{ marginTop: 12 }}>
                <Field label="Attach evidence (optional, up to 5)">
                  <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", marginTop: 2 }}>
                    <label style={{ ...smallButtonStyle, opacity: attachments.length >= 5 ? 0.5 : 1 }}>
                      <Camera size={14} /> Photo / video
                      <input
                        type="file"
                        accept="image/*,video/*"
                        multiple
                        disabled={attachments.length >= 5}
                        onChange={handleFileSelect}
                        style={{ display: "none" }}
                      />
                    </label>
                    <button
                      type="button"
                      onClick={toggleRecording}
                      style={{
                        ...smallButtonStyle,
                        background: isRecording ? "#C0392B" : "#FFFFFF",
                        color: isRecording ? "#FFFFFF" : "#10233A",
                        borderColor: isRecording ? "#C0392B" : "#D6DCE2",
                      }}
                    >
                      <Mic size={14} /> {isRecording ? "Stop recording" : "Voice note"}
                    </button>
                  </div>
                </Field>
                {!speechSupported && (
                  <div style={{ fontSize: 11, color: "#9AA7B2", marginTop: 6 }}>
                    Voice input isn't supported in this browser - try Chrome, or type directly.
                  </div>
                )}
                {speechError && <div style={{ fontSize: 12, color: "#C0392B", marginTop: 6 }}>{speechError}</div>}
                {attachmentError && <div style={{ fontSize: 12, color: "#C0392B", marginTop: 6 }}>{attachmentError}</div>}
                {attachments.length > 0 && (
                  <div style={{ marginTop: 10, display: "flex", gap: 8, flexWrap: "wrap" }}>
                    {attachments.map((a, idx) => (
                      <div key={idx} style={{ position: "relative" }}>
                        <img
                          src={`data:${a.media_type};base64,${a.data}`}
                          alt="Attachment preview"
                          style={{ width: 64, height: 64, objectFit: "cover", borderRadius: 6, border: "1px solid #D6DCE2" }}
                        />
                        <button
                          onClick={() => removeAttachment(idx)}
                          style={{
                            position: "absolute",
                            top: -6,
                            right: -6,
                            width: 18,
                            height: 18,
                            borderRadius: "50%",
                            border: "none",
                            background: "#C0392B",
                            color: "#FFF",
                            fontSize: 11,
                            lineHeight: "18px",
                            padding: 0,
                          }}
                        >
                          x
                        </button>
                        {a.kind === "video_frame" && (
                          <div style={{ fontSize: 9, color: "#8291A0", textAlign: "center" }}>video</div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 14 }}>
                <Field label="Zone / location">
                  <input style={inputStyle} value={zone} onChange={(e) => setZone(e.target.value)} placeholder="Berth 3 lift zone" />
                </Field>
                <Field label="Equipment involved">
                  <input style={inputStyle} value={equipment} onChange={(e) => setEquipment(e.target.value)} placeholder="RTG crane" />
                </Field>
                <Field label="Weather snapshot">
                  <input style={inputStyle} value={weather} onChange={(e) => setWeather(e.target.value)} placeholder="Clear, 18 km/h wind" />
                </Field>
                <Field label="Hours into shift">
                  <input style={inputStyle} value={shiftHours} onChange={(e) => setShiftHours(e.target.value)} placeholder="9" />
                </Field>
                <Field label="Witness count">
                  <input style={inputStyle} value={witnessCount} onChange={(e) => setWitnessCount(e.target.value)} placeholder="1" />
                </Field>
              </div>

              <button
                onClick={handleAnalyze}
                disabled={(!rawText.trim() && attachments.length === 0) || analyzing}
                style={{
                  marginTop: 16,
                  width: "100%",
                  padding: "11px 14px",
                  borderRadius: 7,
                  border: "none",
                  background: (!rawText.trim() && attachments.length === 0) || analyzing ? "#C9D2D8" : "#10233A",
                  color: "#FFFFFF",
                  fontWeight: 600,
                  fontSize: 14,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 8,
                }}
              >
                {analyzing ? <Loader2 size={16} style={{ animation: "spin 1s linear infinite" }} /> : <Sparkles size={16} />}
                {analyzing ? "Analyzing..." : "Analyze with AI"}
              </button>
              {analyzeError && <div style={{ marginTop: 10, fontSize: 13, color: "#C0392B" }}>{analyzeError}</div>}

              <div style={{ marginTop: 18, paddingTop: 14, borderTop: "1px dashed #D6DCE2", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: 12.5, color: "#8291A0" }}>
                  {incidents.length} incident{incidents.length === 1 ? "" : "s"} logged
                </span>
                <button
                  onClick={loadSampleData}
                  style={{ background: "none", border: "none", color: "#2980B9", fontSize: 12.5, fontWeight: 600, textDecoration: "underline", padding: 0 }}
                >
                  Load 8 sample incidents
                </button>
              </div>
            </div>

            <div style={{ ...cardStyle, padding: 22, minHeight: 300 }}>
              <h2 style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 17, color: "#10233A", margin: "0 0 4px" }}>
                AI classification
              </h2>

              {!analysis && !analyzing && (
                <p style={{ fontSize: 13.5, color: "#8291A0", marginTop: 14 }}>
                  Run the analysis to see the suggested category, severity and extracted fields here. You can edit
                  anything before saving.
                </p>
              )}

              {analyzing && <p style={{ fontSize: 13.5, color: "#8291A0", marginTop: 14 }}>Reading the incident...</p>}

              {analysis && selectedCat && (
                <div style={{ marginTop: 10 }}>
                  <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                    <select value={analysis.category} onChange={(e) => handleCategoryOverride(e.target.value)} style={{ ...inputStyle, fontWeight: 600, width: "auto" }}>
                      {CATEGORIES.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.label}
                        </option>
                      ))}
                    </select>
                    <select value={analysis.severity} onChange={(e) => updateAnalysisField("severity", e.target.value)} style={{ ...inputStyle, width: "auto" }}>
                      {SEVERITIES.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div style={{ marginTop: 10 }}>
                    <Field label="Potential severity (worst credible outcome)">
                      <select
                        value={analysis.potential_severity || analysis.severity}
                        onChange={(e) => updateAnalysisField("potential_severity", e.target.value)}
                        style={{ ...inputStyle, width: "auto" }}
                      >
                        {SEVERITIES.map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.label}
                          </option>
                        ))}
                      </select>
                    </Field>
                  </div>

                  <div style={{ marginTop: 14 }}>
                    <Pill color={selectedCat.color} textDark={selectedCat.textDark} icon={selectedCat.icon}>
                      {selectedCat.label}
                    </Pill>{" "}
                    <Pill color={sevById(analysis.severity).color} textDark={sevById(analysis.severity).textDark}>
                      {sevById(analysis.severity).label}
                    </Pill>
                    {analysis.potential_severity && analysis.potential_severity !== analysis.severity && (
                      <>
                        {" "}
                        <Pill color="#8E44AD">HiPo: {sevById(analysis.potential_severity).label}</Pill>
                      </>
                    )}{" "}
                    <Pill
                      color={analysis.confidence === "low" ? "#C0392B" : analysis.confidence === "medium" ? "#E67E22" : "#27AE60"}
                    >
                      {(analysis.confidence || "medium").toUpperCase()} confidence
                    </Pill>
                  </div>
                  {analysis.classification_rationale && (
                    <p style={{ fontSize: 12, color: "#5B6B7C", fontStyle: "italic", marginTop: 8, marginBottom: 0 }}>
                      {analysis.classification_rationale}
                    </p>
                  )}
                  {analysis.confidence === "low" && (
                    <p style={{ fontSize: 12, color: "#C0392B", marginTop: 6, marginBottom: 0 }}>
                      Low confidence {"—"} review the category, severity and fields carefully before saving.
                    </p>
                  )}

                  <div style={{ marginTop: 16 }}>
                    <Field label="Root cause summary">
                      <textarea
                        value={analysis.root_cause_summary || ""}
                        onChange={(e) => updateAnalysisField("root_cause_summary", e.target.value)}
                        rows={2}
                        style={{ ...inputStyle, resize: "vertical" }}
                      />
                    </Field>
                  </div>
                  <div style={{ marginTop: 10 }}>
                    <Field label="Suggested corrective action">
                      <textarea
                        value={analysis.suggested_corrective_action || ""}
                        onChange={(e) => updateAnalysisField("suggested_corrective_action", e.target.value)}
                        rows={2}
                        style={{ ...inputStyle, resize: "vertical" }}
                      />
                    </Field>
                  </div>

                  <div style={{ marginTop: 14, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                    {selectedCat.fields.map((f) => (
                      <Field key={f.key} label={f.label}>
                        <input style={inputStyle} value={(analysis.category_details || {})[f.key] || ""} onChange={(e) => updateDetailField(f.key, e.target.value)} />
                      </Field>
                    ))}
                  </div>

                  <div style={{ marginTop: 14 }}>
                    <Field label="Contributing factors">
                      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginTop: 4 }}>
                        {CONTRIBUTING_FACTORS.map((f) => (
                          <label key={f.id} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12.5, color: "#33424F" }}>
                            <input
                              type="checkbox"
                              checked={(analysis.contributing_factors || []).includes(f.id)}
                              onChange={() => toggleContributingFactor(f.id)}
                            />
                            {f.label}
                          </label>
                        ))}
                      </div>
                    </Field>
                  </div>

                  <button
                    onClick={handleSave}
                    style={{
                      marginTop: 18,
                      width: "100%",
                      padding: "11px 14px",
                      borderRadius: 7,
                      border: "none",
                      background: "#F5A623",
                      color: "#10233A",
                      fontWeight: 700,
                      fontSize: 14,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: 8,
                    }}
                  >
                    <Save size={16} />
                    Save incident
                  </button>
                </div>
              )}

              {savedFlash && (
                <div style={{ marginTop: 14, display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "#1E7E45", background: "#E9F7EF", padding: "8px 12px", borderRadius: 6 }}>
                  <CircleCheck size={16} />
                  Logged as {savedFlash}
                </div>
              )}
            </div>
          </div>
        )}

        {view === "dashboard" && (
          <DashboardView
            incidents={filteredIncidents}
            allIncidentsCount={incidents.length}
            bySeverity={bySeverity}
            byCategory={byCategory}
            activeAlerts={activeAlerts}
            notifications={notifications}
            initializing={initializing}
            onClear={clearAll}
            onExport={() => exportIncidentsToExcel(incidents)}
            onGenerateReport={handleGenerateReport}
            generatingReport={generatingReport}
            reportError={reportError}
            report={report}
            renderReport={renderReport}
            attachmentCache={attachmentCache}
            expandedId={expandedId}
            toggleDetails={toggleDetails}
            statusFilter={statusFilter}
            setStatusFilter={setStatusFilter}
            canManage={canManage}
            isManager={isManager}
            updateIncidentStatus={updateIncidentStatus}
            getFieldValue={getFieldValue}
            handleDraftChange={handleDraftChange}
            commitDraft={commitDraft}
            updateIncidentField={updateIncidentField}
            periodType={periodType}
            setPeriodType={setPeriodType}
            periodMonth={periodMonth}
            setPeriodMonth={setPeriodMonth}
            periodQuarter={periodQuarter}
            setPeriodQuarter={setPeriodQuarter}
            periodYear={periodYear}
            setPeriodYear={setPeriodYear}
            periodRange={periodRange}
            hoursWorked={hoursWorked}
            setHoursWorked={setHoursWorked}
            safetyRates={safetyRates}
            aiAccuracy={aiAccuracy}
            contributingFactorTally={contributingFactorTally}
          />
        )}

        {view === "rules" && <RulesView rules={rules} onChange={persistRules} canManage={canManage} />}

        {view === "importExport" && (
          <ImportExportView
            csvHeaders={csvHeaders}
            csvRows={csvRows}
            fieldMapping={fieldMapping}
            setFieldMapping={setFieldMapping}
            onCsvUpload={handleCsvUpload}
            onClearStaging={clearImportStaging}
            onRunImport={runImport}
            importing={importing}
            importProgress={importProgress}
            importSummary={importSummary}
            importError={importError}
            canManage={canManage}
            incidents={incidents}
            onExportExcel={() => exportIncidentsToExcel(incidents)}
            onExportIsoJson={() => downloadIsoJson(incidents)}
          />
        )}
      </div>
    </div>
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
        padding: "8px 14px",
        borderRadius: 7,
        border: "none",
        background: active ? "#F5A623" : "transparent",
        color: active ? "#10233A" : "#C7D2DB",
        fontWeight: 600,
        fontSize: 13.5,
      }}
    >
      <Icon size={15} />
      {label}
    </button>
  );
}

function StatCard({ label, value, color }) {
  return (
    <div style={{ ...cardStyle, padding: "14px 16px", flex: "1 1 120px" }}>
      <div style={{ fontSize: 11.5, color: "#8291A0", fontWeight: 600, letterSpacing: "0.03em" }}>{label.toUpperCase()}</div>
      <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 28, fontWeight: 700, color: color || "#10233A", marginTop: 2 }}>{value}</div>
    </div>
  );
}

function DashboardView({
  incidents,
  allIncidentsCount,
  bySeverity,
  byCategory,
  activeAlerts,
  notifications,
  initializing,
  onClear,
  onExport,
  onGenerateReport,
  generatingReport,
  reportError,
  report,
  renderReport,
  attachmentCache,
  expandedId,
  toggleDetails,
  statusFilter,
  setStatusFilter,
  canManage,
  isManager,
  updateIncidentStatus,
  getFieldValue,
  handleDraftChange,
  commitDraft,
  updateIncidentField,
  periodType,
  setPeriodType,
  periodMonth,
  setPeriodMonth,
  periodQuarter,
  setPeriodQuarter,
  periodYear,
  setPeriodYear,
  periodRange,
  hoursWorked,
  setHoursWorked,
  safetyRates,
  aiAccuracy,
  contributingFactorTally,
}) {
  if (initializing) {
    return <p style={{ color: "#8291A0", fontSize: 14 }}>Loading incident log...</p>;
  }

  if (allIncidentsCount === 0) {
    return (
      <div style={{ ...cardStyle, padding: 32, textAlign: "center" }}>
        <Radar size={28} color="#8291A0" />
        <p style={{ color: "#5B6B7C", fontSize: 14, marginTop: 10 }}>
          No incidents logged yet. Log one on the previous tab, or load the sample data set to explore the dashboard.
        </p>
      </div>
    );
  }

  return (
    <div>
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 20 }}>
        <StatCard label="Total logged" value={allIncidentsCount} />
        {SEVERITIES.map((s) => (
          <StatCard key={s.id} label={s.label} value={bySeverity[s.id] || 0} color={s.color} />
        ))}
      </div>

      <div style={{ ...cardStyle, padding: 20, marginBottom: 20 }}>
        <h3 style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 15, color: "#10233A", margin: "0 0 12px" }}>
          Incidents by category
        </h3>
        <div style={{ width: "100%", height: 220 }}>
          <ResponsiveContainer>
            <BarChart data={byCategory} margin={{ top: 4, right: 10, left: -18, bottom: 4 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E9EDF0" vertical={false} />
              <XAxis dataKey="label" tick={{ fontSize: 11, fill: "#5B6B7C" }} interval={0} angle={-20} textAnchor="end" height={55} />
              <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: "#5B6B7C" }} />
              <Tooltip cursor={{ fill: "#F4F6F8" }} contentStyle={{ fontSize: 12, borderRadius: 6 }} />
              <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                {byCategory.map((c) => (
                  <Cell key={c.id} fill={c.color} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {(aiAccuracy.tracked > 0 || contributingFactorTally.length > 0) && (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
            gap: 20,
            marginBottom: 20,
          }}
        >
          {aiAccuracy.tracked > 0 && (
            <div style={{ ...cardStyle, padding: 20 }}>
              <h3 style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 15, color: "#10233A", margin: "0 0 4px" }}>
                AI classification accuracy
              </h3>
              <p style={{ fontSize: 12, color: "#8291A0", margin: "0 0 12px" }}>
                Based on {aiAccuracy.tracked} AI-classified incident{aiAccuracy.tracked === 1 ? "" : "s"} logged so
                far {"—"} this is real pilot data, not an estimate.
              </p>
              <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
                <StatCard
                  label="Unchanged by human"
                  value={`${Math.round((aiAccuracy.unchanged / aiAccuracy.tracked) * 100)}%`}
                  color="#27AE60"
                />
                <StatCard label="Human-corrected" value={aiAccuracy.corrected} color="#E67E22" />
                <StatCard label="Low confidence" value={aiAccuracy.lowConfidenceCount} color="#C0392B" />
              </div>
            </div>
          )}

          {contributingFactorTally.length > 0 && (
            <div style={{ ...cardStyle, padding: 20 }}>
              <h3 style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 15, color: "#10233A", margin: "0 0 4px" }}>
                Contributing factors
              </h3>
              <p style={{ fontSize: 12, color: "#8291A0", margin: "0 0 12px" }}>
                Tagged across incidents regardless of primary category {"—"} recurring factors here often need
                a different fix than the category breakdown alone would suggest.
              </p>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {contributingFactorTally
                  .slice()
                  .sort((a, b) => b.count - a.count)
                  .map((f) => (
                    <div key={f.id} style={{ display: "flex", justifyContent: "space-between", fontSize: 13, color: "#33424F" }}>
                      <span>{f.label}</span>
                      <span style={{ fontWeight: 700, color: "#10233A" }}>{f.count}</span>
                    </div>
                  ))}
              </div>
            </div>
          )}
        </div>
      )}

      {activeAlerts.length > 0 && (
        <div style={{ marginBottom: 20, borderRadius: 10, overflow: "hidden", border: "1px solid #E2E7EB" }}>
          <div style={{ height: 5, backgroundImage: "repeating-linear-gradient(135deg, #10233A 0 8px, #FFC72C 8px 16px)" }} />
          <div style={{ background: "#FFFBEF", padding: 16 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
              <CircleAlert size={17} color="#B9770E" />
              <h3 style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 15, color: "#8A5A00", margin: 0 }}>Active alerts</h3>
            </div>
            {activeAlerts.map((a, idx) => (
              <div
                key={idx}
                style={{
                  fontSize: 13.5,
                  color: "#6B4E00",
                  margin: "6px 0",
                  paddingBottom: 8,
                  borderBottom: idx < activeAlerts.length - 1 ? "1px solid #F3E4B8" : "none",
                }}
              >
                <strong>{a.rule.name}</strong>
                {a.category ? ` - ${catById(a.category).label}` : ""}: {a.count} matching incident{a.count === 1 ? "" : "s"}.
                <div style={{ fontSize: 12, color: "#8A6D2E", marginTop: 2 }}>
                  Notify {a.rule.notify_role} via {channelLabel(a.rule.channel)}.
                </div>
                <div style={{ display: "flex", gap: 8, marginTop: 6, flexWrap: "wrap" }}>
                  {(() => {
                    const msg = buildAlertMessage(a);
                    return (
                      <>
                        <a
                          href={mailtoLink(a.rule, msg.subject, msg.body)}
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 5,
                            padding: "5px 10px",
                            borderRadius: 6,
                            border: "1px solid #E0C88A",
                            background: "#FFFFFF",
                            color: "#8A5A00",
                            fontSize: 11.5,
                            fontWeight: 600,
                            textDecoration: "none",
                          }}
                        >
                          <Bell size={12} /> Send email
                        </a>
                        {a.rule.notify_whatsapp && (
                          <a
                            href={whatsappLink(a.rule, msg.subject, msg.body)}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{
                              display: "inline-flex",
                              alignItems: "center",
                              gap: 5,
                              padding: "5px 10px",
                              borderRadius: 6,
                              border: "1px solid #E0C88A",
                              background: "#FFFFFF",
                              color: "#8A5A00",
                              fontSize: 11.5,
                              fontWeight: 600,
                              textDecoration: "none",
                            }}
                          >
                            <Bell size={12} /> Send WhatsApp
                          </a>
                        )}
                      </>
                    );
                  })()}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {notifications.length > 0 && (
        <div style={{ ...cardStyle, padding: 20, marginBottom: 20 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
            <Bell size={16} color="#5B6B7C" />
            <h3 style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 15, color: "#10233A", margin: 0 }}>Notifications (simulated)</h3>
          </div>
          <div style={{ maxHeight: 180, overflowY: "auto", display: "flex", flexDirection: "column", gap: 8 }}>
            {notifications.map((n) => (
              <div key={n.id} style={{ fontSize: 12.5, color: "#33424F", borderLeft: "3px solid #F5A623", paddingLeft: 10 }}>
                <div style={{ color: "#8291A0", fontSize: 11 }}>{new Date(n.timestamp).toLocaleString()}</div>
                {n.message}
              </div>
            ))}
          </div>
        </div>
      )}

      <div style={{ ...cardStyle, padding: 20, marginBottom: 20, overflowX: "auto" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10, marginBottom: 12 }}>
          <h3 style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 15, color: "#10233A", margin: 0 }}>Incident log</h3>
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} style={{ ...inputStyle, width: "auto", fontSize: 13 }}>
            <option value="all">All statuses</option>
            {STATUSES.map((s) => (
              <option key={s.id} value={s.id}>
                {s.label}
              </option>
            ))}
          </select>
        </div>
        <table>
          <thead>
            <tr style={{ textAlign: "left", fontSize: 11.5, color: "#8291A0" }}>
              <th style={{ padding: "6px 8px" }}>ID</th>
              <th style={{ padding: "6px 8px" }}>Category</th>
              <th style={{ padding: "6px 8px" }}>Severity</th>
              <th style={{ padding: "6px 8px" }}>Status</th>
              <th style={{ padding: "6px 8px" }}>Zone</th>
              <th style={{ padding: "6px 8px" }}>Evidence</th>
              <th style={{ padding: "6px 8px" }}></th>
            </tr>
          </thead>
          <tbody>
            {incidents.length === 0 && (
              <tr>
                <td colSpan={7} style={{ padding: "14px 8px", fontSize: 13, color: "#8291A0" }}>
                  No incidents match this status filter.
                </td>
              </tr>
            )}
            {incidents
              .slice()
              .reverse()
              .map((i) => {
                const c = catById(i.category);
                const s = sevById(i.severity);
                const st = statusById(i.status || "open");
                const isOpen = expandedId === i.id;
                return (
                  <React.Fragment key={i.id}>
                    <tr style={{ borderTop: "1px solid #EEF1F4" }}>
                      <td style={{ padding: "8px", fontFamily: "'IBM Plex Mono', monospace", fontSize: 12.5, color: "#5B6B7C" }}>{i.id}</td>
                      <td style={{ padding: "8px" }}>
                        <Pill color={c.color} textDark={c.textDark}>
                          {c.shortLabel}
                        </Pill>
                      </td>
                      <td style={{ padding: "8px" }}>
                        <Pill color={s.color} textDark={s.textDark}>
                          {s.label}
                        </Pill>
                      </td>
                      <td style={{ padding: "8px" }}>
                        <Pill color={st.color}>{st.label}</Pill>
                      </td>
                      <td style={{ padding: "8px", fontSize: 13, color: "#33424F" }}>{i.zone_location || "-"}</td>
                      <td style={{ padding: "8px" }}>
                        {i.attachment_count > 0 ? (
                          <span style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 11.5, color: "#5B6B7C" }}>
                            <Camera size={13} /> {i.attachment_count}
                          </span>
                        ) : (
                          <span style={{ color: "#C7D2DB", fontSize: 12 }}>-</span>
                        )}
                      </td>
                      <td style={{ padding: "8px" }}>
                        <button
                          onClick={() => toggleDetails(i.id)}
                          style={{ background: "none", border: "1px solid #D6DCE2", borderRadius: 6, padding: "4px 10px", fontSize: 11.5, color: "#2980B9" }}
                        >
                          {isOpen ? "Hide" : "Details"}
                        </button>
                      </td>
                    </tr>
                    {isOpen && (
                      <tr>
                        <td colSpan={7} style={{ padding: "10px 8px 18px", background: "#FAFBFC" }}>
                          <div style={{ display: "flex", flexWrap: "wrap", gap: 22 }}>
                            <div style={{ minWidth: 220, maxWidth: 320 }}>
                              <div style={{ fontSize: 11, fontWeight: 600, color: "#8291A0", marginBottom: 6 }}>
                                ROOT CAUSE & CORRECTIVE ACTION
                              </div>
                              <div style={{ fontSize: 13, color: "#33424F", marginBottom: 6 }}>{i.root_cause_summary}</div>
                              <div style={{ fontSize: 12.5, color: "#5B6B7C" }}>{i.suggested_corrective_action}</div>
                              <div style={{ fontSize: 11.5, color: "#8291A0", marginTop: 8 }}>
                                Reported by {i.reported_by || "Unknown"}
                              </div>
                            </div>

                            {i.attachment_count > 0 && (
                              <div style={{ minWidth: 200 }}>
                                <div style={{ fontSize: 11, fontWeight: 600, color: "#8291A0", marginBottom: 6 }}>ATTACHMENTS</div>
                                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                                  {attachmentCache[i.id]
                                    ? attachmentCache[i.id].items.map((att, idx) => (
                                        <div key={idx}>
                                          <img
                                            src={`data:${att.media_type};base64,${att.data}`}
                                            alt="Incident evidence"
                                            style={{ width: 84, height: 84, objectFit: "cover", borderRadius: 6, border: "1px solid #E2E7EB" }}
                                          />
                                          {att.kind === "video_frame" && (
                                            <div style={{ fontSize: 10, color: "#8291A0" }}>video frame</div>
                                          )}
                                        </div>
                                      ))
                                    : <span style={{ fontSize: 12, color: "#8291A0" }}>Loading...</span>}
                                </div>
                              </div>
                            )}

                            <div style={{ minWidth: 220 }}>
                              <div style={{ fontSize: 11, fontWeight: 600, color: "#8291A0", marginBottom: 6 }}>STATUS & ASSIGNMENT</div>
                              {canManage ? (
                                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                                  <select
                                    value={i.status || "open"}
                                    onChange={(e) => updateIncidentStatus(i.id, e.target.value)}
                                    style={{ ...inputStyle, width: 210 }}
                                  >
                                    {STATUSES.map((st2) => (
                                      <option key={st2.id} value={st2.id}>
                                        {st2.label}
                                      </option>
                                    ))}
                                  </select>
                                  <input
                                    placeholder="Assignee"
                                    style={{ ...inputStyle, width: 210 }}
                                    value={getFieldValue(i, "assignee")}
                                    onChange={(e) => handleDraftChange(i.id, "assignee", e.target.value)}
                                    onBlur={() => commitDraft(i.id, "assignee")}
                                  />
                                  <input
                                    type="date"
                                    style={{ ...inputStyle, width: 210 }}
                                    value={i.due_date || ""}
                                    onChange={(e) => updateIncidentField(i.id, "due_date", e.target.value)}
                                  />
                                </div>
                              ) : (
                                <div style={{ fontSize: 13, color: "#33424F" }}>
                                  {st.label}
                                  {i.assignee ? ` — assigned to ${i.assignee}` : ""}
                                  {i.due_date ? `, due ${i.due_date}` : ""}
                                </div>
                              )}
                            </div>

                            <div style={{ flex: "1 1 220px", minWidth: 220 }}>
                              <div style={{ fontSize: 11, fontWeight: 600, color: "#8291A0", marginBottom: 6 }}>HISTORY</div>
                              <div style={{ display: "flex", flexDirection: "column", gap: 4, maxHeight: 130, overflowY: "auto" }}>
                                {(i.history || [])
                                  .slice()
                                  .reverse()
                                  .map((h, idx) => (
                                    <div key={idx} style={{ fontSize: 12, color: "#5B6B7C" }}>
                                      <span style={{ color: "#8291A0" }}>{new Date(h.timestamp).toLocaleString()}</span>{" "}
                                      {"—"} {h.action} ({h.user})
                                    </div>
                                  ))}
                              </div>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
          </tbody>
        </table>
      </div>

      <div style={{ ...cardStyle, padding: 20, marginBottom: 20 }}>
        <h3 style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 15, color: "#10233A", margin: "0 0 12px" }}>
          Reporting period
        </h3>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "flex-end" }}>
          <Field label="Period">
            <select style={{ ...inputStyle, width: 150 }} value={periodType} onChange={(e) => setPeriodType(e.target.value)}>
              <option value="all">All time</option>
              <option value="monthly">Monthly</option>
              <option value="quarterly">Quarterly</option>
              <option value="yearly">Yearly</option>
            </select>
          </Field>
          {periodType === "monthly" && (
            <Field label="Month">
              <input type="month" style={{ ...inputStyle, width: 160 }} value={periodMonth} onChange={(e) => setPeriodMonth(e.target.value)} />
            </Field>
          )}
          {periodType === "quarterly" && (
            <>
              <Field label="Quarter">
                <select style={{ ...inputStyle, width: 100 }} value={periodQuarter} onChange={(e) => setPeriodQuarter(parseInt(e.target.value, 10))}>
                  <option value={1}>Q1</option>
                  <option value={2}>Q2</option>
                  <option value={3}>Q3</option>
                  <option value={4}>Q4</option>
                </select>
              </Field>
              <Field label="Year">
                <input type="number" style={{ ...inputStyle, width: 100 }} value={periodYear} onChange={(e) => setPeriodYear(parseInt(e.target.value, 10) || periodYear)} />
              </Field>
            </>
          )}
          {periodType === "yearly" && (
            <Field label="Year">
              <input type="number" style={{ ...inputStyle, width: 100 }} value={periodYear} onChange={(e) => setPeriodYear(parseInt(e.target.value, 10) || periodYear)} />
            </Field>
          )}
          <Field label="Hours worked this period (for TRIR/LTIFR)">
            <input
              type="number"
              style={{ ...inputStyle, width: 200 }}
              value={hoursWorked}
              onChange={(e) => setHoursWorked(e.target.value)}
              placeholder="e.g. 48000"
            />
          </Field>
        </div>
        <p style={{ fontSize: 11.5, color: "#8291A0", marginTop: 8, display: "flex", alignItems: "flex-start", gap: 6 }}>
          <Info size={13} style={{ marginTop: 2, flexShrink: 0 }} />
          Hours worked isn't tracked here {"—"} it normally lives in a workforce/roster system {"—"} so
          enter it manually to calculate TRIR and LTIFR for {periodRange.label}.
        </p>
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginTop: 14 }}>
          <StatCard label={`TRIR — ${periodRange.label}`} value={safetyRates.trir !== null ? safetyRates.trir.toFixed(2) : "—"} />
          <StatCard label={`LTIFR — ${periodRange.label}`} value={safetyRates.ltifr !== null ? safetyRates.ltifr.toFixed(2) : "—"} />
          <StatCard label="Recordable" value={safetyRates.recordable} color="#E67E22" />
          <StatCard label="Lost time" value={safetyRates.lostTime} color="#C0392B" />
          <StatCard label="Near miss" value={safetyRates.nearMiss} color="#27AE60" />
        </div>
      </div>

      <div style={{ ...cardStyle, padding: 20 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
          <h3 style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 15, color: "#10233A", margin: 0 }}>
            ISO 45001-aligned compliance report {"—"} {periodRange.label}
          </h3>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button
              onClick={onExport}
              style={{ display: "flex", alignItems: "center", gap: 6, padding: "9px 12px", borderRadius: 7, border: "1px solid #D6DCE2", background: "#FFF", color: "#10233A", fontWeight: 600, fontSize: 13 }}
            >
              <Download size={14} />
              Export Excel
            </button>
            <button
              onClick={onGenerateReport}
              disabled={generatingReport}
              style={{ display: "flex", alignItems: "center", gap: 7, padding: "9px 14px", borderRadius: 7, border: "none", background: generatingReport ? "#C9D2D8" : "#10233A", color: "#FFF", fontWeight: 600, fontSize: 13 }}
            >
              {generatingReport ? <Loader2 size={15} style={{ animation: "spin 1s linear infinite" }} /> : <FileText size={15} />}
              {generatingReport ? "Generating..." : "Generate report"}
            </button>
            {isManager && (
              <button
                onClick={onClear}
                style={{ display: "flex", alignItems: "center", gap: 6, padding: "9px 12px", borderRadius: 7, border: "1px solid #E2A6A0", background: "#FFF", color: "#C0392B", fontWeight: 600, fontSize: 13 }}
              >
                <Trash2 size={14} />
                Clear all
              </button>
            )}
          </div>
        </div>

        {reportError && <p style={{ color: "#C0392B", fontSize: 13, marginTop: 10 }}>{reportError}</p>}

        {report && <div style={{ marginTop: 16, paddingTop: 4 }}>{renderReport(report)}</div>}

        {!report && !generatingReport && !reportError && (
          <p style={{ fontSize: 13, color: "#8291A0", marginTop: 12 }}>
            Generates a structured report from everything logged so far: executive summary, breakdown by category,
            trend notes, top root causes, corrective actions and the active alerts above.
          </p>
        )}
      </div>
    </div>
  );
}

function RulesView({ rules, onChange, canManage }) {
  const [draft, setDraft] = useState(null);
  const [formError, setFormError] = useState(null);

  function startAdd() {
    setDraft({
      id: null,
      name: "",
      category: "any",
      per_category: true,
      severities: ["near_miss", "minor"],
      severity_field: "severity",
      threshold_count: 2,
      window_days: 90,
      notify_role: "",
      channel: "dashboard",
      notify_email: "",
      notify_whatsapp: "",
      enabled: true,
    });
    setFormError(null);
  }

  function startEdit(rule) {
    setDraft({ ...rule });
    setFormError(null);
  }

  function toggleSeverity(sevId) {
    setDraft((d) => {
      const has = d.severities.includes(sevId);
      return { ...d, severities: has ? d.severities.filter((s) => s !== sevId) : [...d.severities, sevId] };
    });
  }

  function saveDraft() {
    if (!draft.name.trim()) {
      setFormError("Give the rule a name.");
      return;
    }
    if (draft.severities.length === 0) {
      setFormError("Select at least one severity level.");
      return;
    }
    if (!draft.threshold_count || draft.threshold_count < 1) {
      setFormError("Threshold count must be at least 1.");
      return;
    }
    if (!draft.notify_role.trim()) {
      setFormError("Add who should be notified.");
      return;
    }
    const isNew = !draft.id;
    const finalRule = isNew ? { ...draft, id: `rule-${Date.now()}` } : draft;
    const next = isNew ? [...rules, finalRule] : rules.map((r) => (r.id === finalRule.id ? finalRule : r));
    onChange(next);
    setDraft(null);
  }

  function removeRule(id) {
    if (!window.confirm("Delete this rule?")) return;
    onChange(rules.filter((r) => r.id !== id));
  }

  function toggleEnabled(rule) {
    onChange(rules.map((r) => (r.id === rule.id ? { ...r, enabled: !r.enabled } : r)));
  }

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, flexWrap: "wrap", gap: 10 }}>
        <div>
          <h2 style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 18, color: "#10233A", margin: 0 }}>Alert rules</h2>
          <p style={{ fontSize: 13, color: "#5B6B7C", margin: "4px 0 0" }}>
            Define when the incident log should raise an alert and who gets notified - no code required.
          </p>
          {!canManage && (
            <p style={{ fontSize: 12, color: "#B9770E", margin: "6px 0 0" }}>
              Read-only for your role {"—"} Safety Officers and Managers can add or edit rules.
            </p>
          )}
        </div>
        {canManage && (
          <button
            onClick={startAdd}
            style={{ display: "flex", alignItems: "center", gap: 6, padding: "9px 14px", borderRadius: 7, border: "none", background: "#F5A623", color: "#10233A", fontWeight: 700, fontSize: 13.5 }}
          >
            <Plus size={15} /> Add rule
          </button>
        )}
      </div>

      {rules.length === 0 && <p style={{ fontSize: 13.5, color: "#8291A0" }}>No rules configured yet.</p>}

      <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 20 }}>
        {rules.map((rule) => (
          <div key={rule.id} style={{ ...cardStyle, padding: 16, opacity: rule.enabled ? 1 : 0.55 }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
              <div style={{ flex: 1, minWidth: 220 }}>
                <div style={{ fontWeight: 700, fontSize: 14.5, color: "#10233A" }}>{rule.name}</div>
                <div style={{ fontSize: 13, color: "#5B6B7C", marginTop: 3 }}>{describeRule(rule)}</div>
                <div style={{ fontSize: 12, color: "#8291A0", marginTop: 4 }}>
                  Notify: {rule.notify_role || "-"} {"·"} {channelLabel(rule.channel)}
                  {rule.notify_email ? ` · ${rule.notify_email}` : ""}
                  {rule.notify_whatsapp ? ` · ${rule.notify_whatsapp}` : ""}
                </div>
              </div>
              {canManage && (
                <div style={{ display: "flex", gap: 6, alignItems: "flex-start" }}>
                  <button onClick={() => toggleEnabled(rule)} title={rule.enabled ? "Disable rule" : "Enable rule"} style={iconButtonStyle}>
                    {rule.enabled ? <ToggleRight size={16} color="#1E7E45" /> : <ToggleLeft size={16} color="#8291A0" />}
                  </button>
                  <button onClick={() => startEdit(rule)} style={iconButtonStyle}>
                    Edit
                  </button>
                  <button onClick={() => removeRule(rule.id)} style={{ ...iconButtonStyle, color: "#C0392B" }}>
                    <Trash2 size={14} />
                  </button>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {draft && canManage && (
        <div style={{ ...cardStyle, padding: 20 }}>
          <h3 style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 15, color: "#10233A", margin: "0 0 14px" }}>
            {draft.id ? "Edit rule" : "New rule"}
          </h3>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12 }}>
            <Field label="Rule name">
              <input style={inputStyle} value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} placeholder="Rising fatigue incidents" />
            </Field>
            <Field label="Category">
              <select style={inputStyle} value={draft.category} onChange={(e) => setDraft({ ...draft, category: e.target.value })}>
                <option value="any">Any category</option>
                {CATEGORIES.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.label}
                  </option>
                ))}
              </select>
            </Field>
            {draft.category === "any" && (
              <Field label="Scope">
                <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "#33424F", marginTop: 6 }}>
                  <input type="checkbox" checked={draft.per_category} onChange={(e) => setDraft({ ...draft, per_category: e.target.checked })} />
                  Evaluate separately per category
                </label>
              </Field>
            )}
            <Field label="Evaluate against">
              <select
                style={inputStyle}
                value={draft.severity_field || "severity"}
                onChange={(e) => setDraft({ ...draft, severity_field: e.target.value })}
              >
                <option value="severity">Actual severity</option>
                <option value="potential_severity">Potential severity (HiPo)</option>
              </select>
            </Field>
            <Field label="Threshold count">
              <input
                type="number"
                min="1"
                style={inputStyle}
                value={draft.threshold_count}
                onChange={(e) => setDraft({ ...draft, threshold_count: parseInt(e.target.value, 10) || 1 })}
              />
            </Field>
            <Field label="Time window (days)">
              <input
                type="number"
                min="0"
                style={inputStyle}
                value={draft.window_days}
                onChange={(e) => setDraft({ ...draft, window_days: parseInt(e.target.value, 10) || 0 })}
              />
            </Field>
            <Field label="No time limit">
              <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "#33424F", marginTop: 6 }}>
                <input type="checkbox" checked={draft.window_days === 0} onChange={(e) => setDraft({ ...draft, window_days: e.target.checked ? 0 : 30 })} />
                Match incidents at any time
              </label>
            </Field>
            <Field label="Notify (role / person)">
              <input style={inputStyle} value={draft.notify_role} onChange={(e) => setDraft({ ...draft, notify_role: e.target.value })} placeholder="Terminal HSE Manager" />
            </Field>
            <Field label="Channel (simulated)">
              <select style={inputStyle} value={draft.channel} onChange={(e) => setDraft({ ...draft, channel: e.target.value })}>
                {CHANNELS.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.label}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Notify email (optional)">
              <input
                style={inputStyle}
                type="email"
                value={draft.notify_email || ""}
                onChange={(e) => setDraft({ ...draft, notify_email: e.target.value })}
                placeholder="hse.manager@adports.ae"
              />
            </Field>
            <Field label="Notify WhatsApp (optional)">
              <input
                style={inputStyle}
                value={draft.notify_whatsapp || ""}
                onChange={(e) => setDraft({ ...draft, notify_whatsapp: e.target.value })}
                placeholder="+9715XXXXXXXX"
              />
            </Field>
          </div>
          <p style={{ fontSize: 11.5, color: "#8291A0", marginTop: 6 }}>
            These prefill a real email or WhatsApp message when this rule fires {"—"} nothing sends
            automatically, you review and hit send yourself.
          </p>

          <div style={{ marginTop: 12 }}>
            <Field label="Severities that count">
              <div style={{ display: "flex", gap: 14, flexWrap: "wrap", marginTop: 4 }}>
                {SEVERITIES.map((s) => (
                  <label key={s.id} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, color: "#33424F" }}>
                    <input type="checkbox" checked={draft.severities.includes(s.id)} onChange={() => toggleSeverity(s.id)} />
                    {s.label}
                  </label>
                ))}
              </div>
            </Field>
          </div>

          {formError && <div style={{ marginTop: 10, fontSize: 13, color: "#C0392B" }}>{formError}</div>}

          <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
            <button onClick={saveDraft} style={{ padding: "9px 16px", borderRadius: 7, border: "none", background: "#10233A", color: "#FFF", fontWeight: 600, fontSize: 13.5 }}>
              Save rule
            </button>
            <button onClick={() => setDraft(null)} style={{ padding: "9px 16px", borderRadius: 7, border: "1px solid #D6DCE2", background: "#FFF", color: "#5B6B7C", fontWeight: 600, fontSize: 13.5 }}>
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function ImportExportView({
  csvHeaders,
  csvRows,
  fieldMapping,
  setFieldMapping,
  onCsvUpload,
  onClearStaging,
  onRunImport,
  importing,
  importProgress,
  importSummary,
  importError,
  canManage,
  incidents,
  onExportExcel,
  onExportIsoJson,
}) {
  return (
    <div>
      <div style={{ ...cardStyle, padding: 22, marginBottom: 20 }}>
        <h2 style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 17, color: "#10233A", margin: "0 0 6px" }}>
          Import from SENYAR or another HSE system
        </h2>
        <p style={{ fontSize: 13, color: "#5B6B7C", margin: "0 0 10px", lineHeight: 1.6 }}>
          Export incidents from SENYAR (or any HSE platform) as CSV, upload it below, and map the columns once.
          Quaywatch auto-classifies any rows missing a recognized category or severity using AI, so records from an
          external system flow into the same dashboard, rule engine, and reports as ones logged here.
        </p>
        <div
          style={{
            display: "flex",
            gap: 8,
            alignItems: "flex-start",
            fontSize: 12,
            color: "#5B6B7C",
            background: "#F4F6F8",
            borderRadius: 8,
            padding: "10px 12px",
            marginBottom: 16,
          }}
        >
          <Info size={14} style={{ marginTop: 1, flexShrink: 0 }} />
          <span>
            There isn't one single universal ISO schema for HSE incident interchange the way there is for some other
            domains {"—"} so this uses a documented, field-mapped structure instead. Dates follow ISO 8601, and
            severity labels are written to align with GRI 403 (2018) disclosure terms and ISO 45001 terminology, so
            the export below is easy to crosswalk into SENYAR or any other platform.
          </span>
        </div>

        {!canManage && (
          <p style={{ fontSize: 12.5, color: "#B9770E", marginBottom: 12 }}>
            Only Safety Officers and Managers can import data. You can still export below.
          </p>
        )}

        {canManage && (
          <>
            <label style={{ ...smallButtonStyle, display: "inline-flex" }}>
              <Upload size={14} /> Upload CSV from SENYAR
              <input type="file" accept=".csv" onChange={onCsvUpload} style={{ display: "none" }} />
            </label>
            {importError && <div style={{ fontSize: 13, color: "#C0392B", marginTop: 10 }}>{importError}</div>}

            {csvHeaders.length > 0 && (
              <div style={{ marginTop: 16 }}>
                <div style={{ fontSize: 13, color: "#33424F", marginBottom: 10 }}>
                  Detected {csvHeaders.length} column{csvHeaders.length === 1 ? "" : "s"} across {csvRows.length} row
                  {csvRows.length === 1 ? "" : "s"}. Map each field below {"—"} leave as "Not present" if this
                  file doesn't have it.
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 10, marginBottom: 14 }}>
                  {IMPORT_TARGET_FIELDS.map((f) => (
                    <Field key={f.key} label={f.label}>
                      <select
                        style={inputStyle}
                        value={fieldMapping[f.key] || ""}
                        onChange={(e) => setFieldMapping((prev) => ({ ...prev, [f.key]: e.target.value }))}
                      >
                        <option value="">-- Not present --</option>
                        {csvHeaders.map((h) => (
                          <option key={h} value={h}>
                            {h}
                          </option>
                        ))}
                      </select>
                    </Field>
                  ))}
                </div>

                <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                  <button
                    onClick={onRunImport}
                    disabled={importing}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 7,
                      padding: "10px 16px",
                      borderRadius: 7,
                      border: "none",
                      background: importing ? "#C9D2D8" : "#10233A",
                      color: "#FFF",
                      fontWeight: 600,
                      fontSize: 13.5,
                    }}
                  >
                    {importing ? <Loader2 size={15} style={{ animation: "spin 1s linear infinite" }} /> : <Upload size={15} />}
                    {importing
                      ? importProgress
                        ? `Importing ${importProgress.done} of ${importProgress.total}...`
                        : "Importing..."
                      : `Import ${csvRows.length} row${csvRows.length === 1 ? "" : "s"}`}
                  </button>
                  <button
                    onClick={onClearStaging}
                    disabled={importing}
                    style={{ padding: "10px 14px", borderRadius: 7, border: "1px solid #D6DCE2", background: "#FFF", color: "#5B6B7C", fontWeight: 600, fontSize: 13.5 }}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}

            {importSummary && (
              <div style={{ marginTop: 14, display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "#1E7E45", background: "#E9F7EF", padding: "10px 12px", borderRadius: 6 }}>
                <CircleCheck size={16} />
                Imported {importSummary.imported} incident{importSummary.imported === 1 ? "" : "s"}
                {importSummary.classified > 0
                  ? ` — ${importSummary.classified} classified automatically by AI.`
                  : "."}
              </div>
            )}
          </>
        )}
      </div>

      <div style={{ ...cardStyle, padding: 22 }}>
        <h2 style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 17, color: "#10233A", margin: "0 0 6px" }}>
          Export
        </h2>
        <p style={{ fontSize: 13, color: "#5B6B7C", margin: "0 0 14px" }}>
          {incidents.length} incident{incidents.length === 1 ? "" : "s"} in the log right now.
        </p>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <button
            onClick={onExportExcel}
            disabled={incidents.length === 0}
            style={{ display: "flex", alignItems: "center", gap: 7, padding: "10px 16px", borderRadius: 7, border: "1px solid #D6DCE2", background: "#FFF", color: "#10233A", fontWeight: 600, fontSize: 13.5 }}
          >
            <Download size={15} /> Export Excel
          </button>
          <button
            onClick={onExportIsoJson}
            disabled={incidents.length === 0}
            style={{ display: "flex", alignItems: "center", gap: 7, padding: "10px 16px", borderRadius: 7, border: "1px solid #D6DCE2", background: "#FFF", color: "#10233A", fontWeight: 600, fontSize: 13.5 }}
          >
            <Download size={15} /> Export ISO-aligned JSON
          </button>
        </div>
        <p style={{ fontSize: 11.5, color: "#8291A0", marginTop: 10 }}>
          The JSON export includes ISO 8601 timestamps, a GRI 403 severity class per incident, and a documented field
          list {"—"} intended to be crosswalked into SENYAR or any other HSE platform's own import format.
        </p>
      </div>
    </div>
  );
}
