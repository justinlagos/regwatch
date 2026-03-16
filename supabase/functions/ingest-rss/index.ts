import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { getServiceClient, json, logEvent } from "../_shared/supabase.ts";

function hashContent(text: string): string {
  let hash = 5381;
  for (let i = 0; i < text.length; i++) {
    hash = (hash * 33) ^ text.charCodeAt(i);
  }
  return (hash >>> 0).toString(16);
}

function stripHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&[a-z]+;/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// ─── Content Quality Scoring ────────────────────────────────────────
const REGULATORY_KEYWORDS = [
  "regulation", "regulatory", "compliance", "enforcement", "directive",
  "advisory", "vulnerability", "security", "privacy", "data protection",
  "risk", "audit", "framework", "standard", "policy", "guideline",
  "requirement", "obligation", "penalty", "sanction", "incident",
  "breach", "notification", "assessment", "control", "governance",
  "iso", "nist", "gdpr", "pci", "hipaa", "sox", "dora", "nis2",
  "cybersecurity", "threat", "malware", "ransomware", "phishing",
  "critical infrastructure", "supply chain", "third party",
  "financial services", "banking", "insurance", "fintech",
  "central bank", "monetary", "fiscal", "prudential",
  "consultation", "rulemaking", "amendment", "circular",
];

function scoreContentQuality(text: string, title: string, url: string): number {
  if (!text || text.length < 20) return 5;

  let score = 0;
  const lowerText = (text + " " + title).toLowerCase();
  const wordCount = text.split(/\s+/).length;

  // Word count scoring (0-25)
  if (wordCount >= 300) score += 25;
  else if (wordCount >= 100) score += 18;
  else if (wordCount >= 50) score += 10;
  else score += 3;

  // Regulatory keyword diversity (0-40)
  const uniqueKeywords = new Set<string>();
  for (const kw of REGULATORY_KEYWORDS) {
    if (lowerText.includes(kw)) uniqueKeywords.add(kw);
  }
  score += Math.min(uniqueKeywords.size * 4, 40);

  // Structure indicators (0-15)
  if (/\d{4}/.test(text)) score += 3;
  if (/section\s+\d|article\s+\d|clause\s+\d/i.test(text)) score += 6;
  if (/effective\s+date|compliance\s+deadline|implementation/i.test(text)) score += 6;

  // Title quality (0-10)
  if (title && title.length > 10) {
    const titleKeywords = REGULATORY_KEYWORDS.filter(kw => title.toLowerCase().includes(kw));
    score += Math.min(titleKeywords.length * 3, 10);
  }

  // RSS descriptions are often summaries — give a baseline boost
  score += 10;

  return Math.min(Math.max(score, 1), 100);
}

// ─── Intelligent Article Extraction ─────────────────────────────────
function extractArticleContent(html: string): { text: string; method: string } {
  let cleaned = html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<nav[\s\S]*?<\/nav>/gi, "")
    .replace(/<header[\s\S]*?<\/header>/gi, "")
    .replace(/<footer[\s\S]*?<\/footer>/gi, "")
    .replace(/<aside[\s\S]*?<\/aside>/gi, "")
    .replace(/<!--[\s\S]*?-->/g, "");

  // Try content containers
  const contentSelectors = [
    /<article[^>]*>([\s\S]*?)<\/article>/gi,
    /<main[^>]*>([\s\S]*?)<\/main>/gi,
    /<div[^>]*(?:class|id)=["'][^"']*(?:content|article|post|entry|body|main|text)(?:-|_|\s|["'])[^"']*["'][^>]*>([\s\S]*?)<\/div>/gi,
  ];

  let bestBlock = "";
  let bestLen = 0;

  for (const sel of contentSelectors) {
    let match;
    sel.lastIndex = 0;
    while ((match = sel.exec(cleaned)) !== null) {
      const block = match[1] || match[0];
      const text = stripHtml(block);
      if (text.length > bestLen) { bestBlock = text; bestLen = text.length; }
    }
  }

  if (bestLen > 200) return { text: bestBlock.slice(0, 15000), method: "readability" };

  // Fallback to paragraphs
  const paragraphs: string[] = [];
  const pRegex = /<p[^>]*>([\s\S]*?)<\/p>/gi;
  let pMatch;
  while ((pMatch = pRegex.exec(cleaned)) !== null) {
    const text = stripHtml(pMatch[1]);
    if (text.length > 40) paragraphs.push(text);
  }
  if (paragraphs.length > 0) return { text: paragraphs.join("\n\n").slice(0, 15000), method: "paragraph_extraction" };

  return { text: stripHtml(cleaned).slice(0, 10000), method: "basic" };
}

// ─── RSS Parser ─────────────────────────────────────────────────────
function parseRssFeed(xml: string): Array<{
  title: string; link: string; description: string; pubDate: string | null;
}> {
  const items: Array<{ title: string; link: string; description: string; pubDate: string | null }> = [];
  const itemRegex = /<(?:item|entry)[\s>]([\s\S]*?)<\/(?:item|entry)>/gi;
  let match;

  while ((match = itemRegex.exec(xml)) !== null) {
    const block = match[1];
    const title = (block.match(/<title[^>]*>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/title>/) || [])[1]?.trim() ?? "";
    const link =
      (block.match(/<link[^>]*href=["']([^"']+)["']/) || [])[1] ||
      (block.match(/<link[^>]*>([\s\S]*?)<\/link>/) || [])[1]?.trim() || "";
    const description =
      (block.match(/<(?:description|summary|content)[^>]*>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/(?:description|summary|content)>/) || [])[1]?.trim() ?? "";
    const pubDate =
      (block.match(/<(?:pubDate|published|updated)[^>]*>([\s\S]*?)<\/(?:pubDate|published|updated)>/) || [])[1]?.trim() ?? null;

    if (link) items.push({ title, link, description, pubDate });
  }

  return items;
}

