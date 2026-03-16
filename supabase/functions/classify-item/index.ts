import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { getServiceClient, json, logEvent } from "../_shared/supabase.ts";

const ANTHROPIC_API_URL = "https://api.anthropic.com/v1/messages";
const MODEL = "claude-sonnet-4-20250514";

interface ClauseRef { code: string; name: string }

interface ClassificationResult {
  is_relevant: boolean;
  relevance_reason: string;
  impact_level: "1" | "2" | "3" | "4";
  impact_rationale: string;
  confidence_score: number;
  iso_domains: string[];
  iso_tags: string[];
  nist_csf_functions: string[];
  nist_800_53_families: string[];
  iso_clauses: ClauseRef[];
  nist_controls: ClauseRef[];
  summary: string;
  key_points: string[];
  recommended_action: string;
}

// ─── Source-Type Weighting ──────────────────────────────────────────
// Calibrate impact levels based on source authority
interface SourceWeight {
  min_level: number;  // Minimum impact level for this source type
  max_level: number;  // Maximum impact level for this source type
  boost: number;      // Score adjustment (-20 to +20)
}

function getSourceWeight(sourceName: string, sourceType: string, jurisdiction: string | null): SourceWeight {
  const name = (sourceName || "").toLowerCase();
  const type = (sourceType || "").toLowerCase();

  // Tier 1: Government regulatory bodies — enforcement actions get L3 minimum
  if (/\b(fca|sec|cftc|occ|fdic|fed|bis|eba|esma|ecb|cbn|apra|mas|fsa|pra|bafin|amf|consob)\b/.test(name)) {
    return { min_level: 2, max_level: 4, boost: 10 };
  }

  // Tier 1: National cyber agencies
  if (/\b(cisa|ncsc|bsi|anssi|cert|enisa|acs[c]?)\b/.test(name)) {
    return { min_level: 2, max_level: 4, boost: 5 };
  }

  // Tier 2: Standards bodies & frameworks
  if (/\b(nist|iso|iec|ieee|cis|owasp|mitre)\b/.test(name)) {
    return { min_level: 1, max_level: 3, boost: 0 };
  }

  // Tier 3: Vendor security research
  if (/\b(palo alto|unit\s*42|mandiant|crowdstrike|sentinel|sophos|kaspersky|trellix|recorded future)\b/.test(name)) {
    return { min_level: 1, max_level: 3, boost: -5 };
  }

  // Tier 4: News aggregators & general
  if (type === "news" || /\b(bleeping|krebs|dark reading|hackernews|therecord|securityweek)\b/.test(name)) {
    return { min_level: 1, max_level: 3, boost: -10 };
  }

  // Default
  return { min_level: 1, max_level: 4, boost: 0 };
}

function applySourceWeight(result: ClassificationResult, weight: SourceWeight): ClassificationResult {
  let level = parseInt(result.impact_level);

  // Clamp to source weight bounds
  level = Math.max(weight.min_level, Math.min(weight.max_level, level));

  // Apply confidence adjustment
  let confidence = result.confidence_score + weight.boost;
  confidence = Math.max(10, Math.min(99, confidence));

  return {
    ...result,
    impact_level: String(level) as "1" | "2" | "3" | "4",
    confidence_score: confidence,
  };
}

