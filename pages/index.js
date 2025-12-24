import { useEffect, useMemo, useState } from "react";
import brand from "../config/brand.json";

function cx(...a) {
  return a.filter(Boolean).join(" ");
}

function CopyButton({ text, label }) {
  return (
    <button
      className="rounded-xl bg-slate-950/50 border border-slate-700 px-3 py-2 text-sm hover:bg-slate-950"
      onClick={() => navigator.clipboard.writeText(text || "")}
      disabled={!text}
      title={!text ? "Nothing to copy" : "Copy to clipboard"}
    >
      {label}
    </button>
  );
}

function LockedPill() {
  return (
    <span className="ml-2 rounded-full border border-amber-700 bg-amber-950/40 px-2 py-0.5 text-xs text-amber-200">
      Pro
    </span>
  );
}

export default function Home() {
  const [tab, setTab] = useState("incident"); // incident | service | checklist
  const [status, setStatus] = useState({ mode: "free", remaining: 3, limit: 3, storage: "unknown" });
  const [showUnlock, setShowUnlock] = useState(false);
  const [licenseKey, setLicenseKey] = useState("");
  const [unlockMsg, setUnlockMsg] = useState("");

  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [result, setResult] = useState(null);

  // Incident inputs
  const [issueTitle, setIssueTitle] = useState("");
  const [platform, setPlatform] = useState("Windows");
  const [appService, setAppService] = useState("");
  const [userDescription, setUserDescription] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [startTime, setStartTime] = useState("Unknown");
  const [frequency, setFrequency] = useState("Unknown");
  const [impactScope, setImpactScope] = useState("Single user");
  const [urgency, setUrgency] = useState("Normal");
  const [location, setLocation] = useState("Unknown");
  const [networkContext, setNetworkContext] = useState("Unknown");
  const [whatChanged, setWhatChanged] = useState("");
  const [alreadyTried, setAlreadyTried] = useState("");

  // Service inputs
  const [serviceName, setServiceName] = useState("");
  const [purposeValue, setPurposeValue] = useState("");
  const [targetUsers, setTargetUsers] = useState("");
  const [supportHours, setSupportHours] = useState("");
  const [channels, setChannels] = useState({ Portal: true, Email: false, Phone: false, Chat: false });
  const [dependencies, setDependencies] = useState("");
  const [requestTypes, setRequestTypes] = useState({ Access: true, Change: true, Incident: true, Info: false });
  const [fulfillment, setFulfillment] = useState("");
  const [outOfScope, setOutOfScope] = useState("");

  // Checklist inputs
  const [issueType, setIssueType] = useState("Network");
  const [symptoms, setSymptoms] = useState("");
  const [tools, setTools] = useState({ Ping: true, nslookup: false, RMM: false, Intune: false, "M365 admin": false, Logs: false });
  const [riskLevel, setRiskLevel] = useState("Low");
  const [knownContext, setKnownContext] = useState("");

  useEffect(() => {
    refreshStatus();
  }, []);

  async function refreshStatus() {
    const r = await fetch("/api/status");
    const d = await r.json();
    setStatus(d);
  }

  async function unlockPro() {
    setUnlockMsg("");
    setErrorMsg("");
    try {
      const r = await fetch("/api/verify-license", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ licenseKey })
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d?.error || "Unlock failed");
      setUnlockMsg("Pro unlocked ✅");
      setShowUnlock(false);
      setLicenseKey("");
      await refreshStatus();
    } catch (e) {
      setUnlockMsg(e?.message || "Unlock failed");
    }
  }

  async function generate() {
    setErrorMsg("");
    setResult(null);

    // basic validation per tab
    if (tab === "incident") {
      if (issueTitle.trim().length < 3) return setErrorMsg("Issue title is required (min 3 chars).");
      if (appService.trim().length < 2) return setErrorMsg("App/Service is required.");
      if (userDescription.trim().length < 10) return setErrorMsg("User description is required (min 10 chars).");
    }
    if (tab === "service") {
      if (serviceName.trim().length < 3) return setErrorMsg("Service name is required.");
      if (purposeValue.trim().length < 10) return setErrorMsg("Purpose/value is required (min 10 chars).");
      if (targetUsers.trim().length < 3) return setErrorMsg("Target users is required.");
    }
    if (tab === "checklist") {
      if (symptoms.trim().length < 6) return setErrorMsg("Symptoms is required (min 6 chars).");
    }

    setLoading(true);
    try {
      const payload =
        tab === "incident"
          ? {
              type: "incident",
              issue_title: issueTitle.trim(),
              platform,
              app_service: appService.trim(),
              user_description: userDescription.trim(),
              error_message: errorMessage.trim() || null,
              start_time: startTime,
              frequency,
              impact_scope: impactScope,
              urgency,
              location,
              network_context: networkContext,
              what_changed: whatChanged.trim() || null,
              already_tried: alreadyTried.trim() || null
            }
          : tab === "service"
          ? {
              type: "service",
              service_name: serviceName.trim(),
              purpose_value: purposeValue.trim(),
              target_users: targetUsers.trim(),
              support_hours: supportHours.trim() || null,
              channels: Object.entries(channels)
                .filter(([, v]) => v)
                .map(([k]) => k),
              dependencies: dependencies.trim() || null,
              request_types: Object.entries(requestTypes)
                .filter(([, v]) => v)
                .map(([k]) => k),
              standard_fulfillment_time: fulfillment.trim() || null,
              out_of_scope: outOfScope.trim() || null
            }
          : {
              type: "checklist",
              issue_type: issueType,
              platform,
              symptoms: symptoms.trim(),
              tools_available: Object.entries(tools)
                .filter(([, v]) => v)
                .map(([k]) => k),
              risk_level: riskLevel,
              known_context: knownContext.trim() || null
            };

      const r = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      const d = await r.json();
      if (!r.ok) {
        if (d?.code === "FREE_LIMIT_REACHED") {
          setShowUnlock(true);
        }
        throw new Error(d?.error || "Generation failed");
      }
      setResult(d);
      await refreshStatus();
    } catch (e) {
      setErrorMsg(e?.message || "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  const pro = status?.mode === "pro";

  const proBanner = (
    <div className="rounded-2xl border border-slate-700 bg-slate-950/40 p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-sm font-semibold">
            {pro ? "Pro unlocked ✅" : "Free mode"}
          </div>
          <div className="mt-1 text-sm text-slate-300">
            {pro
              ? "Unlimited generations + Pro fields enabled."
              : `Free generations remaining today: ${status.remaining}/${status.limit}`}
          </div>
          {!pro && status.storage === "memory" ? (
            <div className="mt-2 text-xs text-amber-200">
              Note: Rate limit storage is in-memory (configure Upstash for persistent daily limits).
            </div>
          ) : null}
        </div>
        <div className="flex gap-2">
          {!pro ? (
            <button
              className="rounded-xl bg-brandPrimary px-3 py-2 text-sm font-semibold text-slate-950 hover:brightness-110"
              onClick={() => setShowUnlock(true)}
            >
              Unlock Pro
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );

  const header = (
    <div className="sticky top-0 z-10 border-b border-slate-800 bg-brandDark/80 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4">
        <div>
          <div className="text-xl font-semibold">{brand.appName}</div>
          <div className="text-sm text-slate-400">{brand.tagline}</div>
        </div>
        <div className="flex items-center gap-2">
          <button
            className={cx("rounded-xl px-3 py-2 text-sm font-semibold border", tab === "incident" ? "bg-brandPrimary text-slate-950 border-transparent" : "bg-slate-950/40 border-slate-700 hover:bg-slate-950")}
            onClick={() => setTab("incident")}
          >
            Incident
          </button>
          <button
            className={cx("rounded-xl px-3 py-2 text-sm font-semibold border", tab === "service" ? "bg-brandPrimary text-slate-950 border-transparent" : "bg-slate-950/40 border-slate-700 hover:bg-slate-950")}
            onClick={() => setTab("service")}
          >
            Service
          </button>
          <button
            className={cx("rounded-xl px-3 py-2 text-sm font-semibold border", tab === "checklist" ? "bg-brandPrimary text-slate-950 border-transparent" : "bg-slate-950/40 border-slate-700 hover:bg-slate-950")}
            onClick={() => setTab("checklist")}
          >
            Checklist
          </button>
        </div>
      </div>
    </div>
  );

  const outputPanel = (
    <div className="rounded-2xl border border-slate-800 bg-slate-950/30 p-5">
      <div className="flex items-center justify-between">
        <div className="text-lg font-semibold">Output</div>
        <button
          className={cx(
            "rounded-xl px-4 py-2 text-sm font-semibold transition",
            loading ? "bg-slate-800 text-slate-300 cursor-not-allowed" : "bg-brandAccent text-slate-950 hover:brightness-110"
          )}
          onClick={generate}
          disabled={loading}
        >
          {loading ? "Generating..." : "Generate"}
        </button>
      </div>

      {errorMsg ? (
        <div className="mt-4 rounded-xl border border-red-900 bg-red-950/40 px-3 py-2 text-sm text-red-200">
          {errorMsg}
        </div>
      ) : null}

      {!result ? (
        <div className="mt-4 text-sm text-slate-400">
          Fill in the form and click <b>Generate</b>.
        </div>
      ) : (
        <div className="mt-4 space-y-4">
          {/* Incident */}
          {tab === "incident" ? (
            <>
              <div className="rounded-xl border border-slate-800 bg-slate-950/40 p-4">
                <div className="text-xs text-slate-400">Ticket title</div>
                <div className="mt-1 font-semibold">{result.ticket_title || "—"}</div>
              </div>

              <div className="rounded-xl border border-slate-800 bg-slate-950/40 p-4">
                <div className="flex items-center justify-between">
                  <div className="text-xs text-slate-400">Ticket description (plain)</div>
                  <CopyButton text={result.ticket_description_plain} label="Copy plain" />
                </div>
                <pre className="mt-3 whitespace-pre-wrap text-sm text-slate-100">{result.ticket_description_plain || "—"}</pre>
              </div>

              <div className="rounded-xl border border-slate-800 bg-slate-950/40 p-4">
                <div className="flex items-center justify-between">
                  <div className="text-xs text-slate-400">
                    Ticket description (markdown)
                    {!pro ? <LockedPill /> : null}
                  </div>
                  <CopyButton text={pro ? result.ticket_description_markdown : ""} label="Copy markdown" />
                </div>
                <pre className="mt-3 whitespace-pre-wrap text-sm text-slate-100">
                  {pro ? (result.ticket_description_markdown || "—") : "Unlock Pro to access markdown output."}
                </pre>
              </div>

              <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                <div className="rounded-xl border border-slate-800 bg-slate-950/40 p-4">
                  <div className="text-xs text-slate-400">
                    Category {!pro ? <LockedPill /> : null}
                  </div>
                  <div className="mt-1 font-semibold">{pro ? (result.category || "—") : "Locked"}</div>
                </div>
                <div className="rounded-xl border border-slate-800 bg-slate-950/40 p-4">
                  <div className="text-xs text-slate-400">
                    Priority suggestion {!pro ? <LockedPill /> : null}
                  </div>
                  <div className="mt-1 font-semibold">{pro ? (result.priority_suggestion || "—") : "Locked"}</div>
                </div>
              </div>

              <div className="rounded-xl border border-slate-800 bg-slate-950/40 p-4">
                <div className="text-xs text-slate-400">
                  Clarifying questions {!pro ? <LockedPill /> : null}
                </div>
                <ul className="mt-2 list-disc pl-5 text-sm text-slate-100 space-y-1">
                  {pro
                    ? (result.clarifying_questions || []).map((q, i) => <li key={i}>{q}</li>)
                    : <li>Unlock Pro to see clarifying questions.</li>}
                </ul>
              </div>

              <div className="rounded-xl border border-slate-800 bg-slate-950/40 p-4">
                <div className="text-xs text-slate-400">
                  Agent notes {!pro ? <LockedPill /> : null}
                </div>
                {pro ? (
                  <div className="mt-3 grid grid-cols-1 gap-4 lg:grid-cols-2">
                    <div>
                      <div className="text-sm font-semibold">Possible causes</div>
                      <ul className="mt-2 list-disc pl-5 text-sm text-slate-100 space-y-1">
                        {(result.agent_notes?.possible_causes || []).map((x, i) => <li key={i}>{x}</li>)}
                      </ul>
                    </div>
                    <div>
                      <div className="text-sm font-semibold">First-line checks</div>
                      <ol className="mt-2 list-decimal pl-5 text-sm text-slate-100 space-y-1">
                        {(result.agent_notes?.first_line_checks || []).map((x, i) => <li key={i}>{x}</li>)}
                      </ol>
                    </div>
                  </div>
                ) : (
                  <div className="mt-2 text-sm text-slate-300">Unlock Pro to see agent notes.</div>
                )}
              </div>
            </>
          ) : null}

          {/* Service */}
          {tab === "service" ? (
            <>
              <div className="rounded-xl border border-slate-800 bg-slate-950/40 p-4">
                <div className="flex items-center justify-between">
                  <div className="text-xs text-slate-400">Short portal description</div>
                  <CopyButton text={result.short_portal_description} label="Copy" />
                </div>
                <pre className="mt-3 whitespace-pre-wrap text-sm text-slate-100">{result.short_portal_description || "—"}</pre>
              </div>

              <div className="rounded-xl border border-slate-800 bg-slate-950/40 p-4">
                <div className="text-xs text-slate-400">
                  Service catalog entry {!pro ? <LockedPill /> : null}
                </div>
                <pre className="mt-3 whitespace-pre-wrap text-sm text-slate-100">
                  {pro ? (result.service_catalog_entry || "—") : "Unlock Pro to access the catalog entry."}
                </pre>
              </div>

              <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                <div className="rounded-xl border border-slate-800 bg-slate-950/40 p-4">
                  <div className="text-xs text-slate-400">
                    SLA snippet {!pro ? <LockedPill /> : null}
                  </div>
                  <pre className="mt-3 whitespace-pre-wrap text-sm text-slate-100">
                    {pro ? (result.sla_snippet || "—") : "Locked"}
                  </pre>
                </div>

                <div className="rounded-xl border border-slate-800 bg-slate-950/40 p-4">
                  <div className="text-xs text-slate-400">
                    Acceptance criteria {!pro ? <LockedPill /> : null}
                  </div>
                  <ul className="mt-2 list-disc pl-5 text-sm text-slate-100 space-y-1">
                    {pro ? (result.acceptance_criteria || []).map((x, i) => <li key={i}>{x}</li>) : <li>Locked</li>}
                  </ul>
                </div>
              </div>
            </>
          ) : null}

          {/* Checklist */}
          {tab === "checklist" ? (
            <>
              <div className="rounded-xl border border-slate-800 bg-slate-950/40 p-4">
                <div className="flex items-center justify-between">
                  <div className="text-xs text-slate-400">Tier-1 checklist (plain)</div>
                  <CopyButton text={result.tier1_checklist_plain} label="Copy" />
                </div>
                <pre className="mt-3 whitespace-pre-wrap text-sm text-slate-100">{result.tier1_checklist_plain || "—"}</pre>
              </div>

              <div className="rounded-xl border border-slate-800 bg-slate-950/40 p-4">
                <div className="text-xs text-slate-400">
                  Tier-1 checklist (markdown) {!pro ? <LockedPill /> : null}
                </div>
                <pre className="mt-3 whitespace-pre-wrap text-sm text-slate-100">
                  {pro ? (result.tier1_checklist_markdown || "—") : "Unlock Pro to access markdown."}
                </pre>
              </div>

              <div className="rounded-xl border border-slate-800 bg-slate-950/40 p-4">
                <div className="text-xs text-slate-400">
                  Do / Don’t {!pro ? <LockedPill /> : null}
                </div>
                <ul className="mt-2 list-disc pl-5 text-sm text-slate-100 space-y-1">
                  {pro ? (result.do_dont || []).map((x, i) => <li key={i}>{x}</li>) : <li>Locked</li>}
                </ul>
              </div>

              <div className="rounded-xl border border-slate-800 bg-slate-950/40 p-4">
                <div className="text-xs text-slate-400">
                  Escalation package template {!pro ? <LockedPill /> : null}
                </div>
                <pre className="mt-3 whitespace-pre-wrap text-sm text-slate-100">
                  {pro ? (result.escalation_package_template || "—") : "Locked"}
                </pre>
              </div>
            </>
          ) : null}
        </div>
      )}
    </div>
  );

  const incidentForm = (
    <div className="rounded-2xl border border-slate-800 bg-slate-950/20 p-5">
      <div className="text-lg font-semibold">Incident inputs</div>

      <div className="mt-4 grid grid-cols-1 gap-4">
        <div>
          <label className="text-sm font-semibold text-slate-200">Issue title *</label>
          <input
            className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950/40 px-3 py-2 outline-none focus:border-brandPrimary"
            value={issueTitle}
            onChange={(e) => setIssueTitle(e.target.value)}
            placeholder="e.g., Outlook cannot connect"
          />
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div>
            <label className="text-sm font-semibold text-slate-200">Platform *</label>
            <select
              className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950/40 px-3 py-2 outline-none focus:border-brandPrimary"
              value={platform}
              onChange={(e) => setPlatform(e.target.value)}
            >
              {["Windows", "macOS", "iOS", "Android", "Web", "Other"].map((x) => (
                <option key={x}>{x}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-sm font-semibold text-slate-200">App/Service *</label>
            <input
              className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950/40 px-3 py-2 outline-none focus:border-brandPrimary"
              value={appService}
              onChange={(e) => setAppService(e.target.value)}
              placeholder="e.g., Teams / VPN / Wi-Fi"
            />
          </div>
        </div>

        <div>
          <label className="text-sm font-semibold text-slate-200">User description *</label>
          <textarea
            className="mt-2 min-h-[120px] w-full rounded-xl border border-slate-700 bg-slate-950/40 px-3 py-2 outline-none focus:border-brandPrimary"
            value={userDescription}
            onChange={(e) => setUserDescription(e.target.value)}
            placeholder="What are they trying to do? What happens? Since when?"
          />
        </div>

        <div>
          <label className="text-sm font-semibold text-slate-200">Error message/code (optional)</label>
          <input
            className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950/40 px-3 py-2 outline-none focus:border-brandPrimary"
            value={errorMessage}
            onChange={(e) => setErrorMessage(e.target.value)}
            placeholder="Paste exact error text"
          />
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div>
            <label className="text-sm font-semibold text-slate-200">Start time</label>
            <select
              className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950/40 px-3 py-2 outline-none focus:border-brandPrimary"
              value={startTime}
              onChange={(e) => setStartTime(e.target.value)}
            >
              {["Today", "Yesterday", "This week", "After change/update", "Specific date", "Unknown"].map((x) => (
                <option key={x}>{x}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-sm font-semibold text-slate-200">Frequency</label>
            <select
              className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950/40 px-3 py-2 outline-none focus:border-brandPrimary"
              value={frequency}
              onChange={(e) => setFrequency(e.target.value)}
            >
              {["Once", "Intermittent", "Constant", "Unknown"].map((x) => (
                <option key={x}>{x}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div>
            <label className="text-sm font-semibold text-slate-200">Impact scope</label>
            <select
              className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950/40 px-3 py-2 outline-none focus:border-brandPrimary"
              value={impactScope}
              onChange={(e) => setImpactScope(e.target.value)}
            >
              {["Single user", "Multiple users", "Department", "Company-wide"].map((x) => (
                <option key={x}>{x}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-sm font-semibold text-slate-200">Urgency</label>
            <select
              className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950/40 px-3 py-2 outline-none focus:border-brandPrimary"
              value={urgency}
              onChange={(e) => setUrgency(e.target.value)}
            >
              {["Low", "Normal", "High", "Critical"].map((x) => (
                <option key={x}>{x}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <div>
            <label className="text-sm font-semibold text-slate-200">Location</label>
            <select
              className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950/40 px-3 py-2 outline-none focus:border-brandPrimary"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
            >
              {["Office", "Home", "Site", "Unknown"].map((x) => (
                <option key={x}>{x}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-sm font-semibold text-slate-200">Network context</label>
            <select
              className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950/40 px-3 py-2 outline-none focus:border-brandPrimary"
              value={networkContext}
              onChange={(e) => setNetworkContext(e.target.value)}
            >
              {["LAN", "Wi-Fi", "VPN", "Mobile hotspot", "Unknown"].map((x) => (
                <option key={x}>{x}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-sm font-semibold text-slate-200">What changed (optional)</label>
            <input
              className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950/40 px-3 py-2 outline-none focus:border-brandPrimary"
              value={whatChanged}
              onChange={(e) => setWhatChanged(e.target.value)}
              placeholder="Update / policy / password"
            />
          </div>
        </div>

        <div>
          <label className="text-sm font-semibold text-slate-200">Already tried (optional)</label>
          <input
            className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950/40 px-3 py-2 outline-none focus:border-brandPrimary"
            value={alreadyTried}
            onChange={(e) => setAlreadyTried(e.target.value)}
            placeholder="Restarted, cleared cache, tried other network..."
          />
        </div>
      </div>
    </div>
  );

  const serviceForm = (
    <div className="rounded-2xl border border-slate-800 bg-slate-950/20 p-5">
      <div className="text-lg font-semibold">Service inputs</div>

      <div className="mt-4 grid grid-cols-1 gap-4">
        <div>
          <label className="text-sm font-semibold text-slate-200">Service name *</label>
          <input
            className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950/40 px-3 py-2 outline-none focus:border-brandPrimary"
            value={serviceName}
            onChange={(e) => setServiceName(e.target.value)}
            placeholder="e.g., VPN Remote Access"
          />
        </div>

        <div>
          <label className="text-sm font-semibold text-slate-200">Purpose/value *</label>
          <textarea
            className="mt-2 min-h-[90px] w-full rounded-xl border border-slate-700 bg-slate-950/40 px-3 py-2 outline-none focus:border-brandPrimary"
            value={purposeValue}
            onChange={(e) => setPurposeValue(e.target.value)}
            placeholder="What value does this service deliver?"
          />
        </div>

        <div>
          <label className="text-sm font-semibold text-slate-200">Target users *</label>
          <input
            className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950/40 px-3 py-2 outline-none focus:border-brandPrimary"
            value={targetUsers}
            onChange={(e) => setTargetUsers(e.target.value)}
            placeholder="e.g., All employees / Sales / HR"
          />
        </div>

        <div>
          <label className="text-sm font-semibold text-slate-200">Support hours (optional)</label>
          <input
            className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950/40 px-3 py-2 outline-none focus:border-brandPrimary"
            value={supportHours}
            onChange={(e) => setSupportHours(e.target.value)}
            placeholder="e.g., Mon–Fri 08:00–17:00 CET"
          />
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div>
            <div className="text-sm font-semibold text-slate-200">Channels (optional)</div>
            <div className="mt-2 space-y-2">
              {Object.keys(channels).map((k) => (
                <label key={k} className="flex items-center gap-2 text-sm text-slate-200">
                  <input
                    type="checkbox"
                    checked={channels[k]}
                    onChange={(e) => setChannels({ ...channels, [k]: e.target.checked })}
                  />
                  {k}
                </label>
              ))}
            </div>
          </div>
          <div>
            <div className="text-sm font-semibold text-slate-200">Request types (optional)</div>
            <div className="mt-2 space-y-2">
              {Object.keys(requestTypes).map((k) => (
                <label key={k} className="flex items-center gap-2 text-sm text-slate-200">
                  <input
                    type="checkbox"
                    checked={requestTypes[k]}
                    onChange={(e) => setRequestTypes({ ...requestTypes, [k]: e.target.checked })}
                  />
                  {k}
                </label>
              ))}
            </div>
          </div>
        </div>

        <div>
          <label className="text-sm font-semibold text-slate-200">Dependencies (optional)</label>
          <input
            className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950/40 px-3 py-2 outline-none focus:border-brandPrimary"
            value={dependencies}
            onChange={(e) => setDependencies(e.target.value)}
            placeholder="e.g., SSO/IdP, network, vendor"
          />
        </div>

        <div>
          <label className="text-sm font-semibold text-slate-200">Standard fulfilment time (optional)</label>
          <input
            className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950/40 px-3 py-2 outline-none focus:border-brandPrimary"
            value={fulfillment}
            onChange={(e) => setFulfillment(e.target.value)}
            placeholder="e.g., 2 business days"
          />
        </div>

        <div>
          <label className="text-sm font-semibold text-slate-200">Out of scope (optional)</label>
          <input
            className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950/40 px-3 py-2 outline-none focus:border-brandPrimary"
            value={outOfScope}
            onChange={(e) => setOutOfScope(e.target.value)}
            placeholder="What is explicitly not included?"
          />
        </div>
      </div>
    </div>
  );

  const checklistForm = (
    <div className="rounded-2xl border border-slate-800 bg-slate-950/20 p-5">
      <div className="text-lg font-semibold">Checklist inputs</div>

      <div className="mt-4 grid grid-cols-1 gap-4">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div>
            <label className="text-sm font-semibold text-slate-200">Issue type *</label>
            <select
              className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950/40 px-3 py-2 outline-none focus:border-brandPrimary"
              value={issueType}
              onChange={(e) => setIssueType(e.target.value)}
            >
              {["Network", "Login", "App", "Printing", "Performance", "Email", "Other"].map((x) => (
                <option key={x}>{x}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-sm font-semibold text-slate-200">Platform *</label>
            <select
              className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950/40 px-3 py-2 outline-none focus:border-brandPrimary"
              value={platform}
              onChange={(e) => setPlatform(e.target.value)}
            >
              {["Windows", "macOS", "iOS", "Android", "Web", "Other"].map((x) => (
                <option key={x}>{x}</option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label className="text-sm font-semibold text-slate-200">Symptoms *</label>
          <textarea
            className="mt-2 min-h-[90px] w-full rounded-xl border border-slate-700 bg-slate-950/40 px-3 py-2 outline-none focus:border-brandPrimary"
            value={symptoms}
            onChange={(e) => setSymptoms(e.target.value)}
            placeholder="Describe symptoms briefly (e.g., 'VPN connects but no internal sites load')."
          />
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div>
            <div className="text-sm font-semibold text-slate-200">Tools available (optional)</div>
            <div className="mt-2 space-y-2">
              {Object.keys(tools).map((k) => (
                <label key={k} className="flex items-center gap-2 text-sm text-slate-200">
                  <input
                    type="checkbox"
                    checked={tools[k]}
                    onChange={(e) => setTools({ ...tools, [k]: e.target.checked })}
                  />
                  {k}
                </label>
              ))}
            </div>
          </div>
          <div>
            <div className="text-sm font-semibold text-slate-200">Risk level</div>
            <select
              className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950/40 px-3 py-2 outline-none focus:border-brandPrimary"
              value={riskLevel}
              onChange={(e) => setRiskLevel(e.target.value)}
            >
              {["Low", "Medium", "High"].map((x) => (
                <option key={x}>{x}</option>
              ))}
            </select>

            <div className="mt-4">
              <label className="text-sm font-semibold text-slate-200">Known context (optional)</label>
              <input
                className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950/40 px-3 py-2 outline-none focus:border-brandPrimary"
                value={knownContext}
                onChange={(e) => setKnownContext(e.target.value)}
                placeholder="VPN, proxy, SSO, recent changes..."
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  const unlockModal = showUnlock ? (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-md rounded-2xl border border-slate-700 bg-brandDark p-5 shadow-xl">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-lg font-semibold">Unlock Pro</div>
            <div className="mt-1 text-sm text-slate-300">
              Paste your license key to unlock unlimited generations and Pro fields.
            </div>
          </div>
          <button
            className="rounded-xl bg-slate-950/50 border border-slate-700 px-3 py-2 text-sm hover:bg-slate-950"
            onClick={() => setShowUnlock(false)}
          >
            Close
          </button>
        </div>

        <div className="mt-4">
          <input
            className="w-full rounded-xl border border-slate-700 bg-slate-950/40 px-3 py-2 outline-none focus:border-brandPrimary"
            placeholder="TR-XXXX-XXXX-XXXX"
            value={licenseKey}
            onChange={(e) => setLicenseKey(e.target.value)}
          />
          <button
            className="mt-3 w-full rounded-xl bg-brandPrimary px-4 py-2 text-sm font-semibold text-slate-950 hover:brightness-110"
            onClick={unlockPro}
          >
            Unlock
          </button>
          {unlockMsg ? (
            <div className="mt-3 text-sm text-slate-200">{unlockMsg}</div>
          ) : null}
        </div>
      </div>
    </div>
  ) : null;

  return (
    <div className="min-h-screen">
      {header}
      {unlockModal}

      <div className="mx-auto max-w-6xl px-4 py-6 space-y-6">
        {proBanner}

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {tab === "incident" ? incidentForm : null}
          {tab === "service" ? serviceForm : null}
          {tab === "checklist" ? checklistForm : null}

          {outputPanel}
        </div>
      </div>
    </div>
  );
}