// ─── Main Handler ──────────────────────────────────────────────────
Deno.serve(async (req: Request) => {
  const body = await req.json().catch(() => ({}));
  const { source_id } = body;

  if (!source_id) return json({ error: "source_id is required" }, 400);

  const supabase = getServiceClient();
  const baseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  const { data: source, error: srcErr } = await supabase
    .from("sources").select("*").eq("id", source_id).single();

  if (srcErr || !source) return json({ error: "Source not found" }, 404);

  const { data: run, error: runErr } = await supabase
    .from("ingestion_runs")
    .insert({ workspace_id: source.workspace_id, source_id, status: "running" })
    .select().single();

  if (runErr || !run) return json({ error: "Failed to create ingestion run" }, 500);

  let itemsDetected = 0;
  let itemsNew = 0;
  let itemsSkipped = 0;
  let itemsEnriched = 0;
  let errorMessage: string | null = null;

  try {
    const feedUrl = source.discovered_rss_url || source.url;
    const resp = await fetch(feedUrl, { headers: { "User-Agent": "RegWatch/1.0 RSS Monitor" } });
    if (!resp.ok) throw new Error(`HTTP ${resp.status} fetching feed`);

    const xml = await resp.text();
    const feedItems = parseRssFeed(xml);
    itemsDetected = feedItems.length;

    for (const feedItem of feedItems) {
      const contentToHash = feedItem.link + feedItem.title;
      const contentHash = hashContent(contentToHash);

      const { data: existing } = await supabase
        .from("items").select("id")
        .eq("workspace_id", source.workspace_id)
        .eq("content_hash", contentHash)
        .maybeSingle();

      if (existing) { itemsSkipped++; continue; }

      // Start with RSS description
      let extractedText = stripHtml(feedItem.description);
      let extractionMethod = "rss_description";

      // If description is short, try to fetch the full article
      if (extractedText.length < 300 && feedItem.link) {
        try {
          const pageResp = await fetch(feedItem.link, {
            headers: { "User-Agent": "RegWatch/1.0" },
            signal: AbortSignal.timeout(8000),
          });
          if (pageResp.ok) {
            const pageHtml = await pageResp.text();
            const extracted = extractArticleContent(pageHtml);
            if (extracted.text.length > extractedText.length) {
              extractedText = extracted.text;
              extractionMethod = `full_page_${extracted.method}`;
              itemsEnriched++;
            }
          }
        } catch {
          // Keep RSS description
        }
      }

      const qualityScore = scoreContentQuality(extractedText, feedItem.title, feedItem.link);

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
          extracted_text: extractedText,
          extraction_method: extractionMethod,
          content_quality_score: qualityScore,
          state: qualityScore < 12 ? "classified" : "unclassified",
        })
        .select().single();

      if (insertErr) { console.error("Failed to insert item:", insertErr); continue; }

      itemsNew++;

      await logEvent(supabase, source.workspace_id, "item_detected", "item", newItem.id, {
        source_id, title: feedItem.title, quality_score: qualityScore, extraction_method: extractionMethod,
      });

      // Auto-classify very low quality as L1
      if (qualityScore < 12) {
        await supabase.from("classifications").insert({
          workspace_id: source.workspace_id,
          item_id: newItem.id,
          source: "ai",
          impact_level: "1",
          impact_rationale: `Auto-classified: content quality score ${qualityScore}/100 below threshold.`,
          iso_domains: [], iso_tags: [], nist_csf_functions: [], nist_800_53_families: [],
          iso_clauses: [], nist_controls: [],
          summary: "Low-quality content auto-classified as informational.",
          key_points: [], recommended_action: "No action required.",
          confidence_score: 95, is_relevant: false,
          relevance_reason: "Below quality threshold", model_used: "quality_gate",
        });
      } else {
        fetch(`${baseUrl}/functions/v1/classify-item`, {
          method: "POST",
          headers: { Authorization: `Bearer ${serviceKey}`, "Content-Type": "application/json" },
          body: JSON.stringify({ item_id: newItem.id }),
        }).catch(console.error);
      }
    }

    await supabase.from("sources").update({
      last_fetched_at: new Date().toISOString(), last_status: 200, last_error: null, consecutive_errors: 0,
    }).eq("id", source_id);

  } catch (err) {
    errorMessage = String(err);
    console.error("Ingestion error:", err);
    await supabase.from("sources").update({
      last_fetched_at: new Date().toISOString(), last_error: errorMessage,
      consecutive_errors: (source.consecutive_errors || 0) + 1,
      state: (source.consecutive_errors || 0) >= 4 ? "error" : source.state,
    }).eq("id", source_id);
  }

  await supabase.from("ingestion_runs").update({
    status: errorMessage ? "failed" : "completed",
    items_detected: itemsDetected, items_new: itemsNew, items_skipped: itemsSkipped,
    error_message: errorMessage, completed_at: new Date().toISOString(),
  }).eq("id", run.id);

  await logEvent(supabase, source.workspace_id, "ingestion_completed", "ingestion_run", run.id, {
    items_detected: itemsDetected, items_new: itemsNew, items_skipped: itemsSkipped, items_enriched: itemsEnriched,
  });

  return json({ run_id: run.id, items_detected: itemsDetected, items_new: itemsNew, items_skipped: itemsSkipped, items_enriched: itemsEnriched });
});
