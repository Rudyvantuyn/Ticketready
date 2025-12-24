import OpenAI from "openai";
import { getOrSetVisitorId, isPro } from "../../lib/cookies";
import { consumeFreeGeneration, getFreeUsageStatus, isFreeLimitReached } from "../../lib/rateLimit";
import {
  systemPrompt,
  incidentUserPrompt,
  serviceUserPrompt,
  checklistUserPrompt,
  computePrioritySuggestion
} from "../../lib/prompts";

function asStr(x, max = 2000) {
  if (typeof x !== "string") return "";
  const s = x.trim();
  return s.length > max ? s.slice(0, max) : s;
}

function safeArrayStrings(arr, max = 12) {
  if (!Array.isArray(arr)) return [];
  return arr.map((x) => asStr(String(x), 300)).filter(Boolean).slice(0, max);
}

function requireEnv(name) {
  const v = process.env[name];
  if (!v) throw new Error(`${name} is not set`);
  return v;
}

function parseJsonOrNull(text) {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function buildFallbackIncident(input, pro, prioritySuggestion) {
  const plain =
`Summary:
User reports an issue with ${input.app_service} on ${input.platform}. ${input.issue_title}

Symptoms:
- ${input.user_description}

Impact:
Impact scope: ${input.impact_scope || "Single user"}; Urgency: ${input.urgency || "Normal"}

Timing/Frequency:
Start: ${input.start_time || "Unknown"}; Frequency: ${input.frequency || "Unknown"}

Environment:
Platform: ${input.platform}; App/Service: ${input.app_service}; Network: ${input.network_context || "Unknown"}; Location: ${input.location || "Unknown"}

Evidence:
${input.error_message ? input.error_message : "Unknown"}

What changed:
${input.what_changed || "Unknown"}

Already tried:
${input.already_tried || "Unknown"}

Requested action:
Investigate and restore service.`;

  return {
    mode: pro ? "pro" : "free",
    ticket_title: `${input.app_service} - ${input.issue_title}`.slice(0, 90),
    ticket_description_plain: plain,
    ticket_description_markdown: pro ? plain.replace(/^(.+):$/gm, "## $1") : null,
    category: pro ? "Other" : null,
    priority_suggestion: pro ? prioritySuggestion : null,
    clarifying_questions: pro ? ["What is the exact timestamp of first occurrence?", "Is it affecting other users?"] : [],
    agent_notes: pro
      ? {
          possible_causes: ["Transient service issue", "Network/DNS/VPN path issue", "Authentication/session issue"],
          first_line_checks: [
            "Confirm exact error message and reproduction steps",
            "Test from another network (if possible) to isolate LAN/VPN",
            "Re-authenticate (sign out/in) and retry",
            "Check service status / known incidents"
          ]
        }
      : { possible_causes: [], first_line_checks: [] }
  };
}

function buildFallbackService(input, pro) {
  return {
    mode: pro ? "pro" : "free",
    short_portal_description: `${input.service_name}: ${input.purpose_value}`.slice(0, 180),
    service_catalog_entry: pro ? `Service: ${input.service_name}\nPurpose: ${input.purpose_value}\nTarget users: ${input.target_users}` : null,
    sla_snippet: pro ? "Support is provided during published support hours. Response and resolution targets depend on priority and impact." : null,
    acceptance_criteria: pro ? ["Request validated", "Service delivered as requested", "User confirmed access/functionality"] : []
  };
}

function buildFallbackChecklist(input, pro) {
  const plain =
`1) Confirm scope, exact symptoms, and error message.
2) Reproduce the issue (if possible) and capture evidence (screenshot/log snippet).
3) Quick win: restart app/device; sign out/in; try private/incognito session (web).
4) Check connectivity (LAN/Wi-Fi), VPN status, and captive portal.
5) Isolation test: try another network or another device/user to narrow the cause.
6) Check DNS/name resolution (if applicable) and basic reachability.
7) Validate permissions/licensing (if tools available and relevant).
8) Document steps taken and outcomes.
9) Escalate with: timeline, evidence, environment details, and reproduction steps.`;

  return {
    mode: pro ? "pro" : "free",
    tier1_checklist_plain: plain,
    tier1_checklist_markdown: pro ? plain.replace(/^(\d+\))/gm, "1.") : null,
    do_dont: pro ? ["Do capture exact error text", "Do isolate with a different network", "Don’t apply risky changes without approval"] : [],
    escalation_package_template: pro
      ? "Summary:\nImpact:\nTimeline:\nEnvironment:\nSteps tried:\nEvidence:\nRequested escalation to:"
      : null
  };
}

