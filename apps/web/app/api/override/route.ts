import { NextRequest, NextResponse } from 'next/server'
import { getServerClient } from '@/lib/supabase'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { item_id, override_level, override_reason, overridden_by } = body

    if (!item_id || !override_level || !overridden_by) {
      return NextResponse.json({ error: 'item_id, override_level, and overridden_by are required' }, { status: 400 })
    }
    if (!['1','2','3','4'].includes(override_level)) {
      return NextResponse.json({ error: 'Invalid override_level' }, { status: 400 })
    }

    const sb = getServerClient()

    // Fetch the current classification
    const { data: cls } = await sb
      .from('classifications')
      .select('id, impact_level, confidence_score')
      .eq('item_id', item_id)
      .order('created_at', { ascending: false })
      .limit(1)
      .single()

    if (!cls) {
      return NextResponse.json({ error: 'No classification found for this item' }, { status: 404 })
    }

    const oldLevel = cls.impact_level

    // Update the classification with override fields
    const { error: updateErr } = await sb
      .from('classifications')
      .update({
        override_level,
        override_reason: override_reason || '',
        overridden_by,
        overridden_at: new Date().toISOString(),
      })
      .eq('id', cls.id)

    if (updateErr) {
      return NextResponse.json({ error: updateErr.message }, { status: 500 })
    }

    // Write to audit log
    await sb.from('audit_log').insert({
      item_id,
      workspace_id: '00000000-0000-0000-0000-000000000001',
      action: 'overridden',
      actor: overridden_by,
      old_value: { impact_level: oldLevel, confidence_score: cls.confidence_score },
      new_value: { impact_level: override_level, overridden: true },
      notes: override_reason || '',
    })

    return NextResponse.json({ success: true, old_level: oldLevel, new_level: override_level })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const item_id = searchParams.get('item_id')
    const actor   = searchParams.get('actor') || 'system'
    if (!item_id) return NextResponse.json({ error: 'item_id required' }, { status: 400 })

    const sb = getServerClient()

    const { data: cls } = await sb
      .from('classifications')
      .select('id, override_level, impact_level')
      .eq('item_id', item_id)
      .order('created_at', { ascending: false })
      .limit(1)
      .single()

    if (!cls) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    await sb.from('classifications').update({
      override_level: null,
      override_reason: '',
      overridden_by: '',
      overridden_at: null,
    }).eq('id', cls.id)

    await sb.from('audit_log').insert({
      item_id,
      workspace_id: '00000000-0000-0000-0000-000000000001',
      action: 'override_removed',
      actor,
      old_value: { override_level: cls.override_level },
      new_value: { impact_level: cls.impact_level },
      notes: 'Override cleared, reverted to AI classification',
    })

    return NextResponse.json({ success: true })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
