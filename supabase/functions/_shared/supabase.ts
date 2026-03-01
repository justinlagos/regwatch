import { createClient } from "jsr:@supabase/supabase-js@2";

export function getServiceClient() {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false } }
  );
}

export function verifyAuth(req: Request): boolean {
  const auth = req.headers.get("Authorization");
  const secret = Deno.env.get("CRON_SECRET");
  if (!auth || !secret) return false;
  return auth === `Bearer ${secret}` || auth === `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`;
}

export function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export function logEvent(
  supabase: ReturnType<typeof getServiceClient>,
  workspaceId: string,
  eventType: string,
  entityType: string,
  entityId: string,
  payload: Record<string, unknown> = {}
) {
  return supabase.from("events").insert({
    workspace_id: workspaceId,
    event_type: eventType,
    entity_type: entityType,
    entity_id: entityId,
    payload,
  });
}
