import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { getServiceClient, json, logEvent } from "../_shared/supabase.ts";

// ─── Hashing ────────────────────────────────────────────────────────
function hashContent(text: string): string {
  let hash = 5381;
  for (let i = 0; i < text.length; i++) {
    hash = (hash * 33) ^ text.charCodeAt(i);
  }
  return (hash >>> 0).toString(16);
}

// ─── URL Relevance Filter ──────────────────────────────────────────
// Skip URLs that are clearly non-regulatory content
const SKIP_URL_PATTERNS = [
  // Navigation & site infrastructure
  /\/(about|contact|careers|jobs|team|staff|press|media|faq|help|support|login|signup|register|account|profile|privacy|cookie|terms|disclaimer|accessibility|sitemap|search|404|500)\b/i,
  // Media & assets
  /\.(jpg|jpeg|png|gif|svg|webp|ico|pdf|zip|tar|gz|mp3|mp4|avi|mov|wmv|css|js|woff|woff2|ttf|eot)(\?|$)/i,
  // Social & sharing
  /\/(share|tweet|facebook|twitter|linkedin|instagram|youtube|mailto:|tel:|javascript:)/i,
  // E-commerce & marketing
  /\/(shop|store|cart|checkout|subscribe|unsubscribe|newsletter|pricing|plans|demo|trial)/i,
  // Generic blog/news noise (not regulatory)
  /\/(tag|category|author|archive|page\/\d+|feed|rss|atom|wp-content|wp-admin|wp-includes)/i,
  // Anchors and fragments
  /^#/,
];

// Positive signals: URLs likely to contain regulatory content
const REGULATORY_URL_PATTERNS = [
  /\/(advisory|advisories|alert|alerts|bulletin|bulletins|notice|notices|guidance|guidances)/i,
  /\/(regulation|regulations|regulatory|compliance|enforcement|directive|directives)/i,
  /\/(vulnerability|vulnerabilities|cve|security-advisory|threat|threats)/i,
  /\/(consultation|consultations|policy|policies|rule|rules|rulemaking)/i,
  /\/(circular|circulars|gazette|order|orders|amendment|amendments)/i,
  /\/(news|press-release|announcement|update|publication|report)/i,
  /\/(decision|decisions|determination|framework|standard)/i,
];

function isRelevantUrl(url: string, baseUrl: string): boolean {
  // Skip if matches any negative pattern
  for (const pattern of SKIP_URL_PATTERNS) {
    if (pattern.test(url)) return false;
  }

  // Must be same domain or subdomain of source
  try {
    const urlHost = new URL(url).hostname;
    const baseHost = new URL(baseUrl).hostname;
    // Allow same domain or subdomains
    if (!urlHost.endsWith(baseHost.replace(/^www\./, "")) &&
        !baseHost.endsWith(urlHost.replace(/^www\./, ""))) {
      return false;
    }
  } catch {
    return false;
  }

  return true;
}

function urlRelevanceScore(url: string): number {
  let score = 50; // baseline
  for (const pattern of REGULATORY_URL_PATTERNS) {
    if (pattern.test(url)) {
      score += 15;
    }
  }
  // Cap at 100
  return Math.min(score, 100);
}

// ─── Intelligent Content Extraction (Readability-lite) ──────────────
function extractArticleContent(html: string): { text: string; method: string } {
  // Step 1: Remove noise elements
  let cleaned = html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<nav[\s\S]*?<\/nav>/gi, "")
    .replace(/<header[\s\S]*?<\/header>/gi, "")
    .replace(/<footer[\s\S]*?<\/footer>/gi, "")
    .replace(/<aside[\s\S]*?<\/aside>/gi, "")
    .replace(/<form[\s\S]*?<\/form>/gi, "")
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/<iframe[\s\S]*?<\/iframe>/gi, "")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, "");

  // Step 2: Try to find main content containers
  const contentSelectors = [
    /<article[^>]*>([\s\S]*?)<\/article>/gi,
    /<main[^>]*>([\s\S]*?)<\/main>/gi,
    /<div[^>]*(?:class|id)=["'][^"']*(?:content|article|post|entry|body|main|text)(?:-|_|\s|["'])[^"']*["'][^>]*>([\s\S]*?)<\/div>/gi,
    /<div[^>]*(?:class|id)=["'][^"']*(?:page-content|main-content|article-content|post-content|entry-content)["'][^>]*>([\s\S]*?)<\/div>/gi,
    /<section[^>]*(?:class|id)=["'][^"']*(?:content|article|main)["'][^>]*>([\s\S]*?)<\/section>/gi,
  ];

  let bestBlock = "";
  let bestBlockLength = 0;

  for (const selector of contentSelectors) {
    let match;
    selector.lastIndex = 0;
    while ((match = selector.exec(cleaned)) !== null) {
      const block = match[1] || match[0];
      const textContent = stripHtml(block);
      if (textContent.length > bestBlockLength) {
        bestBlock = textContent;
        bestBlockLength = textContent.length;
      }
    }
  }

  // Step 3: If we found good content blocks, use them
  if (bestBlockLength > 200) {
    return {
      text: bestBlock.slice(0, 15000),
      method: "readability",
    };
  }

  // Step 4: Fallback - extract paragraphs with density scoring
  const paragraphs: string[] = [];
  const pRegex = /<p[^>]*>([\s\S]*?)<\/p>/gi;
  let pMatch;
  while ((pMatch = pRegex.exec(cleaned)) !== null) {
    const text = stripHtml(pMatch[1]);
    // Only keep paragraphs with substantial text (> 40 chars)
    if (text.length > 40) {
      paragraphs.push(text);
    }
  }

  if (paragraphs.length > 0) {
    return {
      text: paragraphs.join("\n\n").slice(0, 15000),
      method: "paragraph_extraction",
    };
  }

  // Step 5: Last resort - basic strip
  const basicText = stripHtml(cleaned);
  return {
    text: basicText.slice(0, 10000),
    method: "basic",
  };
}

