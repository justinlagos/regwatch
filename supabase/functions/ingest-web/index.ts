import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { getServiceClient, json, logEvent } from "../_shared/supabase.ts";

function hashContent(text: string): string {
  let hash = 5381;
  for (let i = 0; i < text.length; i++) {
    hash = (hash * 33) ^ text.charCodeAt(i);
  }
  return (hash >>> 0).toString(16);
}

function extractText(html: string): string {
  // Strip scripts, styles, and HTML tags
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 10000); // limit extracted text
}

function extractLinks(html: string, baseUrl: string): string[] {
  const links: string[] = [];
  const regex = /<a[^>]+href=["']([^"']+)["'][^>]*>/gi;
  let match;
  while ((match = regex.exec(html)) !== null) {
    try {
      const url = new URL(match[1], baseUrl).href;
      if (url.startsWith("http")) links.push(url);
    } catch {
      // ignore invalid URLs
    }
  }
  return [...new Set(links)];
}

Deno.serve(async (req: Request) => {
  const body = await req.json().catch(() => ({}));
  const { source_id } = body;

  if (!source_id) {
    return json({ error: "source_id is required" }, 400);
  }

  const supabase = getServiceClient();
  const baseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  const { data: source, error: srcErr } = await supabase
    .from("sources")
    .select("*")
    .eq("id", source_id)
    .single();

  if (srcErr || !source) {
    return json({ error: "Source not found" }, 404);
  }

  const { data: run } = await supabase
    .from("ingestion_runs")
    .insert({ workspace_id: source.workspace_id, source_id, status: "running" })
    .select()
    .single();

  if (!run) return json({ error: "Failed to create run" }, 500);

  let itemsDetected = 0;
  let itemsNew = 0;
  let itemsSkipped = 0;
  let errorMessage: string | null = null;

  try {
    const resp = await fetch(source.url, {
      headers: { "User-Agent": "RegWatch/1.0 Web Monitor" },
    });

    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);

    const html = await resp.text();

    if (source.kind === "webpage_change") {
      // Track page changes
      const contentHash = hashContent(html);
      const text = extractText(html);

      const { data: existing } = await supabase
        .from("items")
        .select("id, content_hash")
        .eq("workspace_id", source.workspace_id)
        .eq("source_id", source_id)
        .eq("canonical_url", source.url)
        .order("detected_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      itemsDetected = 1;

      if (existing?.content_hash === contentHash) {
        itemsSkipped = 1;
      } else {
        const { data: newItem } = await supabase
          .from("items")
          .insert({
            workspace_id: source.workspace_id,
            source_id,
            ingestion_run_id: run.id,
            canonical_url: source.url,
            content_hash: contentHash,
            title: source.name,
            raw_payload: { url: source.url, kind: "webpage_change" },
            extracted_text: text,
            state: "unclassified",
          })
          .select()
          .single();

        if (newItem) {
          itemsNew = 1;
          await logEvent(supabase, source.workspace_id, "item_detected", "item", newItem.id, { source_id });
          fetch(`${baseUrl}/functions/v1/classify-item`, {
            method: "POST",
            headers: { Authorization: `Bearer ${serviceKey}`, "Content-Type": "application/json" },
            body: JSON.stringify({ item_id: newItem.id }),
          }).catch(console.error);
        }
      }
    } else if (source.kind === "webpage_list") {
      // Extract all links from the page as individual items
      const links = extractLinks(html, source.url);
      itemsDetected = links.length;

      for (const link of links) {
        const contentHash = hashContent(link);
        const { data: existing } = await supabase
          .from("items")
          .select("id")
          .eq("workspace_id", source.workspace_id)
          .eq("content_hash", contentHash)
          .maybeSingle();

        if (existing) { itemsSkipped++; continue; }

        // Fetch the linked page for title
        let title = link;
        let text = "";
        try {
          const pageResp = await fetch(link, { headers: { "User-Agent": "RegWatch/1.0" } });
          if (pageResp.ok) {
            const pageHtml = await pageResp.text();
            const titleMatch = pageHtml.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
            title = titleMatch?.[1]?.trim() || link;
            text = extractText(pageHtml);
          }
        } catch { /* use link as title */ }

        const { data: newItem } = await supabase
          .from("items")
          .insert({
            workspace_id: source.workspace_id,
            source_id,
            ingestion_run_id: run.id,
            canonical_url: link,
            content_hash: contentHash,
            title,
            raw_payload: { url: link, kind: "webpage_list" },
            extracted_text: text,
            state: "unclassified",
          })
          .select()
          .single();

        if (newItem) {
          itemsNew++;
          await logEvent(supabase, source.workspace_id, "item_detected", "item", newItem.id, { source_id });
          fetch(`${baseUrl}/functions/v1/classify-item`, {
            method: "POST",
            headers: { Authorization: `Bearer ${serviceKey}`, "Content-Type": "application/json" },
            body: JSON.stringify({ item_id: newItem.id }),
          }).catch(console.error);
        }
      }
    }

    await supabase
      .from("sources")
      .update({ last_fetched_at: new Date().toISOString(), last_status: 200, last_error: null, consecutive_errors: 0 })
      .eq("id", source_id);

  } catch (err) {
    errorMessage = String(err);
    await supabase
      .from("sources")
      .update({
        last_fetched_at: new Date().toISOString(),
        last_error: errorMessage,
        consecutive_errors: (source.consecutive_errors || 0) + 1,
        state: (source.consecutive_errors || 0) >= 4 ? "error" : source.state,
      })
      .eq("id", source_id);
  }

  await supabase
    .from("ingestion_runs")
    .update({
      status: errorMessage ? "failed" : "completed",
      items_detected: itemsDetected,
      items_new: itemsNew,
      items_skipped: itemsSkipped,
      error_message: errorMessage,
      completed_at: new Date().toISOString(),
    })
    .eq("id", run.id);

  return json({ run_id: run.id, items_detected: itemsDetected, items_new: itemsNew, items_skipped: itemsSkipped });
});
