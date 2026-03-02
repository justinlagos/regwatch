import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { Resend } from 'https://esm.sh/resend@2'

const sb = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
)
const resend = new Resend(Deno.env.get('RESEND_API_KEY')!)
const APP_URL = Deno.env.get('NEXT_PUBLIC_APP_URL') || 'https://regwatch-xi.vercel.app'

Deno.serve(async (req) => {
  // Allow cron invocation or manual POST
  const weekAgo = new Date()
  weekAgo.setDate(weekAgo.getDate() - 7)

  // Fetch L3+L4 items from last 7 days
  const { data: items } = await sb
    .from('items')
    .select('id, title, detected_at, sources(name), classifications(impact_level, summary, confidence_score, iso_clauses, nist_controls)')
    .eq('state', 'classified')
    .gte('detected_at', weekAgo.toISOString())
    .order('detected_at', { ascending: false })

  const high = (items || []).filter((i: any) => ['3','4'].includes(i.classifications?.[0]?.impact_level))
  const l4 = high.filter((i: any) => i.classifications?.[0]?.impact_level === '4')
  const l3 = high.filter((i: any) => i.classifications?.[0]?.impact_level === '3')

  // Get workspace email
  const { data: ws } = await sb.from('workspaces').select('notification_email').single()
  const to = ws?.notification_email
  if (!to) return new Response('No notification email configured', { status: 400 })

  const dateRange = `${weekAgo.toLocaleDateString('en-GB', { day:'numeric', month:'short' })} – ${new Date().toLocaleDateString('en-GB', { day:'numeric', month:'short', year:'numeric' })}`

  function itemRow(item: any) {
    const cls = item.classifications?.[0]
    const lvl = cls?.impact_level
    const badge = lvl === '4' ? '#dc2626' : '#d97706'
    return `
    <tr style="border-bottom:1px solid #f1f5f9;">
      <td style="padding:12px 16px;width:60px;text-align:center;">
        <span style="display:inline-flex;align-items:center;justify-content:center;width:32px;height:32px;border-radius:50%;background:${badge}20;color:${badge};font-size:11px;font-weight:700;">L${lvl}</span>
      </td>
      <td style="padding:12px 16px;">
        <a href="${APP_URL}/items/${item.id}" style="color:#1e293b;font-weight:600;text-decoration:none;font-size:14px;">${item.title || 'Untitled'}</a>
        ${cls?.summary ? `<p style="margin:4px 0 0;color:#64748b;font-size:12px;line-height:1.5;">${cls.summary.slice(0,140)}${cls.summary.length > 140 ? '…' : ''}</p>` : ''}
        <p style="margin:4px 0 0;color:#94a3b8;font-size:11px;">${(item.sources as any)?.name} · ${new Date(item.detected_at).toLocaleDateString('en-GB',{day:'numeric',month:'short'})}</p>
      </td>
    </tr>`
  }

  const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <div style="max-width:600px;margin:32px auto;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,.1);">
    <!-- Header -->
    <div style="background:#0f172a;padding:28px 32px;">
      <p style="margin:0;color:#94a3b8;font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:.08em;">RegWatch Weekly Digest</p>
      <h1 style="margin:6px 0 0;color:#fff;font-size:22px;font-weight:700;">${dateRange}</h1>
    </div>
    <!-- Summary bar -->
    <div style="display:flex;border-bottom:1px solid #f1f5f9;padding:20px 32px;gap:32px;">
      <div>
        <p style="margin:0;font-size:28px;font-weight:800;color:#dc2626;">${l4.length}</p>
        <p style="margin:4px 0 0;font-size:12px;color:#64748b;">Critical (L4)</p>
      </div>
      <div>
        <p style="margin:0;font-size:28px;font-weight:800;color:#d97706;">${l3.length}</p>
        <p style="margin:4px 0 0;font-size:12px;color:#64748b;">High (L3)</p>
      </div>
      <div>
        <p style="margin:0;font-size:28px;font-weight:800;color:#475569;">${(items||[]).length}</p>
        <p style="margin:4px 0 0;font-size:12px;color:#64748b;">Total this week</p>
      </div>
    </div>

    ${l4.length > 0 ? `
    <!-- L4 Section -->
    <div style="padding:20px 32px 0;">
      <p style="margin:0 0 12px;font-size:13px;font-weight:700;color:#dc2626;text-transform:uppercase;letter-spacing:.06em;">⚠ Critical — L4</p>
    </div>
    <table style="width:100%;border-collapse:collapse;">${l4.map(itemRow).join('')}</table>
    ` : ''}

    ${l3.length > 0 ? `
    <!-- L3 Section -->
    <div style="padding:20px 32px 0;">
      <p style="margin:0 0 12px;font-size:13px;font-weight:700;color:#d97706;text-transform:uppercase;letter-spacing:.06em;">High — L3</p>
    </div>
    <table style="width:100%;border-collapse:collapse;">${l3.map(itemRow).join('')}</table>
    ` : ''}

    ${high.length === 0 ? `
    <div style="padding:40px 32px;text-align:center;">
      <p style="font-size:32px;margin:0;">✅</p>
      <p style="color:#64748b;font-size:14px;margin:12px 0 0;">No high-impact items this week.</p>
    </div>
    ` : ''}

    <!-- Footer -->
    <div style="padding:24px 32px;background:#f8fafc;border-top:1px solid #f1f5f9;text-align:center;">
      <a href="${APP_URL}" style="display:inline-block;background:#0f172a;color:#fff;text-decoration:none;padding:10px 24px;border-radius:8px;font-size:13px;font-weight:600;">Open RegWatch →</a>
      <p style="margin:16px 0 0;color:#94a3b8;font-size:11px;">RegWatch · AI classifications require human review · <a href="${APP_URL}/review" style="color:#94a3b8;">Review queue</a></p>
    </div>
  </div>
</body></html>`

  await resend.emails.send({
    from: 'RegWatch <onboarding@resend.dev>',
    to,
    subject: `RegWatch Weekly: ${l4.length} critical, ${l3.length} high — ${dateRange}`,
    html,
  })

  return new Response(JSON.stringify({ sent: true, to, l4: l4.length, l3: l3.length }), {
    headers: { 'Content-Type': 'application/json' },
  })
})