function stripHtml(html: string): string {
  return html
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
  "gazette", "proclamation", "act", "bill", "statute",
];

function scoreContentQuality(text: string, title: string, url: string): number {
  if (!text || text.length < 50) return 5;

  let score = 0;
  const lowerText = (text + " " + title).toLowerCase();
  const wordCount = text.split(/\s+/).length;

  // Word count scoring (0-25 points)
  if (wordCount >= 500) score += 25;
  else if (wordCount >= 200) score += 20;
  else if (wordCount >= 100) score += 12;
  else if (wordCount >= 50) score += 6;
  else score += 2;

  // Regulatory keyword density (0-40 points)
  let keywordHits = 0;
  const uniqueKeywords = new Set<string>();
  for (const kw of REGULATORY_KEYWORDS) {
    if (lowerText.includes(kw)) {
      keywordHits++;
      uniqueKeywords.add(kw);
    }
  }
  // Diversity of keywords matters more than raw count
  const diversityScore = Math.min(uniqueKeywords.size * 4, 40);
  score += diversityScore;

  // URL relevance bonus (0-15 points)
  const urlScore = urlRelevanceScore(url);
  score += Math.round((urlScore - 50) * 0.3); // 0-15 points

  // Structure indicators (0-10 points)
  if (/\d{4}/.test(text)) score += 2; // Contains dates/years
  if (/section\s+\d|article\s+\d|clause\s+\d/i.test(text)) score += 4; // Legal references
  if (/effective\s+date|compliance\s+deadline|implementation/i.test(text)) score += 4; // Action language

  // Title quality (0-10 points)
  if (title && title.length > 10) {
    const titleKeywords = REGULATORY_KEYWORDS.filter(kw => title.toLowerCase().includes(kw));
    score += Math.min(titleKeywords.length * 3, 10);
  }

  return Math.min(Math.max(score, 1), 100);
}

// ─── Smart Link Extraction (for webpage_list) ──────────────────────
function extractContentLinks(html: string, baseUrl: string): Array<{ url: string; anchorText: string; score: number }> {
  // First, try to extract links only from main content area
  let searchArea = html;
  const mainContentMatch = html.match(/<(?:main|article)[^>]*>([\s\S]*?)<\/(?:main|article)>/i) ||
    html.match(/<div[^>]*(?:class|id)=["'][^"']*(?:content|main|article|results|listing|publications)["'][^>]*>([\s\S]*?)<\/div>/i);

  if (mainContentMatch) {
    searchArea = mainContentMatch[1] || mainContentMatch[0];
  }

  const links: Array<{ url: string; anchorText: string; score: number }> = [];
  const regex = /<a[^>]+href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  const seen = new Set<string>();
  let match;

  while ((match = regex.exec(searchArea)) !== null) {
    try {
      const url = new URL(match[1], baseUrl).href;
      if (!url.startsWith("http") || seen.has(url)) continue;
      seen.add(url);

      if (!isRelevantUrl(url, baseUrl)) continue;

      const anchorText = stripHtml(match[2]).slice(0, 200);
      const score = urlRelevanceScore(url);

      // Boost score if anchor text contains regulatory keywords
      let textBoost = 0;
      const lowerAnchor = anchorText.toLowerCase();
      for (const kw of REGULATORY_KEYWORDS.slice(0, 20)) { // Check top keywords
        if (lowerAnchor.includes(kw)) textBoost += 5;
      }

      links.push({
        url,
        anchorText: anchorText || url,
        score: Math.min(score + textBoost, 100),
      });
    } catch {
      // ignore invalid URLs
    }
  }

  // Sort by relevance score, take top links
  return links
    .sort((a, b) => b.score - a.score)
    .slice(0, 50); // Cap at 50 most relevant links
}

