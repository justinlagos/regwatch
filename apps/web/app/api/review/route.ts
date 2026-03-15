import { NextRequest, NextResponse } from 'next/server'
import { getServerClient } from '@/lib/supabase'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { item_id, status, notes = '', assigned_to = '', reviewed_by = '' } = body

    if (!item_id || !status) {
      return NextResponse.json({ error: 'item_id and status are required' }, { status: 400 })
    }

    if (!['reviewed', 'dismissed', 'escalated'].includes(status)) {
      return NextResponse.json({ error: 'Invalid status' }, { status: 400 })
    }

    const sb = getServerClient()

    const { data, error } = await sb
      .from('item_reviews')
      .upsert(
        {
          item_id,
          workspace_id: '00000000-0000-0000-0000-000000000001',
          status,
          notes,
          assigned_to,
          reviewed_by,
          reviewed_at: new Date().toISOString(),
        },
        { onConflict: 'item_id,workspace_id' }
      )
      .select()
      .single()

    if (error) {
      console.error('Review upsert error:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // v2: Write evidence record on triage decision
    await sb.from('evidence_records').insert({
      workspace_id: '00000000-0000-0000-0000-000000000001',
      action_type: 'signal_triaged',
      entity_type: 'item',
      entity_id: item_id,
      actor: reviewed_by || 'operator',
      metadata: { status, notes },
    }).then(() => {}, console.error)

    return NextResponse.json({ success: true, review: data })
  } catch (err) {
    console.error('Review route error:', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const item_id = searchParams.get('item_id')
    if (!item_id) return NextResponse.json({ error: 'item_id required' }, { status: 400 })

    const sb = getServerClient()
    await sb
      .from('item_reviews')
      .delete()
      .eq('item_id', item_id)
      .eq('workspace_id', '00000000-0000-0000-0000-000000000001')

    return NextResponse.json({ success: true })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