// ─── Classification with Claude Sonnet ──────────────────────────────
async function classifyWithClaude(
  content: string,
  isoDomains: Array<{ code: string; label: string }>,
  isoTags: Array<{ code: string; label: string }>,
  nistCsfFunctions: Array<{ code: string; label: string }>,
  nist80053Families: Array<{ code: string; label: string }>
): Promise<ClassificationResult> {
  const apiKey = Deno.env.get("ANTHROPIC_API_KEY")!;

  const systemPrompt = `You are a senior regulatory intelligence analyst working for a compliance team at a financial services organization. Your job is to classify incoming signals (regulatory updates, security advisories, policy changes, threat intelligence) with precision.

CRITICAL: You must be CONSERVATIVE with impact levels. Most items are L1 or L2. Only genuine regulatory changes affecting compliance obligations warrant L3+. Active exploitation of critical infrastructure vulnerabilities warrant L4.

## STEP 1: RELEVANCE GATE
First determine if this content is actually relevant to regulatory compliance, cybersecurity governance, or risk management. Non-relevant content (marketing, general tech news, product announcements, job postings, blog opinions without regulatory substance) should be marked is_relevant: false.

## STEP 2: IMPACT CLASSIFICATION

Impact levels — apply these STRICTLY:

**L1 — Informational (most common, ~40% of items)**
- General industry news, vendor blog posts, conference summaries
- CVE disclosures for non-critical systems with no known exploitation
- Informational regulatory guidance with no binding requirements
- Research papers, threat landscape overviews
- Product/service announcements from vendors

**L2 — Monitor (~30% of items)**
- Proposed regulations or consultations (not yet enacted)
- Medium-severity vulnerabilities in common software
- Updated guidance from standards bodies (NIST, ISO)
- Regulatory enforcement against OTHER organizations (lessons learned)
- New threat actor reports without direct organizational impact

**L3 — Policy Review Required (~20% of items)**
- Final enacted regulations with compliance deadlines
- Critical vulnerabilities in software your org likely uses (e.g., major OS, cloud providers, networking gear)
- Regulatory enforcement patterns showing increased scrutiny in your sector
- New mandatory reporting requirements
- Significant changes to compliance frameworks (DORA, NIS2, SOX updates)

**L4 — Immediate Action (~10% of items)**
- Active exploitation of zero-day vulnerabilities in critical infrastructure
- Emergency regulatory directives with immediate compliance deadlines
- Data breach notification requirements triggered by specific events
- Sanctions or enforcement actions directly affecting your organization
- Critical infrastructure attacks requiring immediate defensive action

## FEW-SHOT EXAMPLES

Example 1 (L1):
Content: "Unit 42 researchers discovered a new malware family called GhostWriter targeting SMB file shares in Eastern Europe..."
Classification: L1 — Informational threat intelligence about a regionally-targeted malware. No direct compliance impact. Monitor for evolution.

Example 2 (L2):
Content: "NIST has released a draft update to SP 800-53 Rev 6, seeking public comments on proposed changes to access control families..."
Classification: L2 — Draft standards update. No immediate compliance change but should be tracked for when finalized.

Example 3 (L3):
Content: "The FCA has published final rules PS24/7 requiring all regulated firms to implement operational resilience testing by March 2025..."
Classification: L3 — Enacted regulatory requirement with specific compliance deadline. Policy review and gap analysis needed.

Example 4 (L4):
Content: "CISA has issued Emergency Directive 24-02 requiring all federal agencies to patch CVE-2024-3400 in Palo Alto Networks PAN-OS within 48 hours due to active exploitation..."
Classification: L4 — Emergency directive with immediate deadline, actively exploited critical vulnerability in widely-deployed network infrastructure.

Example 5 (L1):
Content: "Top 10 Cybersecurity Trends to Watch in 2025 — From AI-powered threats to quantum computing risks..."
Classification: L1 — General thought leadership with no specific regulatory or compliance implications.

## FRAMEWORK MAPPING

Available ISO 27001:2022 domains: ${isoDomains.map(d => `${d.code} (${d.label})`).join(", ")}
Available ISO tags: ${isoTags.map(t => `${t.code} (${t.label})`).join(", ")}
Available NIST CSF functions: ${nistCsfFunctions.map(f => `${f.code} (${f.label})`).join(", ")}
Available NIST 800-53 families: ${nist80053Families.map(f => `${f.code} (${f.label})`).join(", ")}

ISO 27001:2022 clauses (pick 1-4 most relevant):
A.5.7 Threat intelligence | A.5.23 Cloud services security | A.5.24 Incident management planning
A.5.29 Security during disruption | A.5.36 Compliance with policies | A.6.8 Security event reporting
A.8.7 Malware protection | A.8.8 Technical vulnerability management | A.8.16 Monitoring activities
A.8.20 Network security | A.8.23 Web filtering | A.8.25 Secure development life cycle
A.8.28 Secure coding | A.8.34 Protection of information systems during audit

NIST CSF 2.0 controls (pick 1-4 most relevant):
GV.OC-01 Organizational context | GV.RM-01 Risk management strategy
ID.AM-01 Asset management | ID.RA-01 Risk assessment | ID.RA-05 Threats and vulnerabilities
PR.AA-01 Identity management | PR.DS-01 Data protection | PR.PS-01 Platform security
DE.CM-01 Continuous monitoring | DE.AE-02 Adverse event analysis
RS.MA-01 Incident management | RS.CO-02 Incident reporting
RC.RP-01 Recovery plan execution

## OUTPUT FORMAT
Return ONLY valid JSON with this exact structure:
{
  "is_relevant": true/false,
  "relevance_reason": "Why this is or isn't relevant to regulatory compliance",
  "impact_level": "1"|"2"|"3"|"4",
  "impact_rationale": "2-3 sentences explaining why this level was chosen, referencing the criteria above",
  "confidence_score": 1-99,
  "iso_domains": ["code1"],
  "iso_tags": ["code1"],
  "nist_csf_functions": ["code1"],
  "nist_800_53_families": ["code1"],
  "iso_clauses": [{"code": "A.8.8", "name": "Technical vulnerability management"}],
  "nist_controls": [{"code": "ID.RA-05", "name": "Threats and vulnerabilities"}],
  "summary": "2-3 sentence summary focused on compliance implications",
  "key_points": ["point 1", "point 2", "point 3"],
  "recommended_action": "specific, actionable recommendation for the compliance team"
}`;

  const resp = await fetch(ANTHROPIC_API_URL, {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 1500,
      temperature: 0.1,
      messages: [
        {
          role: "user",
          content: `Classify this regulatory/security signal:\n\n${content.slice(0, 12000)}`,
        },
      ],
      system: systemPrompt,
    }),
  });

  if (!resp.ok) {
    const err = await resp.text();
    throw new Error(`Anthropic API error ${resp.status}: ${err}`);
  }

  const data = await resp.json();
  const raw = data.content[0].text;

  // Extract JSON from response (handle markdown code blocks)
  const jsonMatch = raw.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error("No JSON found in model response");
  }

  const result = JSON.parse(jsonMatch[0]) as ClassificationResult;

  // Ensure defaults
  result.is_relevant = result.is_relevant ?? true;
  result.relevance_reason = result.relevance_reason || "";
  result.confidence_score = result.confidence_score || 50;
  result.iso_clauses = result.iso_clauses || [];
  result.nist_controls = result.nist_controls || [];
  result.key_points = result.key_points || [];

  return result;
}