export default async function handler(req, res) {
  try {
    if (req.method !== "POST") {
      res.status(405).json({ error: "Method not allowed" });
      return;
    }

    const apiKey = requireEnv("OPENAI_API_KEY");
    const model = process.env.OPENAI_MODEL || "gpt-5.2";

    const trId = getOrSetVisitorId(req, res);
    const pro = isPro(req);

    // Enforce free limit
    if (!pro) {
      const st = await getFreeUsageStatus(trId);
      if (isFreeLimitReached(st.used)) {
        res.status(402).json({ error: "Free limit reached", code: "FREE_LIMIT_REACHED" });
        return;
      }
      await consumeFreeGeneration(trId);
    }

    const body = req.body || {};
    const type = asStr(body.type, 30);

    const client = new OpenAI({ apiKey });

    const sys = systemPrompt();

    let userPrompt = "";
    let prioritySuggestion = null;

    if (type === "incident") {
      const input = {
        issue_title: asStr(body.issue_title, 80),
        platform: asStr(body.platform, 20) || "Other",
        app_service: asStr(body.app_service, 60),
        user_description: asStr(body.user_description, 1200),
        error_message: asStr(body.error_message || "", 200) || null,
        start_time: asStr(body.start_time || "Unknown", 40),
        frequency: asStr(body.frequency || "Unknown", 40),
        impact_scope: asStr(body.impact_scope || "Single user", 40),
        urgency: asStr(body.urgency || "Normal", 20),
        location: asStr(body.location || "Unknown", 20),
        network_context: asStr(body.network_context || "Unknown", 30),
        what_changed: asStr(body.what_changed || "", 200) || null,
        already_tried: asStr(body.already_tried || "", 300) || null
      };

      if (input.issue_title.length < 3 || input.app_service.length < 2 || input.user_description.length < 10) {
        res.status(400).json({ error: "Missing required incident fields." });
        return;
      }

      prioritySuggestion = computePrioritySuggestion({
        urgency: input.urgency,
        impact_scope: input.impact_scope
      });

      userPrompt = incidentUserPrompt(input, pro, prioritySuggestion);

      const response = await client.responses.create({
        model,
        input: [
          { role: "system", content: sys },
          { role: "user", content: userPrompt }
        ],
        max_output_tokens: pro ? 950 : 650
      });

      const text = response.output_text || "";
      const parsed = parseJsonOrNull(text);

      if (!parsed) {
        res.status(200).json(buildFallbackIncident(input, pro, prioritySuggestion));
        return;
      }

      // Sanitize and enforce pro gating
      const out = {
        mode: pro ? "pro" : "free",
        ticket_title: asStr(parsed.ticket_title || "", 90) || `${input.app_service} - ${input.issue_title}`.slice(0, 90),
        ticket_description_plain: asStr(parsed.ticket_description_plain || "", 5000) || buildFallbackIncident(input, pro, prioritySuggestion).ticket_description_plain,
        ticket_description_markdown: pro ? asStr(parsed.ticket_description_markdown || "", 7000) || null : null,
        category: pro ? asStr(parsed.category || "", 40) || null : null,
        priority_suggestion: pro ? asStr(parsed.priority_suggestion || "", 40) || prioritySuggestion : null,
        clarifying_questions: pro ? safeArrayStrings(parsed.clarifying_questions, 5) : [],
        agent_notes: pro
          ? {
              possible_causes: safeArrayStrings(parsed?.agent_notes?.possible_causes, 10),
              first_line_checks: safeArrayStrings(parsed?.agent_notes?.first_line_checks, 12)
            }
          : { possible_causes: [], first_line_checks: [] }
      };

      res.status(200).json(out);
      return;
    }

    if (type === "service") {
      const input = {
        service_name: asStr(body.service_name, 80),
        purpose_value: asStr(body.purpose_value, 250),
        target_users: asStr(body.target_users, 120),
        support_hours: asStr(body.support_hours || "", 80) || null,
        channels: Array.isArray(body.channels) ? body.channels.map((x) => asStr(String(x), 20)).filter(Boolean).slice(0, 6) : [],
        dependencies: asStr(body.dependencies || "", 200) || null,
        request_types: Array.isArray(body.request_types) ? body.request_types.map((x) => asStr(String(x), 20)).filter(Boolean).slice(0, 6) : [],
        standard_fulfillment_time: asStr(body.standard_fulfillment_time || "", 60) || null,
        out_of_scope: asStr(body.out_of_scope || "", 200) || null
      };

      if (input.service_name.length < 3 || input.purpose_value.length < 10 || input.target_users.length < 3) {
        res.status(400).json({ error: "Missing required service fields." });
        return;
      }

      userPrompt = serviceUserPrompt(input, pro);

      const response = await client.responses.create({
        model,
        input: [
          { role: "system", content: sys },
          { role: "user", content: userPrompt }
        ],
        max_output_tokens: pro ? 650 : 350
      });

      const text = response.output_text || "";
      const parsed = parseJsonOrNull(text);

      if (!parsed) {
        res.status(200).json(buildFallbackService(input, pro));
        return;
      }

      const out = {
        mode: pro ? "pro" : "free",
        short_portal_description: asStr(parsed.short_portal_description || "", 220) || buildFallbackService(input, pro).short_portal_description,
        service_catalog_entry: pro ? asStr(parsed.service_catalog_entry || "", 2500) || null : null,
        sla_snippet: pro ? asStr(parsed.sla_snippet || "", 800) || null : null,
        acceptance_criteria: pro ? safeArrayStrings(parsed.acceptance_criteria, 6) : []
      };

      res.status(200).json(out);
      return;
    }

    if (type === "checklist") {
      const input = {
        issue_type: asStr(body.issue_type, 20) || "Other",
        platform: asStr(body.platform, 20) || "Other",
        symptoms: asStr(body.symptoms, 400),
        tools_available: Array.isArray(body.tools_available) ? body.tools_available.map((x) => asStr(String(x), 20)).filter(Boolean).slice(0, 10) : [],
        risk_level: asStr(body.risk_level || "Low", 10),
        known_context: asStr(body.known_context || "", 200) || null
      };

      if (input.symptoms.length < 6) {
        res.status(400).json({ error: "Missing required checklist fields." });
        return;
      }

      userPrompt = checklistUserPrompt(input, pro);

      const response = await client.responses.create({
        model,
        input: [
          { role: "system", content: sys },
          { role: "user", content: userPrompt }
        ],
        max_output_tokens: pro ? 650 : 350
      });

      const text = response.output_text || "";
      const parsed = parseJsonOrNull(text);

      if (!parsed) {
        res.status(200).json(buildFallbackChecklist(input, pro));
        return;
      }

      const out = {
        mode: pro ? "pro" : "free",
        tier1_checklist_plain: asStr(parsed.tier1_checklist_plain || "", 2500) || buildFallbackChecklist(input, pro).tier1_checklist_plain,
        tier1_checklist_markdown: pro ? asStr(parsed.tier1_checklist_markdown || "", 2500) || null : null,
        do_dont: pro ? safeArrayStrings(parsed.do_dont, 8) : [],
        escalation_package_template: pro ? asStr(parsed.escalation_package_template || "", 1200) || null : null
      };

      res.status(200).json(out);
      return;
    }

    res.status(400).json({ error: "Unknown generation type." });
  } catch (e) {
    res.status(500).json({ error: "Server error", details: e?.message || String(e) });
  }
}
