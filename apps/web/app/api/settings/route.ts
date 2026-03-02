import { getServerClient } from '@/lib/supabase'
import { NextRequest, NextResponse } from 'next/server'

const WS = '00000000-0000-0000-0000-000000000001'

export async function GET() {
  const sb = getServerClient()
  const { data } = await sb
    .from('workspaces')
    .select('notification_email, slack_webhook_url, slack_notify_l4, slack_notify_l3')
    .eq('id', WS)
    .single()
  return NextResponse.json(data || {})
}

export async function PATCH(req: NextRequest) {
  const sb = getServerClient()
  const body = await req.json()
  const allowed = ['notification_email', 'slack_webhook_url', 'slack_notify_l4', 'slack_notify_l3']
  const update = Object.fromEntries(Object.entries(body).filter(([k]) => allowed.includes(k)))

  const { data, error } = await sb
    .from('workspaces')
    .update(update)
    .eq('id', WS)
    .select().single()

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json(data)
}
