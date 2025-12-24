export const CATEGORY_SET = [
  "Network",
  "Endpoint",
  "Access & Identity",
  "Application",
  "Hardware",
  "Printing",
  "Email",
  "Other"
];

export const PRIORITY_SET = [
  "P1 (Critical)",
  "P2 (High)",
  "P3 (Normal)",
  "P4 (Low)"
];

export function computePrioritySuggestion({ urgency, impact_scope }) {
  const u = (urgency || "Normal").toLowerCase();
  const i = (impact_scope || "Single user").toLowerCase();

  if (u === "critical" || i.includes("company")) return "P1 (Critical)";
  if (u === "high" && (i.includes("department") || i.includes("multiple"))) return "P1 (Critical)";
  if (u === "high" || i.includes("department")) return "P2 (High)";
  if (u === "normal" && i.includes("multiple")) return "P2 (High)";
  if (u === "low") return "P4 (Low)";
  return "P3 (Normal)";
}

export function systemPrompt() {
  return `
You are an experienced IT service desk assistant working with ITIL-light principles.

GLOBAL RULES:
- English only.
- Return VALID JSON only. No markdown. No extra commentary.
- Do not invent internal tools/vendors. Only use what user explicitly mentions.
- Keep troubleshooting safe: no destructive or risky steps (no registry edits, disabling security, wiping, reinstalling) in MVP.
- If information is missing, use "Unknown" and include clarifying questions rather than guessing.
- Keep outputs concise and ticket-ready.
`;
}

export function incidentUserPrompt(input, pro, prioritySuggestion) {
  return `
TASK: Create ticket-ready incident output.

INPUT (user provided):
- issue_title: ${input.issue_title}
- platform: ${input.platform}
- app_service: ${input.app_service}
- user_description: ${input.user_description}
- error_message: ${input.error_message || "Unknown"}
- start_time: ${input.start_time || "Unknown"}
- frequency: ${input.frequency || "Unknown"}
- impact_scope: ${input.impact_scope || "Single user"}
- urgency: ${input.urgency || "Normal"}
- location: ${input.location || "Unknown"}
- network_context: ${input.network_context || "Unknown"}
- what_changed: ${input.what_changed || "Unknown"}
- already_tried: ${input.already_tried || "Unknown"}

OUTPUT SCHEMA (JSON):
{
  "mode": "${pro ? "pro" : "free"}",
  "ticket_title": "string (<=90 chars)",
  "ticket_description_plain": "string with sections in this EXACT order:
Summary
Symptoms
Impact
Timing/Frequency
Environment
Evidence
What changed
Already tried
Requested action",
  "ticket_description_markdown": ${pro ? "\"string (same content, markdown headings)\"" : "null"},
  "category": ${pro ? "\"one of: " + CATEGORY_SET.join(" | ") + "\"" : "null"},
  "priority_suggestion": ${pro ? "\"one of: " + PRIORITY_SET.join(" | ") + "\" (default: " + prioritySuggestion + ")" : "null"},
  "clarifying_questions": ${pro ? "[max 5 strings]" : "[]"},
  "agent_notes": ${
    pro
      ? `{
    "possible_causes": [max 10 strings],
    "first_line_checks": [max 12 strings]
  }`
      : `{
    "possible_causes": [],
    "first_line_checks": []
  }`
  }
}

CONSTRAINTS:
- Each section should be 1-3 lines max (Symptoms can include bullets inside the section).
- Title should be specific and include app/service + symptom.
- If any critical details are unknown, include up to 5 clarifying questions (pro only).
- category must be strictly from the list (pro only).
- priority_suggestion should align with urgency + impact, unless user_description indicates broader outage.
`;
}

export function serviceUserPrompt(input, pro) {
  return `
TASK: Generate service catalog text.

INPUT:
- service_name: ${input.service_name}
- purpose_value: ${input.purpose_value}
- target_users: ${input.target_users}
- support_hours: ${input.support_hours || "Unknown"}
- channels: ${(input.channels || []).join(", ") || "Unknown"}
- dependencies: ${input.dependencies || "Unknown"}
- request_types: ${(input.request_types || []).join(", ") || "Unknown"}
- standard_fulfillment_time: ${input.standard_fulfillment_time || "Unknown"}
- out_of_scope: ${input.out_of_scope || "Unknown"}

OUTPUT JSON:
{
  "mode": "${pro ? "pro" : "free"}",
  "short_portal_description": "one sentence",
  "service_catalog_entry": ${pro ? "\"structured text with headings\"" : "null"},
  "sla_snippet": ${pro ? "\"short reusable SLA snippet\"" : "null"},
  "acceptance_criteria": ${pro ? "[max 6 strings]" : "[]"}
}

RULES:
- Keep it generic and professional.
- No invented systems unless mentioned.
`;
}

export function checklistUserPrompt(input, pro) {
  return `
TASK: Generate a Tier-1 troubleshooting checklist.

INPUT:
- issue_type: ${input.issue_type}
- platform: ${input.platform}
- symptoms: ${input.symptoms}
- tools_available: ${(input.tools_available || []).join(", ") || "Unknown"}
- risk_level: ${input.risk_level || "Low"}
- known_context: ${input.known_context || "Unknown"}

OUTPUT JSON:
{
  "mode": "${pro ? "pro" : "free"}",
  "tier1_checklist_plain": "8-10 steps, numbered, plain text",
  "tier1_checklist_markdown": ${pro ? "\"same but markdown\"" : "null"},
  "do_dont": ${pro ? "[max 8 strings]" : "[]"},
  "escalation_package_template": ${pro ? "\"copy/paste template\"" : "null"}
}

RULES:
- Steps order: gather facts -> quick wins -> isolate -> environment -> evidence -> escalate.
- Conservative and safe.
- Avoid destructive actions.
`;
}
