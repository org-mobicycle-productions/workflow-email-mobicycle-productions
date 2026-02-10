import { useState, useEffect, useCallback } from "react";

const API_BASE = ""; // Same origin when embedded in worker

const CATEGORY_COLORS = {
  Courts: { bg: "#1e3a5f", border: "#2d6ab8", text: "#7cb5ec", icon: "⚖️" },
  Complaints: { bg: "#4a1942", border: "#8b2d82", text: "#d17bcc", icon: "📋" },
  "Legal Expenses": { bg: "#1a3d2e", border: "#2d8b5e", text: "#7bccaa", icon: "💰" },
  Claimants: { bg: "#3d3a1a", border: "#8b822d", text: "#ccc47b", icon: "👤" },
  Defendants: { bg: "#3d1a1a", border: "#8b2d2d", text: "#cc7b7b", icon: "🏢" },
  Government: { bg: "#1a2d3d", border: "#2d5e8b", text: "#7baacc", icon: "🏛️" },
  Reconsideration: { bg: "#2d1a3d", border: "#5e2d8b", text: "#aa7bcc", icon: "🔄" },
  Data: { bg: "#1a1a1a", border: "#444", text: "#999", icon: "📦" },
};

function Panel({ title, subtitle, children, className = "" }) {
  return (
    <div className={`rounded-lg overflow-hidden ${className}`} style={{ background: "#12131a", border: "1px solid #2a2b35" }}>
      {title && (
        <div style={{ borderBottom: "1px solid #2a2b35", padding: "14px 18px 10px" }}>
          <h3 style={{ color: "#e0e0e5", fontSize: "14px", fontWeight: 600, letterSpacing: "0.02em", margin: 0 }}>{title}</h3>
          {subtitle && <p style={{ color: "#666", fontSize: "11px", marginTop: "2px" }}>{subtitle}</p>}
        </div>
      )}
      <div style={{ padding: "14px 18px" }}>{children}</div>
    </div>
  );
}

function MetricCard({ label, value, color = "#7cb5ec", icon, subtext }) {
  return (
    <div style={{ background: "#12131a", border: "1px solid #2a2b35", borderRadius: "8px", padding: "14px 16px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ color: "#666", fontSize: "11px", fontWeight: 500 }}>{label}</span>
        {icon && <span style={{ fontSize: "16px" }}>{icon}</span>}
      </div>
      <div style={{ fontSize: "28px", fontWeight: 700, color, marginTop: "4px", fontFamily: "monospace" }}>{value}</div>
      {subtext && <div style={{ color: "#555", fontSize: "10px", marginTop: "2px" }}>{subtext}</div>}
    </div>
  );
}

function StatusDot({ status }) {
  const colors = { ok: "#52c41a", fail: "#ff4d4f", skip: "#faad14", unknown: "#666" };
  return (
    <span style={{ display: "inline-block", width: "8px", height: "8px", borderRadius: "50%", background: colors[status] || colors.unknown, boxShadow: `0 0 6px ${colors[status] || colors.unknown}44`, flexShrink: 0 }} />
  );
}

function NamespaceBar({ name, count, category, maxCount }) {
  const width = maxCount > 0 ? Math.max((count / maxCount) * 100, 2) : 2;
  const colors = CATEGORY_COLORS[category] || CATEGORY_COLORS.Data;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "10px", padding: "4px 0" }}>
      <div style={{ width: "180px", fontSize: "11px", color: colors.text }}>{name}</div>
      <div style={{ flex: 1, height: "6px", background: "#1a1b25", borderRadius: "3px", overflow: "hidden" }}>
        <div style={{ width: `${width}%`, height: "100%", background: colors.border, borderRadius: "3px", transition: "width 0.4s ease" }} />
      </div>
      <div style={{ width: "40px", textAlign: "right", fontSize: "11px", color: "#888", fontFamily: "monospace" }}>{count}</div>
    </div>
  );
}

