import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { getServiceClient, json, logEvent } from "../_shared/supabase.ts";

function hashContent(text: string): string {
  // Simple deterministic hash using djb2
  let hash = 5381;
  for (let i = 0; i < text.length; i++) {
    hash = (hash * 33) ^ text.charCodeAt(i);
  }
  return (hash >>> 0).toString(16);
}

function parseRssFeed(xml: string): Array<{
  title: string;
  link: string;
  description: string;
  pubDate: string | null;
}> {
  const items: Array<{ title: string; link: string; description: string; pubDate: string | null }> = [];

  // Match both RSS <item> and Atom <entry> formats
  const itemRegex = /<(?:item|entry)[\s>]([\s\S]*?)<\/(?:item|entry)>/gi;
  let match;

  while ((match = itemRegex.exec(xml)) !== null) {
    const block = match[1];

    const title = (block.match(/<title[^>]*>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/title>/) || [])[1]?.trim() ?? "";
    const link =
      (block.match(/<link[^>]*href=["']([^"']+)["']/) || [])[1] ||
      (block.match(/<link[^>]*>([\s\S]*?)<\/link>/) || [])[1]?.trim() ||
      "";
    const description =
      (block.match(/<(?:description|summary|content)[^>]*>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/(?:description|summary|content)>/) || [])[1]?.trim() ?? "";
    const pubDate =
      (block.match(/<(?:pubDate|published|updated)[^>]*>([\s\S]*?)<\/(?:pubDate|published|updated)>/) || [])[1]?.trim() ?? null;

    if (link) {
      items.push({ title, link, description, pubDate });
    }
  }

  return items;
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

  // Fetch source
  const { data: source, error: srcErr } = await supabase
    .from("sources")
    .select("*")
    .eq("id", source_id)
    .single();

  if (srcErr || !source) {
    return json({ error: "Source not found" }, 404);
  }

  // Create ingestion run
  const { data: run, error: runErr } = await supabase
    .from("ingestion_runs")
    .insert({ workspace_id: source.workspace_id, source_id, status: "running" })
    .select()
    .single();

  if (runErr || !run) {
    return json({ error: "Failed to create ingestion run" }, 500);
  }

  let itemsDetected = 0;
  let itemsNew = 0;
  let itemsSkipped = 0;
  let errorMessage: string | null = null;

  try {
    // Fetch RSS feed
    const feedUrl = source.discovered_rss_url || source.url;
    const resp = await fetch(feedUrl, {
      headers: { "User-Agent": "RegWatch/1.0 RSS Monitor" },
    });

    if (!resp.ok) {
      throw new Error(`HTTP ${resp.status} fetching feed`);
    }

    const xml = await resp.text();
    const feedItems = parseRssFeed(xml);
    itemsDetected = feedItems.length;

    for (const feedItem of feedItems) {
      const contentToHash = feedItem.link + feedItem.title;
      const contentHash = hashContent(contentToHash);

      // Check for duplicate
      const { data: existing } = await supabase
        .from("items")
        .select("id")
        .eq("workspace_id", source.workspace_id)
        .eq("content_hash", contentHash)
        .maybeSingle();

      if (existing) {
        itemsSkipped++;
        continue;
      }

      // Insert new item
      const { data: newItem, error: insertErr } = await supabase
        .from("items")
        .insert({
          workspace_id: source.workspace_id,
          source_id,
          ingestion_run_id: run.id,
          canonical_url: feedItem.link,
          content_hash: contentHash,
          title: feedItem.title,
          published_at: feedItem.pubDate ? new Date(feedItem.pubDate).toISOString() : null,
          raw_payload: feedItem,
          extracted_text: feedItem.description,
          state: "unclassified",
        })
        .select()
        .single();

      if (insertErr) {
        console.error("Failed to insert item:", insertErr);
        continue;
      }

      itemsNew++;

      // Log event
      await logEvent(supabase, source.workspace_id, "item_detected", "item", newItem.id, {
        source_id,
        title: feedItem.title,
      });

      // Trigger classification
      fetch(`${baseUrl}/functions/v1/classify-item`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${serviceKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ item_id: newItem.id }),
      }).catch(console.error);
    }

    // Update source last_fetched_at
    await supabase
      .from("sources")
      .update({
        last_fetched_at: new Date().toISOString(),
        last_status: 200,
        last_error: null,
        consecutive_errors: 0,
      })
      .eq("id", source_id);

  } catch (err) {
    errorMessage = String(err);
    console.error("Ingestion error:", err);

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

  // Update ingestion run
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

  await logEvent(supabase, source.workspace_id, "ingestion_completed", "ingestion_run", run.id, {
    items_detected: itemsDetected,
    items_new: itemsNew,
    items_skipped: itemsSkipped,
  });

  return json({ run_id: run.id, items_detected: itemsDetected, items_new: itemsNew, items_skipped: itemsSkipped });
});
