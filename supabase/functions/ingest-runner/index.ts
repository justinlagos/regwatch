import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { getServiceClient, verifyAuth, json } from "../_shared/supabase.ts";

Deno.serve(async (req: Request) => {
  if (!verifyAuth(req)) {
    return json({ error: "Unauthorized" }, 401);
  }

  const supabase = getServiceClient();
  const baseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  // Fetch all active sources across all workspaces
  const { data: sources, error } = await supabase
    .from("sources")
    .select("id, workspace_id, kind, name")
    .eq("state", "active");

  if (error) {
    console.error("Failed to fetch sources:", error);
    return json({ error: error.message }, 500);
  }

  if (!sources || sources.length === 0) {
    return json({ message: "No active sources found", triggered: 0 });
  }

  const results: Array<{ source_id: string; name: string; status: number | string }> = [];

  for (const source of sources) {
    const fnName = source.kind === "rss" ? "ingest-rss" : "ingest-web";
    try {
      const resp = await fetch(`${baseUrl}/functions/v1/${fnName}`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${serviceKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ source_id: source.id }),
      });
      results.push({ source_id: source.id, name: source.name, status: resp.status });
    } catch (err) {
      console.error(`Failed to trigger ${fnName} for source ${source.id}:`, err);
      results.push({ source_id: source.id, name: source.name, status: String(err) });
    }
  }

  return json({
    triggered: results.length,
    results,
  });
});