function timeAgo(iso) {
  if (!iso) return "never";
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

function CronCard({ title, schedule, accentColor, status, children }) {
  return (
    <div style={{ background: "#12131a", border: "1px solid #2a2b35", borderRadius: "10px", overflow: "hidden", position: "relative" }}>
      <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: "3px", background: accentColor }} />
      <div style={{ padding: "14px 18px 10px", display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid #1e1f2a" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <StatusDot status={status} />
          <span style={{ color: "#e0e0e5", fontSize: "14px", fontWeight: 600, letterSpacing: "0.02em" }}>{title}</span>
        </div>
        <span style={{ fontSize: "11px", color: "#444", background: "#0d0e14", padding: "2px 8px", borderRadius: "4px", fontFamily: "monospace" }}>{schedule}</span>
      </div>
      <div style={{ padding: "14px 18px" }}>{children}</div>
    </div>
  );
}

function StatRow({ label, value, valueColor }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", padding: "5px 0", borderBottom: "1px solid #1a1b22", fontSize: "12px" }}>
      <span style={{ color: "#777" }}>{label}</span>
      <span style={{ fontFamily: "monospace", color: valueColor || "#ccc" }}>{value}</span>
    </div>
  );
}

// ── PIPELINE TAB ──

function PipelineTab({ data, loading }) {
  const crons = data?.crons;
  const prereqs = crons?.prereqs;
  const connect = crons?.connect;
  const status = crons?.status;
  const kvTotals = data?.kvCounts;

  return (
    <div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "12px", marginBottom: "20px" }}>
        <MetricCard label="Raw Emails" value={loading ? "..." : kvTotals?.raw || "0"} color="#7cb5ec" icon="📥" subtext="RAW_DATA_HEADERS" />
        <MetricCard label="Filtered" value={loading ? "..." : kvTotals?.filtered || "0"} color="#52c41a" icon="🔍" subtext="FILTERED_DATA_HEADERS" />
        <MetricCard label="Categorized" value={loading ? "..." : kvTotals?.total || "0"} color="#faad14" icon="📂" subtext="Across 35 namespaces" />
        <MetricCard label="Last Fetch" value={loading ? "..." : connect?.part1?.fetched != null ? connect.part1.fetched : "—"} color="#d17bcc" icon="⏱️" subtext={connect?.timestamp ? timeAgo(connect.timestamp) : "No runs yet"} />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "16px", marginBottom: "20px" }}>
        {/* CRON 1: Prereqs */}
        <CronCard title="1. Prereqs" schedule="*/2 * * * *" accentColor="#7c6bf5" status={prereqs ? (prereqs.ok ? "ok" : "fail") : "unknown"}>
          {!prereqs ? (
            <div style={{ color: "#555", fontSize: "12px" }}>No data yet</div>
          ) : (
            <>
              <div style={{ fontSize: "20px", fontWeight: 700, color: prereqs.ok ? "#52c41a" : "#ff4d4f", marginBottom: "10px" }}>
                {prereqs.ok ? "ALL SYSTEMS GO" : "PREREQS FAILED"}
              </div>
              <StatRow label="Tunnel" value={prereqs.tunnel ? "✅ reachable" : "❌ down"} valueColor={prereqs.tunnel ? "#52c41a" : "#ff4d4f"} />
              <StatRow label="Backend" value={prereqs.backend ? "✅ running" : "❌ down"} valueColor={prereqs.backend ? "#52c41a" : "#ff4d4f"} />
              <StatRow label="Bridge" value={prereqs.bridge ? "✅ connected" : "❌ down"} valueColor={prereqs.bridge ? "#52c41a" : "#ff4d4f"} />
              {prereqs.error && <StatRow label="Error" value={prereqs.error} valueColor="#ff4d4f" />}
              <div style={{ fontSize: "10px", color: "#444", marginTop: "8px", fontFamily: "monospace" }}>Checked: {timeAgo(prereqs.checkedAt)}</div>
            </>
          )}
        </CronCard>

        {/* CRON 2: Connect */}
        <CronCard title="2. Connect" schedule="*/5 * * * *" accentColor="#2dd4bf" status={!connect ? "unknown" : connect.status === "skipped" ? "skip" : connect.error ? "fail" : "ok"}>
          {!connect ? (
            <div style={{ color: "#555", fontSize: "12px" }}>No data yet</div>
          ) : connect.status === "skipped" ? (
            <>
              <div style={{ fontSize: "20px", fontWeight: 700, color: "#faad14", marginBottom: "8px" }}>SKIPPED</div>
              <StatRow label="Reason" value="Prereqs not met" valueColor="#faad14" />
              <div style={{ fontSize: "10px", color: "#444", marginTop: "8px", fontFamily: "monospace" }}>{timeAgo(connect.timestamp)}</div>
            </>
          ) : connect.error ? (
            <>
              <div style={{ fontSize: "20px", fontWeight: 700, color: "#ff4d4f", marginBottom: "8px" }}>ERROR</div>
              <StatRow label="Error" value={connect.error} valueColor="#ff4d4f" />
              <div style={{ fontSize: "10px", color: "#444", marginTop: "8px", fontFamily: "monospace" }}>{timeAgo(connect.timestamp)}</div>
            </>
          ) : (
            <>
              <div style={{ fontSize: "20px", fontWeight: 700, color: "#52c41a", marginBottom: "10px" }}>PIPELINE OK</div>
              <StatRow label="Fetched" value={`${connect.part1?.fetched || 0} emails`} />
              <StatRow label="Inbound" value={`${connect.part1?.inbound || 0} (−${connect.part1?.roseFiltered || 0} sent)`} />
              <StatRow label="Classified" value={`${connect.part2?.filteredStored || 0} matched`} />
              <StatRow label="Raw stored" value={String(connect.part2?.rawStored || 0)} />
              {connect.part2?.routeStats && Object.keys(connect.part2.routeStats).length > 0 && (
                <div style={{ marginTop: "8px", display: "flex", flexWrap: "wrap", gap: "3px" }}>
                  {Object.entries(connect.part2.routeStats).map(([ns, count]) => (
                    <span key={ns} style={{ fontSize: "10px", fontFamily: "monospace", padding: "1px 5px", borderRadius: "3px", background: "#1a1b25", color: "#888" }}>
                      {ns.replace("EMAIL_", "").replace(/_/g, " ").toLowerCase()}: {String(count)}
                    </span>
                  ))}
                </div>
              )}
              {connect.part3 && (
                <>
                  <div style={{ marginTop: "10px" }}>
                    <StatRow label="Triaged" value={`${connect.part3.total || 0} total`} />
                    <div style={{ display: "flex", gap: "8px", fontSize: "11px", marginTop: "4px" }}>
                      <span style={{ color: "#888" }}>⬛ {connect.part3.noted || 0} noted</span>
                      <span style={{ color: "#2dd4bf" }}>🟩 {connect.part3.simple || 0} simple</span>
                      <span style={{ color: "#ff4d4f" }}>🟥 {connect.part3.complex || 0} complex</span>
                    </div>
                  </div>
                  {connect.part3.total > 0 && (
                    <div style={{ display: "flex", height: "5px", borderRadius: "3px", overflow: "hidden", marginTop: "6px", gap: "2px" }}>
                      <div style={{ flex: connect.part3.noted || 0, background: "#555" }} />
                      <div style={{ flex: connect.part3.simple || 0, background: "#2dd4bf" }} />
                      <div style={{ flex: connect.part3.complex || 0, background: "#ff4d4f" }} />
                    </div>
                  )}
                </>
              )}
              <div style={{ fontSize: "10px", color: "#444", marginTop: "8px", fontFamily: "monospace" }}>Last run: {timeAgo(connect.timestamp)}</div>
            </>
          )}
        </CronCard>

        {/* CRON 3: Status */}
        <CronCard title="3. Status" schedule="0 * * * *" accentColor="#f59e0b" status={status ? "ok" : "unknown"}>
          {!status ? (
            <div style={{ color: "#555", fontSize: "12px" }}>No data yet</div>
          ) : (
            <>
              <div style={{ fontSize: "20px", fontWeight: 700, color: "#f59e0b", marginBottom: "10px" }}>SNAPSHOT</div>
              {status.prereqs && (
                <StatRow label="Prereqs" value={status.prereqs.ok ? "✅ All OK" : `❌ ${status.prereqs.error || "Failed"}`} valueColor={status.prereqs.ok ? "#52c41a" : "#ff4d4f"} />
              )}
              {status.lastPipelineRun ? (
                <>
                  {status.lastPipelineRun.status === "skipped" ? (
                    <StatRow label="Pipeline" value="⏭ Skipped" valueColor="#faad14" />
                  ) : status.lastPipelineRun.error ? (
                    <StatRow label="Pipeline" value={`❌ ${status.lastPipelineRun.error}`} valueColor="#ff4d4f" />
                  ) : (
                    <StatRow label="Pipeline" value={`✅ OK (${status.lastPipelineRun.part1?.fetched || 0} fetched)`} valueColor="#52c41a" />
                  )}
                  <StatRow label="Last pipeline" value={timeAgo(status.lastPipelineRun.timestamp)} />
                </>
              ) : (
                <StatRow label="Pipeline" value="Never run" />
              )}
              <div style={{ fontSize: "10px", color: "#444", marginTop: "8px", fontFamily: "monospace" }}>Snapshot: {timeAgo(status.checkedAt)}</div>
            </>
          )}
        </CronCard>
      </div>

      <Panel title="Accounts" subtitle="ProtonMail accounts connected via Bridge">
        <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: "8px" }}>
          {["rose@mobicycle.ee", "rose@mobicycle.productions", "rose@mobicycle.consulting", "rose@mobicycle.us", "rose@mobicycle.eu"].map((email) => (
            <div key={email} style={{ padding: "10px", background: "#0d0e14", borderRadius: "6px", border: "1px solid #1e1f2a", fontSize: "12px", color: email === "rose@mobicycle.ee" ? "#7cb5ec" : "#555", fontWeight: email === "rose@mobicycle.ee" ? 600 : 400 }}>
              {email}
              {email === "rose@mobicycle.ee" && <span style={{ marginLeft: "6px", fontSize: "10px", color: "#52c41a" }}>ACTIVE</span>}
            </div>
          ))}
        </div>
      </Panel>
    </div>
  );
}

