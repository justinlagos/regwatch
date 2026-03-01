import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { getServiceClient, json } from "../_shared/supabase.ts";

// Keyword → ISO 27001:2022 clause mapping
const ISO_MAP = [
  { code: "A.8.8",  name: "Technical vulnerability management",   kw: ["vulnerabilit", "cve-", "cvss", "patch", "exploit", "zero-day", "nvd", "advisory"] },
  { code: "A.5.7",  name: "Threat intelligence",                   kw: ["threat intel", "apt ", "nation-state", "threat actor", "campaign", "ttp", "ioc"] },
  { code: "A.8.7",  name: "Malware protection",                    kw: ["malware", "ransomware", "trojan", "virus", "worm", "spyware", "botnet", "backdoor"] },
  { code: "A.5.24", name: "Incident management planning",          kw: ["incident", "breach", "data leak", "compromise", "intrusion", "exfiltrat"] },
  { code: "A.8.20", name: "Network security",                      kw: ["network", "firewall", "vpn", "ddos", "dos attack", "traffic", "routing"] },
  { code: "A.8.16", name: "Monitoring activities",                 kw: ["monitor", "siem", "detection", "alert", "log", "anomaly", "telemetry"] },
  { code: "A.5.23", name: "Cloud services security",               kw: ["cloud", "aws", "azure", "gcp", "s3 bucket", "container", "kubernetes", "serverless"] },
  { code: "A.5.36", name: "Compliance with policies",              kw: ["gdpr", "ccpa", "hipaa", "pci dss", "regulation", "compliance", "enforcement", "fine", "penalty"] },
  { code: "A.8.25", name: "Secure development life cycle",         kw: ["sdlc", "secure development", "devsecops", "code review", "sast", "dast"] },
  { code: "A.8.28", name: "Secure coding",                         kw: ["sql injection", "xss", "cross-site", "buffer overflow", "code injection", "rce"] },
  { code: "A.6.8",  name: "Information security event reporting",  kw: ["reporting", "disclosure", "notification", "report", "cisa alert", "advisory"] },
  { code: "A.5.29", name: "Information security during disruption",kw: ["disruption", "outage", "availability", "business continuity", "resilience"] },
];

// Keyword → NIST CSF 2.0 control mapping
const NIST_MAP = [
  { code: "ID.RA-05", name: "Threats and vulnerabilities",       kw: ["vulnerabilit", "cve-", "exploit", "risk", "threat"] },
  { code: "DE.CM-01", name: "Continuous monitoring",             kw: ["monitor", "detect", "alert", "siem", "log", "anomaly"] },
  { code: "DE.AE-02", name: "Adverse event analysis",            kw: ["incident", "breach", "compromise", "attack", "intrusion"] },
  { code: "PR.PS-01", name: "Platform security",                  kw: ["patch", "update", "firmware", "configuration", "hardening"] },
  { code: "PR.DS-01", name: "Data protection",                   kw: ["data", "encryption", "pii", "sensitive", "gdpr", "privacy"] },
  { code: "RS.MA-01", name: "Incident management",               kw: ["incident response", "containment", "eradication", "recovery"] },
  { code: "RS.CO-02", name: "Incident reporting",                kw: ["reporting", "disclosure", "notification", "cisa", "cert"] },
  { code: "PR.AA-01", name: "Identity management",               kw: ["identity", "authentication", "mfa", "credential", "access control", "privileged"] },
  { code: "GV.RM-01", name: "Risk management strategy",         kw: ["risk", "compliance", "policy", "governance", "regulation"] },
  { code: "RC.RP-01", name: "Recovery plan execution",           kw: ["recovery", "backup", "restore", "continuity", "resilience"] },
];

function matchClauses<T extends { code: string; name: string; kw: string[] }>(
  text: string, map: T[]
): Array<{ code: string; name: string }> {
  const lower = text.toLowerCase();
  const matched = map.filter(entry => entry.kw.some(kw => lower.includes(kw)));
  // Return at most 4
  return matched.slice(0, 4).map(({ code, name }) => ({ code, name }));
}

Deno.serve(async (_req: Request) => {
  const supabase = getServiceClient();

  // Fetch all classifications where iso_clauses is still empty
  const { data: rows, error } = await supabase
    .from("classifications")
    .select("id, item_id, iso_clauses, summary, impact_rationale, recommended_action")
    .eq("iso_clauses", "[]");

  if (error) return json({ error: error.message }, 500);
  if (!rows?.length) return json({ message: "Nothing to backfill", count: 0 });

  // Also fetch item titles for better matching
  const itemIds = rows.map(r => r.item_id);
  const { data: items } = await supabase
    .from("items")
    .select("id, title")
    .in("id", itemIds);

  const itemTitleMap = new Map((items || []).map(i => [i.id, i.title || ""]));

  let updated = 0;
  const BATCH = 50;

  for (let i = 0; i < rows.length; i += BATCH) {
    const batch = rows.slice(i, i + BATCH);
    await Promise.all(batch.map(async (row) => {
      const title   = itemTitleMap.get(row.item_id) || "";
      const text    = [title, row.summary || "", row.impact_rationale || "", row.recommended_action || ""].join(" ");
      const isoClauses   = matchClauses(text, ISO_MAP);
      const nistControls = matchClauses(text, NIST_MAP);

      // Default to general compliance clause if nothing matched
      const finalIso   = isoClauses.length   ? isoClauses   : [{ code: "A.5.36", name: "Compliance with policies" }];
      const finalNist  = nistControls.length  ? nistControls : [{ code: "GV.RM-01", name: "Risk management strategy" }];

      await supabase
        .from("classifications")
        .update({ iso_clauses: finalIso, nist_controls: finalNist })
        .eq("id", row.id);

      updated++;
    }));
  }

  return json({ success: true, updated });
});
