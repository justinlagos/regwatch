import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { getServiceClient, json, logEvent } from "../_shared/supabase.ts";

const OPENAI_API_URL = "https://api.openai.com/v1/chat/completions";

interface ClassificationResult {
  impact_level: "1" | "2" | "3" | "4";
  impact_rationale: string;
  iso_domains: string[];
  iso_tags: string[];
  nist_csf_functions: string[];
  nist_800_53_families: string[];
  summary: string;
  key_points: string[];
  recommended_action: string;
}

async function classifyWithOpenAI(
  content: string,
  isoDomains: Array<{ code: string; label: string }>,
  isoTags: Array<{ code: string; label: string }>,
  nistCsfFunctions: Array<{ code: string; label: string }>,
  nist80053Families: Array<{ code: string; label: string }>
): Promise<ClassificationResult> {
  const apiKey = Deno.env.get("OPENAI_API_KEY")!;

  const systemPrompt = `You are a regulatory intelligence analyst. Classify the given content and return a JSON object.

Impact levels:
1 = Informational only, no action needed
2 = Low impact, monitor situation
3 = Medium impact, policy review recommended
4 = High impact, immediate action required

Available ISO domains: ${isoDomains.map(d => `${d.code} (${d.label})`).join(", ")}
Available ISO tags: ${isoTags.map(t => `${t.code} (${t.label})`).join(", ")}
Available NIST CSF functions: ${nistCsfFunctions.map(f => `${f.code} (${f.label})`).join(", ")}
Available NIST 800-53 families: ${nist80053Families.map(f => `${f.code} (${f.label})`).join(", ")}

Return ONLY valid JSON with this exact structure:
{
  "impact_level": "1"|"2"|"3"|"4",
  "impact_rationale": "brief explanation of why this impact level was assigned",
  "iso_domains": ["code1", "code2"],
  "iso_tags": ["code1", "code2"],
  "nist_csf_functions": ["code1", "code2"],
  "nist_800_53_families": ["code1", "code2"],
  "summary": "2-3 sentence summary of the regulatory/threat content",
  "key_points": ["point 1", "point 2", "point 3"],
  "recommended_action": "specific recommended action for compliance/security teams"
}`;

  const resp = await fetch(OPENAI_API_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: `Classify this content:\n\n${content.slice(0, 6000)}` },
      ],
      response_format: { type: "json_object" },
      temperature: 0.1,
    }),
  });

  if (!resp.ok) {
    const err = await resp.text();
    throw new Error(`OpenAI API error ${resp.status}: ${err}`);
  }

  const data = await resp.json();
  const raw = data.choices[0].message.content;
  return JSON.parse(raw) as ClassificationResult;
}

Deno.serve(async (req: Request) => {
  const body = await req.json().catch(() => ({}));
  const { item_id } = body;

  if (!item_id) {
    return json({ error: "item_id is required" }, 400);
  }

  const supabase = getServiceClient();
  const baseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  // Fetch item
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

  // Build content to classify
  const contentParts = [
    item.title ? `Title: ${item.title}` : "",
    item.sources?.name ? `Source: ${item.sources.name}` : "",
    item.sources?.source_type ? `Type: ${item.sources.source_type}` : "",
    item.sources?.jurisdiction ? `Jurisdiction: ${item.sources.jurisdiction}` : "",
    item.extracted_text ? `\nContent:\n${item.extracted_text}` : "",
  ]
    .filter(Boolean)
    .join("\n");

  let classification: ClassificationResult | null = null;
  let rawResponse: string | null = null;

  try {
    classification = await classifyWithOpenAI(
      contentParts,
      isoDomains || [],
      isoTags || [],
      nistCsf || [],
      nist80053 || []
    );

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
        summary: classification.summary,
        key_points: classification.key_points,
        recommended_action: classification.recommended_action,
        raw_ai_response: classification,
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

    return json({ success: true, impact_level: classification.impact_level });

  } catch (err) {
    console.error("Classification error:", err);

    // Log failure
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
    });

    return json({ error: String(err) }, 500);
  }
});