// ── NAMESPACE STRUCTURE TAB ──

function NamespaceTab({ data, loading }) {
  const namespaces = data?.kvCounts?.namespaces || [];
  const maxCount = Math.max(...namespaces.map((n) => n.count), 1);
  const grouped = {};
  namespaces.forEach((ns) => { const cat = ns.category || "Data"; if (!grouped[cat]) grouped[cat] = []; grouped[cat].push(ns); });

  return (
    <div>
      {loading ? (
        <div style={{ color: "#555", fontSize: "13px" }}>Loading...</div>
      ) : namespaces.length === 0 ? (
        <Panel title="No namespace data"><div style={{ color: "#555", fontSize: "13px" }}>No KV namespace data available.</div></Panel>
      ) : (
        Object.entries(grouped).sort(([, a], [, b]) => b.reduce((s, n) => s + n.count, 0) - a.reduce((s, n) => s + n.count, 0)).map(([category, items]) => {
          const catTotal = items.reduce((s, n) => s + n.count, 0);
          const colors = CATEGORY_COLORS[category] || CATEGORY_COLORS.Data;
          return (
            <Panel key={category} title={`${colors.icon} ${category}`} subtitle={`${items.length} namespaces · ${catTotal} total emails`} className="mb-4">
              {items.sort((a, b) => b.count - a.count).map((ns) => (
                <NamespaceBar key={ns.name} name={ns.name} count={ns.count} category={category} maxCount={maxCount} />
              ))}
            </Panel>
          );
        })
      )}
    </div>
  );
}

