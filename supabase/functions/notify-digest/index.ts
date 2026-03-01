import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { getServiceClient, json, logEvent } from "../_shared/supabase.ts";

const IMPACT_LABELS: Record<string, string> = { "1": "Informational", "2": "Low", "3": "Medium", "4": "High" };
const IMPACT_COLORS: Record<string, string> = { "1": "#6b7280", "2": "#2563eb", "3": "#d97706", "4": "#dc2626" };

async function sendEmail(to: string[], subject: string, html: string): Promise<void> {
  const resp = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${Deno.env.get("RESEND_API_KEY")}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ from: Deno.env.get("RESEND_FROM_EMAIL"), to, subject, html }),
  });
  if (!resp.ok) throw new Error(`Resend error ${resp.status}: ${await resp.text()}`);
}

function buildDigestHtml(
  items: Array<{ item: Record<string, unknown>; classification: Record<string, unknown> }>,
  appUrl: string,
  periodLabel: string
): string {
  const rows = items
    .map(({ item, classification }) => {
      const level = classification.impact_level as string;
      return `
      <tr>
        <td style="padding: 12px 16px; border-bottom: 1px solid #e5e7eb; vertical-align: top;">
          <span style="display: inline-block; padding: 2px 8px; border-radius: 9999px; font-size: 11px; font-weight: 600; background: ${IMPACT_COLORS[level]}1a; color: ${IMPACT_COLORS[level]};">
            L${level} ${IMPACT_LABELS[level]}
          </span>
        </td>
        <td style="padding: 12px 16px; border-bottom: 1px solid #e5e7eb; vertical-align: top;">
          <a href="${appUrl}/items/${item.id}" style="color: #111827; font-weight: 500; font-size: 14px; text-decoration: none;">${item.title || "Untitled"}</a>
          <p style="color: #6b7280; font-size: 13px; margin: 4px 0 0;">${classification.summary || ""}</p>
        </td>
        <td style="padding: 12px 16px; border-bottom: 1px solid #e5e7eb; vertical-align: top; font-size: 13px; color: #6b7280; white-space: nowrap;">
          ${item.detected_at ? new Date(item.detected_at as string).toLocaleDateString() : ""}
        </td>
      </tr>`;
    })
    .join("");

  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 700px; margin: 0 auto; padding: 24px; background: #f9fafb;">
  <div style="background: white; border-radius: 8px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
    <div style="background: #1e293b; padding: 20px 24px;">
      <p style="color: #94a3b8; margin: 0; font-size: 12px; text-transform: uppercase; letter-spacing: 0.05em;">RegWatch</p>
      <h1 style="color: white; margin: 4px 0 0; font-size: 22px;">Regulatory Intelligence Digest</h1>
      <p style="color: #94a3b8; margin: 4px 0 0; font-size: 14px;">${periodLabel} · ${items.length} item${items.length !== 1 ? "s" : ""}</p>
    </div>
    <div style="padding: 0;">
      <table style="width: 100%; border-collapse: collapse;">
        <thead>
          <tr style="background: #f8fafc;">
            <th style="padding: 10px 16px; text-align: left; font-size: 12px; color: #6b7280; font-weight: 600; text-transform: uppercase; border-bottom: 1px solid #e5e7eb; width: 120px;">Impact</th>
            <th style="padding: 10px 16px; text-align: left; font-size: 12px; color: #6b7280; font-weight: 600; text-transform: uppercase; border-bottom: 1px solid #e5e7eb;">Item</th>
            <th style="padding: 10px 16px; text-align: left; font-size: 12px; color: #6b7280; font-weight: 600; text-transform: uppercase; border-bottom: 1px solid #e5e7eb; width: 100px;">Date</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
    <div style="padding: 20px 24px; border-top: 1px solid #e5e7eb; display: flex; align-items: center; justify-content: space-between;">
      <a href="${appUrl}" style="display: inline-block; background: #2563eb; color: white; text-decoration: none; padding: 10px 20px; border-radius: 6px; font-size: 14px; font-weight: 500;">Open RegWatch →</a>
      <p style="font-size: 12px; color: #9ca3af; margin: 0;"><a href="${appUrl}/settings/notifications" style="color: #6b7280;">Manage notifications</a></p>
    </div>
  </div>
</body>
</html>`;
}

Deno.serve(async (req: Request) => {
  const supabase = getServiceClient();
  const appUrl = Deno.env.get("NEXT_PUBLIC_APP_URL") || "https://regwatch.app";

  // Get all workspaces with digest enabled
  const { data: configs } = await supabase
    .from("notifications_config")
    .select("*")
    .eq("email_digest_enabled", true)
    .eq("email_enabled", true);

  if (!configs || configs.length === 0) {
    return json({ message: "No workspaces with digest enabled", sent: 0 });
  }

  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  let totalSent = 0;

  for (const config of configs) {
    if (!config.notify_emails?.length) continue;

    const minLevel = config.email_digest_min_level || "2";

    // Get new items from the past week above min level
    const { data: items } = await supabase
      .from("items")
      .select("*")
      .eq("workspace_id", config.workspace_id)
      .eq("state", "classified")
      .gte("detected_at", weekAgo)
      .order("detected_at", { ascending: false });

    if (!items || items.length === 0) continue;

    // Fetch classifications and filter by impact level
    const itemsWithClassification: Array<{ item: Record<string, unknown>; classification: Record<string, unknown> }> = [];

    for (const item of items) {
      const { data: cls } = await supabase
        .from("classifications")
        .select("*")
        .eq("item_id", item.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (cls && parseInt(cls.impact_level) >= parseInt(minLevel)) {
        itemsWithClassification.push({ item, classification: cls });
      }
    }

    if (itemsWithClassification.length === 0) continue;

    // Sort by impact level desc
    itemsWithClassification.sort((a, b) =>
      parseInt(b.classification.impact_level as string) - parseInt(a.classification.impact_level as string)
    );

    try {
      const periodLabel = `Week of ${new Date(weekAgo).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}`;
      const subject = `RegWatch Weekly Digest: ${itemsWithClassification.length} regulatory item${itemsWithClassification.length !== 1 ? "s" : ""}`;
      const html = buildDigestHtml(itemsWithClassification, appUrl, periodLabel);

      await sendEmail(config.notify_emails, subject, html);

      await supabase.from("notification_log").insert({
        workspace_id: config.workspace_id,
        notification_type: "digest",
        channel: "email",
        recipient: config.notify_emails.join(", "),
        subject,
        item_ids: itemsWithClassification.map(({ item }) => item.id),
        status: "sent",
      });

      await logEvent(supabase, config.workspace_id, "digest_sent", "notifications_config", config.id, {
        item_count: itemsWithClassification.length,
      });

      totalSent++;
    } catch (err) {
      console.error(`Digest failed for workspace ${config.workspace_id}:`, err);
      await supabase.from("notification_log").insert({
        workspace_id: config.workspace_id,
        notification_type: "digest",
        channel: "email",
        status: "failed",
        error: String(err),
      });
    }
  }

  return json({ sent: totalSent, workspaces_processed: configs.length });
});
