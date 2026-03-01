import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { getServiceClient, json } from "../_shared/supabase.ts";

function toCSV(rows: Record<string, unknown>[]): string {
  if (!rows.length) return "";
  const headers = Object.keys(rows[0]);
  const escape = (v: unknown) => {
    const s = Array.isArray(v) ? v.join("; ") : String(v ?? "");
    return s.includes(",") || s.includes('"') || s.includes("\n")
      ? `"${s.replace(/"/g, '""')}"`
      : s;
  };
  return [
    headers.join(","),
    ...rows.map((r) => headers.map((h) => escape(r[h])).join(",")),
  ].join("\n");
}

Deno.serve(async (req: Request) => {
  const url = new URL(req.url);
  const workspaceId = url.searchParams.get("workspace_id");
  const format = url.searchParams.get("format") || "json";
  const minLevel = url.searchParams.get("min_level") || "1";
  const since = url.searchParams.get("since"); // ISO date string
  const sourceType = url.searchParams.get("source_type");

  if (!workspaceId) return json({ error: "workspace_id is required" }, 400);
  if (!["json", "csv"].includes(format)) return json({ error: "format must be json or csv" }, 400);

  const supabase = getServiceClient();

  // Build items query
  let query = supabase
    .from("items")
    .select("*, sources(name, source_type, jurisdiction, url), classifications(*)")
    .eq("workspace_id", workspaceId)
    .eq("state", "classified")
    .order("detected_at", { ascending: false })
    .limit(1000);

  if (since) query = query.gte("detected_at", since);
  if (sourceType) query = query.eq("sources.source_type", sourceType);

  const { data: items, error } = await query;

  if (error) return json({ error: error.message }, 500);

  // Filter by impact level and flatten
  const rows = (items || [])
    .filter((item) => {
      const cls = (item.classifications as Array<{ impact_level: string }>)?.[0];
      return cls && parseInt(cls.impact_level) >= parseInt(minLevel);
    })
    .map((item) => {
      const cls = (item.classifications as Array<Record<string, unknown>>)?.[0] || {};
      return {
        id: item.id,
        title: item.title,
        canonical_url: item.canonical_url,
        source_name: (item.sources as Record<string, unknown>)?.name,
        source_type: (item.sources as Record<string, unknown>)?.source_type,
        jurisdiction: (item.sources as Record<string, unknown>)?.jurisdiction,
        published_at: item.published_at,
        detected_at: item.detected_at,
        impact_level: cls.impact_level,
        impact_rationale: cls.impact_rationale,
        summary: cls.summary,
        key_points: cls.key_points,
        recommended_action: cls.recommended_action,
        iso_domains: cls.iso_domains,
        iso_tags: cls.iso_tags,
        nist_csf_functions: cls.nist_csf_functions,
        nist_800_53_families: cls.nist_800_53_families,
      };
    });

  if (format === "csv") {
    const csv = toCSV(rows);
    return new Response(csv, {
      headers: {
        "Content-Type": "text/csv",
        "Content-Disposition": `attachment; filename="regwatch-export-${new Date().toISOString().split("T")[0]}.csv"`,
      },
    });
  }

  return new Response(
    JSON.stringify({ exported_at: new Date().toISOString(), count: rows.length, items: rows }, null, 2),
    {
      headers: {
        "Content-Type": "application/json",
        "Content-Disposition": `attachment; filename="regwatch-export-${new Date().toISOString().split("T")[0]}.json"`,
      },
    }
  );
});