// ─── Main Handler ──────────────────────────────────────────────────
Deno.serve(async (req: Request) => {
  const body = await req.json().catch(() => ({}));
  const { item_id } = body;

  if (!item_id) {
    return json({ error: "item_id is required" }, 400);
  }

  const supabase = getServiceClient();
  const baseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  // Fetch item with source info
  const { data: item, error: itemErr } = await supabase
    .from("items")
    .select("*, sources(name, source_type, jurisdiction)")
    .eq("id", item_id)
    .single();

  if (itemErr || !item) {
    return json({ error: "Item not found" }, 404);
  }

  // Fetch reference data
  const [{ data: isoDomains }, { data: isoTags }, { data: nistCsf }, { data: nist80053 }] =
    await Promise.all([
      supabase.from("iso_domains").select("code, label").order("sort_order"),
      supabase.from("iso_tags").select("code, label").order("sort_order"),
      supabase.from("nist_csf_functions").select("code, label").order("sort_order"),
      supabase.from("nist_800_53_families").select("code, label").order("sort_order"),
    ]);

  // Build content to classify — expanded context window (12K)
  const contentParts = [
    item.title ? `Title: ${item.title}` : "",
    item.sources?.name ? `Source: ${item.sources.name}` : "",
    item.sources?.source_type ? `Source Type: ${item.sources.source_type}` : "",
    item.sources?.jurisdiction ? `Jurisdiction: ${item.sources.jurisdiction}` : "",
    item.canonical_url ? `URL: ${item.canonical_url}` : "",
    item.content_quality_score ? `Content Quality Score: ${item.content_quality_score}/100` : "",
    item.extracted_text ? `\nContent:\n${item.extracted_text}` : "",
  ]
    .filter(Boolean)
    .join("\n");

  let classification: ClassificationResult | null = null;
  let rawResponse: string | null = null;

  try {
    classification = await classifyWithClaude(
      contentParts,
      isoDomains || [],
      isoTags || [],
      nistCsf || [],
      nist80053 || []
    );

    // Apply source-type weighting
    const sourceWeight = getSourceWeight(
      item.sources?.name || "",
      item.sources?.source_type || "",
      item.sources?.jurisdiction || null
    );
    classification = applySourceWeight(classification, sourceWeight);

    // If not relevant, force to L1
    if (!classification.is_relevant) {
      classification.impact_level = "1";
      classification.impact_rationale = `Not relevant to regulatory compliance: ${classification.relevance_reason}. ${classification.impact_rationale}`;
    }

    rawResponse = JSON.stringify(classification);

    // Save classification
    const { data: saved } = await supabase
      .from("classifications")
      .insert({
        workspace_id: item.workspace_id,
        item_id,
        source: "ai",
        impact_level: classification.impact_level,
        impact_rationale: classification.impact_rationale,
        iso_domains: classification.iso_domains,
        iso_tags: classification.iso_tags,
        nist_csf_functions: classification.nist_csf_functions,
        nist_800_53_families: classification.nist_800_53_families,
        iso_clauses: classification.iso_clauses,
        nist_controls: classification.nist_controls,
        summary: classification.summary,
        key_points: classification.key_points,
        recommended_action: classification.recommended_action,
        raw_ai_response: classification,
        confidence_score: classification.confidence_score,
        is_relevant: classification.is_relevant,
        relevance_reason: classification.relevance_reason,
        model_used: MODEL,
      })
      .select()
      .single();

    // Update item state
    await supabase
      .from("items")
      .update({ state: "classified", classified_at: new Date().toISOString() })
      .eq("id", item_id);

    await logEvent(supabase, item.workspace_id, "classification_created", "item", item_id, {
      impact_level: classification.impact_level,
      confidence_score: classification.confidence_score,
      is_relevant: classification.is_relevant,
      model: MODEL,
      classification_id: saved?.id,
    });

    // Trigger immediate notification for high-impact items
    if (classification.impact_level === "4") {
      fetch(`${baseUrl}/functions/v1/notify-immediate`, {
        method: "POST",
        headers: { Authorization: `Bearer ${serviceKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({ item_id }),
      }).catch(console.error);
    }

    // Slack notification
    const { data: ws } = await supabase
      .from("workspaces")
      .select("slack_webhook_url, slack_notify_l4, slack_notify_l3")
      .eq("id", item.workspace_id)
      .single();

    const shouldNotify = ws?.slack_webhook_url && (
      (classification.impact_level === "4" && ws.slack_notify_l4) ||
      (classification.impact_level === "3" && ws.slack_notify_l3)
    );

    if (shouldNotify) {
      const lvl = classification.impact_level;
      const emoji = lvl === "4" ? "🚨" : "⚠️";
      const appUrl = Deno.env.get("NEXT_PUBLIC_APP_URL") || "https://regwatch-xi.vercel.app";
      const conf = classification.confidence_score;
      fetch(ws.slack_webhook_url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: `${emoji} *L${lvl} RegWatch Alert* (${conf}% confidence)`,
          blocks: [
            {
              type: "section",
              text: {
                type: "mrkdwn",
                text: `${emoji} *<${appUrl}/items/${item_id}|${item.title || "Untitled"}>*\n${classification.summary?.slice(0, 150) || ""}${(classification.summary?.length || 0) > 150 ? "…" : ""}`,
              },
            },
            {
              type: "context",
              elements: [{
                type: "mrkdwn",
                text: `L${lvl} · ${conf}% confidence · ${classification.iso_clauses?.[0]?.code || "—"} · ${new Date().toLocaleDateString("en-GB", { day: "numeric", month: "short" })}`,
              }],
            },
            {
              type: "actions",
              elements: [{
                type: "button",
                text: { type: "plain_text", text: "View in RegWatch" },
                url: `${appUrl}/items/${item_id}`,
                style: "primary",
              }],
            },
          ],
        }),
      }).catch(console.error);
    }

    return json({
      success: true,
      impact_level: classification.impact_level,
      confidence_score: classification.confidence_score,
      is_relevant: classification.is_relevant,
      model: MODEL,
    });

  } catch (err) {
    console.error("Classification error:", err);

    await supabase.from("classification_failures").insert({
      workspace_id: item.workspace_id,
      item_id,
      error_type: "ai_error",
      error_message: String(err),
      raw_response: rawResponse,
    });

    await supabase
      .from("items")
      .update({ state: "classification_failed" })
      .eq("id", item_id);

    await logEvent(supabase, item.workspace_id, "classification_failed", "item", item_id, {
      error: String(err),
      model: MODEL,
    });

    return json({ error: String(err) }, 500);
  }
});
