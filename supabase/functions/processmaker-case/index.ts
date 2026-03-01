import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { getServiceClient, json, logEvent } from "../_shared/supabase.ts";

Deno.serve(async (req: Request) => {
  const body = await req.json().catch(() => ({}));
  const { item_id, classification_id } = body;

  if (!item_id) {
    return json({ error: "item_id is required" }, 400);
  }

  const supabase = getServiceClient();

  // Fetch item with classification
  const { data: item } = await supabase
    .from("items")
    .select("*, sources(name, source_type, jurisdiction, url)")
    .eq("id", item_id)
    .single();

  if (!item) return json({ error: "Item not found" }, 404);

  // Get classification — use provided ID or latest for this item
  const classQuery = supabase
    .from("classifications")
    .select("*")
    .eq("item_id", item_id)
    .order("created_at", { ascending: false })
    .limit(1);

  if (classification_id) classQuery.eq("id", classification_id);

  const { data: classifications } = await classQuery;
  const classification = classifications?.[0];

  if (!classification) return json({ error: "Classification not found" }, 404);

  // Get ProcessMaker connector config for this workspace
  const { data: config } = await supabase
    .from("connector_configs")
    .select("*")
    .eq("workspace_id", item.workspace_id)
    .eq("connector", "processmaker")
    .eq("enabled", true)
    .maybeSingle();

  if (!config) {
    return json({ error: "ProcessMaker connector not configured or not enabled" }, 400);
  }

  const pmConfig = config.config as {
    url: string;
    client_id: string;
    client_secret: string;
    process_id: string;
  };

  // Build case payload
  const casePayload = {
    item_id: item.id,
    title: item.title,
    source_name: item.sources?.name,
    source_type: item.sources?.source_type,
    jurisdiction: item.sources?.jurisdiction,
    canonical_url: item.canonical_url,
    published_at: item.published_at,
    impact_level: classification.impact_level,
    impact_rationale: classification.impact_rationale,
    summary: classification.summary,
    key_points: classification.key_points,
    recommended_action: classification.recommended_action,
    iso_domains: classification.iso_domains,
    iso_tags: classification.iso_tags,
    nist_csf_functions: classification.nist_csf_functions,
    nist_800_53_families: classification.nist_800_53_families,
    detected_at: item.detected_at,
  };

  // Create outbound case record
  const { data: outboundCase } = await supabase
    .from("outbound_cases")
    .insert({
      workspace_id: item.workspace_id,
      item_id,
      classification_id: classification.id,
      connector: "processmaker",
      payload_json: casePayload,
      status: "sending",
    })
    .select()
    .single();

  if (!outboundCase) return json({ error: "Failed to create outbound case" }, 500);

  await logEvent(supabase, item.workspace_id, "case_queued", "outbound_case", outboundCase.id, { item_id });

  try {
    // Get ProcessMaker OAuth token
    const tokenResp = await fetch(`${pmConfig.url}/oauth/token`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "client_credentials",
        client_id: pmConfig.client_id,
        client_secret: pmConfig.client_secret,
      }),
    });

    if (!tokenResp.ok) throw new Error(`ProcessMaker auth failed: ${tokenResp.status}`);
    const { access_token } = await tokenResp.json();

    // Create case in ProcessMaker
    const caseResp = await fetch(`${pmConfig.url}/api/1.0/cases`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${access_token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        pro_uid: pmConfig.process_id,
        variables: casePayload,
      }),
    });

    if (!caseResp.ok) {
      const errText = await caseResp.text();
      throw new Error(`ProcessMaker case creation failed: ${caseResp.status} ${errText}`);
    }

    const caseData = await caseResp.json();

    await supabase
      .from("outbound_cases")
      .update({
        status: "sent",
        external_case_id: String(caseData.APP_UID || caseData.id || ""),
        external_case_url: caseData.url || null,
        last_response: caseData,
        sent_at: new Date().toISOString(),
        attempts: (outboundCase.attempts || 0) + 1,
      })
      .eq("id", outboundCase.id);

    await supabase
      .from("items")
      .update({ state: "sent_to_processmaker" })
      .eq("id", item_id);

    await logEvent(supabase, item.workspace_id, "case_sent", "outbound_case", outboundCase.id, {
      external_case_id: caseData.APP_UID,
    });

    return json({ success: true, case_id: outboundCase.id, external_case_id: caseData.APP_UID });

  } catch (err) {
    await supabase
      .from("outbound_cases")
      .update({
        status: "failed",
        last_error: String(err),
        attempts: (outboundCase.attempts || 0) + 1,
        next_retry_at: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
      })
      .eq("id", outboundCase.id);

    await logEvent(supabase, item.workspace_id, "case_failed", "outbound_case", outboundCase.id, { error: String(err) });

    return json({ error: String(err) }, 500);
  }
});