// ── TRIAGE TAB ──

const nsSlugMap = {
  "Supreme Court": "courts-supreme-court", "Court of Appeals Civil Division": "courts-court-of-appeals-civil-division",
  "King's Bench Appeals Division": "courts-kings-bench-appeals-division", "Chancery Division": "courts-chancery-division",
  "Administrative Court": "courts-administrative-court", "Central London County Court": "courts-central-london-county-court",
  "Clerkenwell County Court": "courts-clerkenwell-county-court", ICO: "complaints-ico", PHSO: "complaints-phso",
  Parliament: "complaints-parliament", HMCTS: "complaints-hmcts", "Bar Standards Board": "complaints-bar-standards-board",
  "Legal Fees - Claimant": "expenses-legal-fees-claimant", "Legal Fees - Company": "expenses-legal-fees-company",
  "Legal Fees - Director": "expenses-legal-fees-director", Repairs: "expenses-repairs",
  "HK Law": "claimant-hk-law", Lessel: "claimant-lessel", Liu: "claimant-liu", Rentify: "claimant-rentify",
  Defendant: "defendants-defendant", "Both Defendants": "defendants-both-defendants", Barristers: "defendants-barristers",
  "Litigant in Person Only": "defendants-litigant-in-person-only", "MobiCycle OÜ Only": "defendants-mobicycle-ou-only",
  "UK Legal Department": "government-uk-legal-department", Estonia: "government-estonia", "US State Department": "government-us-state-department",
  "Single Judge": "reconsideration-single-judge", "Court Officer Review": "reconsideration-court-officer-review",
  "PTA Refusal": "reconsideration-pta-refusal", "CPR 52.24(5)": "reconsideration-cpr52-24-5",
  "CPR 52.24(6)": "reconsideration-cpr52-24-6", "CPR 52.30": "reconsideration-cpr52-30", PD52B: "reconsideration-pd52b",
};

