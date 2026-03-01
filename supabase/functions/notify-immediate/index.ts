import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { getServiceClient, json, logEvent } from "../_shared/supabase.ts";

const IMPACT_LABELS: Record<string, string> = {
  "1": "Informational",
  "2": "Low",
  "3": "Medium",
  "4": "High — Action Required",
};

// Resend free tier: must send from onboarding@resend.dev or a verified custom domain
// Using onboarding@resend.dev as the shared sender for unverified accounts
const RESEND_FROM = "RegWatch <onboarding@resend.dev>";

async function sendEmailWithRetry(to: string[], subject: string, html: string, maxRetries = 3): Promise<void> {
  const apiKey = Deno.env.get("RESEND_API_KEY")!;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    const resp = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: RESEND_FROM, to, subject, html }),
    });

    if (resp.ok) return;

    if (resp.status === 429 && attempt < maxRetries - 1) {
      // Rate limited — wait with exponential backoff: 1s, 2s, 4s
      const delay = Math.pow(2, attempt) * 1000;
      await new Promise(resolve => setTimeout(resolve, delay));
      continue;
    }

    const err = await resp.text();
    throw new Error(`Resend error ${resp.status}: ${err}`);
  }
}

function buildEmailHtml(item: Record<string, unknown>, classification: Record<string, unknown>, appUrl: string): string {
  const impactLabel = IMPACT_LABELS[classification.impact_level as string] || "Unknown";
  const impactColor = classification.impact_level === "4" ? "#dc2626" : "#d97706";
  const keyPoints = (classification.key_points as string[] || []).map(p => `<li>${p}</li>`).join("");

  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width"></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; background: #f9fafb;">
  <div style="background: white; border-radius: 8px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
    <div style="background: ${impactColor}; padding: 16px 24px;">
      <p style="color: white; margin: 0; font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em;">RegWatch Alert</p>
      <h1 style="color: white; margin: 4px 0 0; font-size: 20px;">Impact Level ${classification.impact_level}: ${impactLabel}</h1>
    </div>
    <div style="padding: 24px;">
      <h2 style="font-size: 18px; color: #111827; margin: 0 0 8px;">${item.title || "Untitled"}</h2>
      <p style="color: #6b7280; font-size: 14px; margin: 0 0 16px;">
        <a href="${item.canonical_url}" style="color: #2563eb;">${item.canonical_url}</a>
      </p>
      <div style="background: #f3f4f6; border-radius: 6px; padding: 16px; margin-bottom: 16px;">
        <p style="font-size: 14px; color: #374151; margin: 0;">${classification.summary}</p>
      </div>
      ${keyPoints ? `<h3 style="font-size: 14px; color: #111827; margin: 0 0 8px;">Key Points</h3><ul style="font-size: 14px; color: #374151; padding-left: 20px; margin: 0 0 16px;">${keyPoints}</ul>` : ""}
      ${classification.recommended_action ? `<div style="border-left: 4px solid ${impactColor}; padding: 12px 16px; margin-bottom: 16px;"><p style="font-size: 14px; font-weight: 600; color: #111827; margin: 0 0 4px;">Recommended Action</p><p style="font-size: 14px; color: #374151; margin: 0;">${classification.recommended_action}</p></div>` : ""}
      <a href="${appUrl}/items/${item.id}" style="display: inline-block; background: #2563eb; color: white; text-decoration: none; padding: 10px 20px; border-radius: 6px; font-size: 14px; font-weight: 500;">View in RegWatch →</a>
    </div>
    <div style="background: #f3f4f6; padding: 16px 24px; border-top: 1px solid #e5e7eb;">
      <p style="font-size: 12px; color: #9ca3af; margin: 0;">RegWatch • Regulatory Intelligence Monitoring • <a href="${appUrl}/settings/notifications" style="color: #6b7280;">Manage notifications</a></p>
    </div>
  </div>
</body>
</html>`;
}

Deno.serve(async (req: Request) => {
  const body = await req.json().catch(() => ({}));
  const { item_id } = body;

  if (!item_id) return json({ error: "item_id is required" }, 400);

  const supabase = getServiceClient();
  const appUrl = Deno.env.get("NEXT_PUBLIC_APP_URL") || "https://regwatch.app";

  const { data: item } = await supabase
    .from("items")
    .select("*")
    .eq("id", item_id)
    .single();

  if (!item) return json({ error: "Item not found" }, 404);

  const { data: classifications } = await supabase
    .from("classifications")
    .select("*")
    .eq("item_id", item_id)
    .order("created_at", { ascending: false })
    .limit(1);

  const classification = classifications?.[0];
  if (!classification) return json({ error: "No classification found" }, 404);

  const { data: notifConfig } = await supabase
    .from("notifications_config")
    .select("*")
    .eq("workspace_id", item.workspace_id)
    .maybeSingle();

  if (!notifConfig?.email_enabled || !notifConfig?.email_level4_immediate) {
    return json({ skipped: true, reason: "Immediate email notifications disabled" });
  }

  const recipients: string[] = notifConfig.notify_emails || [];
  if (recipients.length === 0) {
    return json({ skipped: true, reason: "No recipient emails configured" });
  }

  try {
    const subject = `[RegWatch] Impact Level ${classification.impact_level} Alert: ${item.title?.slice(0, 60) || "New Item"}`;
    const html = buildEmailHtml(item, classification, appUrl);

    await sendEmailWithRetry(recipients, subject, html);

    await supabase.from("notification_log").insert({
      workspace_id: item.workspace_id,
      notification_type: "immediate",
      channel: "email",
      recipient: recipients.join(", "),
      subject,
      item_ids: [item_id],
      status: "sent",
    });

    await logEvent(supabase, item.workspace_id, "notification_sent", "item", item_id, {
      type: "immediate",
      recipients: recipients.length,
    });

    return json({ success: true, recipients: recipients.length });

  } catch (err) {
    await supabase.from("notification_log").insert({
      workspace_id: item.workspace_id,
      notification_type: "immediate",
      channel: "email",
      item_ids: [item_id],
      status: "failed",
      error: String(err),
    });

    return json({ error: String(err) }, 500);
  }
});