// ─── Main Handler ──────────────────────────────────────────────────
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
  let itemsFiltered = 0;
  let errorMessage: string | null = null;

  try {
    const resp = await fetch(source.url, {
      headers: { "User-Agent": "RegWatch/1.0 Web Monitor" },
    });

    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);

    const html = await resp.text();

    if (source.kind === "webpage_change") {
      // ── Track page changes with intelligent extraction ──
      const contentHash = hashContent(html);
      const { text, method } = extractArticleContent(html);
      const qualityScore = scoreContentQuality(text, source.name || "", source.url);

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
            extraction_method: method,
            content_quality_score: qualityScore,
            state: qualityScore < 15 ? "classified" : "unclassified",
          })
          .select()
          .single();

        if (newItem) {
          itemsNew = 1;
          await logEvent(supabase, source.workspace_id, "item_detected", "item", newItem.id, { source_id, quality_score: qualityScore, extraction_method: method });

          // Auto-classify low-quality items as L1 informational
          if (qualityScore < 15) {
            await supabase.from("classifications").insert({
              workspace_id: source.workspace_id,
              item_id: newItem.id,
              source: "ai",
              impact_level: "1",
              impact_rationale: `Auto-classified as informational: content quality score ${qualityScore}/100 below threshold.`,
              iso_domains: [],
              iso_tags: [],
              nist_csf_functions: [],
              nist_800_53_families: [],
              iso_clauses: [],
              nist_controls: [],
              summary: "Low-quality or non-regulatory content auto-classified as informational.",
              key_points: [],
              recommended_action: "No action required.",
              confidence_score: 95,
              is_relevant: false,
              relevance_reason: "Below quality threshold",
              model_used: "quality_gate",
            });
          } else {
            // Trigger full classification
            fetch(`${baseUrl}/functions/v1/classify-item`, {
              method: "POST",
              headers: { Authorization: `Bearer ${serviceKey}`, "Content-Type": "application/json" },
              body: JSON.stringify({ item_id: newItem.id }),
            }).catch(console.error);
          }
        }
      }
    } else if (source.kind === "webpage_list") {
      // ── Smart link extraction with relevance filtering ──
      const scoredLinks = extractContentLinks(html, source.url);
      itemsDetected = scoredLinks.length;

      for (const link of scoredLinks) {
        const contentHash = hashContent(link.url);
        const { data: existing } = await supabase
          .from("items")
          .select("id")
          .eq("workspace_id", source.workspace_id)
          .eq("content_hash", contentHash)
          .maybeSingle();

        if (existing) { itemsSkipped++; continue; }

        // Fetch the linked page for content
        let title = link.anchorText || link.url;
        let text = "";
        let extractionMethod = "title_only";
        let qualityScore = 10;

        try {
          const pageResp = await fetch(link.url, {
            headers: { "User-Agent": "RegWatch/1.0" },
            signal: AbortSignal.timeout(8000), // 8s timeout per page
          });
          if (pageResp.ok) {
            const pageHtml = await pageResp.text();
            const titleMatch = pageHtml.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
            if (titleMatch?.[1]?.trim()) {
              title = stripHtml(titleMatch[1]);
            }
            const extracted = extractArticleContent(pageHtml);
            text = extracted.text;
            extractionMethod = extracted.method;
            qualityScore = scoreContentQuality(text, title, link.url);
          }
        } catch {
          // Use anchor text as fallback
          qualityScore = scoreContentQuality("", title, link.url);
        }

        // Skip very low quality pages entirely
        if (qualityScore < 8) {
          itemsFiltered++;
          continue;
        }

        const { data: newItem } = await supabase
          .from("items")
          .insert({
            workspace_id: source.workspace_id,
            source_id,
            ingestion_run_id: run.id,
            canonical_url: link.url,
            content_hash: contentHash,
            title,
            raw_payload: { url: link.url, kind: "webpage_list", anchor_text: link.anchorText, link_score: link.score },
            extracted_text: text,
            extraction_method: extractionMethod,
            content_quality_score: qualityScore,
            state: qualityScore < 15 ? "classified" : "unclassified",
          })
          .select()
          .single();

        if (newItem) {
          itemsNew++;
          await logEvent(supabase, source.workspace_id, "item_detected", "item", newItem.id, { source_id, quality_score: qualityScore });

          if (qualityScore < 15) {
            // Auto-classify as L1
            await supabase.from("classifications").insert({
              workspace_id: source.workspace_id,
              item_id: newItem.id,
              source: "ai",
              impact_level: "1",
              impact_rationale: `Auto-classified: quality score ${qualityScore}/100.`,
              iso_domains: [],
              iso_tags: [],
              nist_csf_functions: [],
              nist_800_53_families: [],
              iso_clauses: [],
              nist_controls: [],
              summary: "Low-quality content auto-classified as informational.",
              key_points: [],
              recommended_action: "No action required.",
              confidence_score: 95,
              is_relevant: false,
              relevance_reason: "Below quality threshold",
              model_used: "quality_gate",
            });
          } else {
            fetch(`${baseUrl}/functions/v1/classify-item`, {
              method: "POST",
              headers: { Authorization: `Bearer ${serviceKey}`, "Content-Type": "application/json" },
              body: JSON.stringify({ item_id: newItem.id }),
            }).catch(console.error);
          }
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

  return json({
    run_id: run.id,
    items_detected: itemsDetected,
    items_new: itemsNew,
    items_skipped: itemsSkipped,
    items_filtered: itemsFiltered,
  });
});