function TriageTab({ data, loading }) {
  const [selectedNs, setSelectedNs] = useState(null);
  const [emails, setEmails] = useState([]);
  const [loadingEmails, setLoadingEmails] = useState(false);
  const namespaces = data?.kvCounts?.namespaces || [];
  const withEmails = namespaces.filter((n) => n.count > 0);

  const loadEmails = useCallback(async (nsSlug) => {
    setLoadingEmails(true);
    try {
      const res = await fetch(`${API_BASE}/api/kv-emails/${nsSlug}?limit=20`);
      if (res.ok) { const json = await res.json(); setEmails(json.emails || []); }
    } catch (e) { console.error("Failed to load emails:", e); }
    setLoadingEmails(false);
  }, []);

  return (
    <div>
      <div style={{ display: "grid", gridTemplateColumns: "300px 1fr", gap: "16px" }}>
        <Panel title="Namespaces with Emails" subtitle="Click to inspect">
          <div style={{ maxHeight: "500px", overflowY: "auto" }}>
            {withEmails.length === 0 ? (
              <div style={{ color: "#555", fontSize: "12px" }}>No emails in any namespace yet.</div>
            ) : (
              withEmails.sort((a, b) => b.count - a.count).map((ns) => {
                const slug = nsSlugMap[ns.name] || ns.name.toLowerCase().replace(/ /g, "-");
                const isSelected = selectedNs === slug;
                const colors = CATEGORY_COLORS[ns.category] || CATEGORY_COLORS.Data;
                return (
                  <div key={ns.name} onClick={() => { setSelectedNs(slug); loadEmails(slug); }}
                    style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 10px", borderRadius: "5px", cursor: "pointer", background: isSelected ? "#1a1b25" : "transparent", borderLeft: isSelected ? `3px solid ${colors.border}` : "3px solid transparent", marginBottom: "2px", transition: "all 0.15s" }}>
                    <div>
                      <div style={{ fontSize: "12px", color: isSelected ? colors.text : "#aaa", fontWeight: isSelected ? 600 : 400 }}>{ns.name}</div>
                      <div style={{ fontSize: "10px", color: "#555" }}>{ns.category}</div>
                    </div>
                    <span style={{ fontFamily: "monospace", fontSize: "12px", color: "#888" }}>{ns.count}</span>
                  </div>
                );
              })
            )}
          </div>
        </Panel>
        <Panel title={selectedNs ? `Emails: ${selectedNs}` : "Select a namespace"} subtitle={selectedNs ? "Showing up to 20 emails" : "Click a namespace to view"}>
          {!selectedNs ? (
            <div style={{ color: "#555", fontSize: "13px", padding: "40px 0", textAlign: "center" }}>← Select a namespace to inspect emails</div>
          ) : loadingEmails ? (
            <div style={{ color: "#555", fontSize: "13px" }}>Loading...</div>
          ) : emails.length === 0 ? (
            <div style={{ color: "#555", fontSize: "13px" }}>No emails found.</div>
          ) : (
            <div style={{ maxHeight: "500px", overflowY: "auto" }}>
              {emails.map((email, i) => (
                <div key={email.key || i} style={{ padding: "10px 12px", borderBottom: "1px solid #1e1f2a", fontSize: "12px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span style={{ color: "#d0d0d5", fontWeight: 500 }}>{email.data?.subject || email.key}</span>
                    <span style={{ color: "#555", fontFamily: "monospace" }}>{email.data?.date ? new Date(email.data.date).toLocaleDateString() : ""}</span>
                  </div>
                  <div style={{ color: "#777", marginTop: "2px" }}>From: {email.data?.from || "unknown"}</div>
                  {email.data?.triageLevel && (
                    <span style={{ display: "inline-block", marginTop: "4px", fontSize: "10px", padding: "1px 6px", borderRadius: "3px",
                      background: email.data.triageLevel === "COMPLEX" ? "#3d1a1a" : email.data.triageLevel === "SIMPLE" ? "#1a3d2e" : "#1a1a1a",
                      color: email.data.triageLevel === "COMPLEX" ? "#ff4d4f" : email.data.triageLevel === "SIMPLE" ? "#52c41a" : "#888" }}>
                      {email.data.triageLevel}
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}
        </Panel>
      </div>
    </div>
  );
}

// ── MAIN DASHBOARD ──

export default function Dashboard() {
  const [tab, setTab] = useState("pipeline");
  const [data, setData] = useState({});
  const [loading, setLoading] = useState(true);
  const [lastRefresh, setLastRefresh] = useState(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [kvRes, cronRes] = await Promise.allSettled([
        fetch(`${API_BASE}/api/kv-counts`).then((r) => r.ok ? r.json() : null),
        fetch(`${API_BASE}/crons`).then((r) => r.ok ? r.json() : null),
      ]);
      const kvData = kvRes.status === "fulfilled" ? kvRes.value : null;
      let raw = 0, filtered = 0;
      setData({
        kvCounts: kvData ? { ...kvData, raw, filtered } : { namespaces: [], total: 0, raw: 0, filtered: 0 },
        crons: cronRes.status === "fulfilled" ? cronRes.value : null,
      });
      setLastRefresh(new Date());
    } catch (e) { console.error("Fetch failed:", e); }
    setLoading(false);
  }, []);

  const triggerPipeline = useCallback(async () => {
    try { await fetch(`${API_BASE}/run`, { method: "POST" }); setTimeout(fetchData, 2000); } catch (e) { console.error("Pipeline trigger failed:", e); }
  }, [fetchData]);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, [fetchData]);

  const tabs = [
    { id: "pipeline", label: "Pipeline", icon: "⚡" },
    { id: "namespaces", label: "Namespace Structure", icon: "🗄️" },
    { id: "triage", label: "Triage & Action", icon: "📋" },
  ];

  return (
    <div style={{ minHeight: "100vh", background: "#090a10", color: "#d0d0d5", fontFamily: "'SF Pro Text', -apple-system, 'Segoe UI', Roboto, sans-serif" }}>
      <div style={{ background: "#0d0e14", borderBottom: "1px solid #1e1f2a", padding: "14px 24px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
          <span style={{ fontSize: "24px" }}>📧</span>
          <div>
            <h1 style={{ margin: 0, fontSize: "18px", fontWeight: 700, color: "#e8e8ed", letterSpacing: "-0.01em" }}>MobiCycle OÜ · Email Workflow</h1>
            <p style={{ margin: 0, fontSize: "11px", color: "#555" }}>rose@mobicycle.ee · ProtonMail Bridge → Worker → KV · 3 CRON jobs</p>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          {lastRefresh && <span style={{ color: "#444", fontSize: "11px" }}>{lastRefresh.toLocaleTimeString()}</span>}
          <button onClick={fetchData} style={{ background: "#1a2a4a", color: "#7cb5ec", border: "1px solid #2d4a7a", borderRadius: "6px", padding: "6px 14px", fontSize: "12px", cursor: "pointer", fontWeight: 500 }}>↻ Refresh</button>
          <button onClick={triggerPipeline} style={{ background: "#1a3d2e", color: "#52c41a", border: "1px solid #2d8b5e", borderRadius: "6px", padding: "6px 14px", fontSize: "12px", cursor: "pointer", fontWeight: 500 }}>▶ Run Pipeline</button>
        </div>
      </div>
      <div style={{ background: "#0d0e14", borderBottom: "1px solid #1e1f2a", padding: "0 24px", display: "flex", gap: "4px" }}>
        {tabs.map((t) => (
          <button key={t.id} onClick={() => setTab(t.id)} style={{ padding: "10px 18px", fontSize: "13px", fontWeight: 500, color: tab === t.id ? "#7cb5ec" : "#666", background: "transparent", border: "none", borderBottom: tab === t.id ? "2px solid #7cb5ec" : "2px solid transparent", cursor: "pointer", transition: "all 0.15s" }}>
            {t.icon} {t.label}
          </button>
        ))}
      </div>
      <div style={{ padding: "20px 24px" }}>
        {tab === "pipeline" && <PipelineTab data={data} loading={loading} />}
        {tab === "namespaces" && <NamespaceTab data={data} loading={loading} />}
        {tab === "triage" && <TriageTab data={data} loading={loading} />}
      </div>
    </div>
  );
}