import { getServerClient } from '@/lib/supabase'
import { NextResponse } from 'next/server'

/**
 * POST /api/seed-v2
 *
 * App-level seed for v2 tables. Queries the first workspace dynamically
 * instead of hardcoding a UUID. Safe to run multiple times (idempotent).
 *
 * Only runs in development or when ALLOW_SEED=true.
 */
export async function POST() {
  if (
    process.env.NODE_ENV === 'production' &&
    process.env.ALLOW_SEED !== 'true'
  ) {
    return NextResponse.json(
      { error: 'Seed disabled in production. Set ALLOW_SEED=true to override.' },
      { status: 403 }
    )
  }

  const sb = getServerClient()

  // 1. Get the first workspace
  const { data: ws, error: wsErr } = await sb
    .from('workspaces')
    .select('id')
    .order('created_at', { ascending: true })
    .limit(1)
    .single()

  if (wsErr || !ws) {
    return NextResponse.json(
      { error: 'No workspace found. Create one first.' },
      { status: 400 }
    )
  }

  const wsId = ws.id
  const results: Record<string, string> = {}

  // 2. Seed watchlists (if none exist)
  const { count: wlCount } = await sb
    .from('watchlists')
    .select('*', { count: 'exact', head: true })
    .eq('workspace_id', wsId)

  if (!wlCount || wlCount === 0) {
    const { data: wl } = await sb
      .from('watchlists')
      .insert([
        { workspace_id: wsId, name: 'CBN Directives', description: 'Central Bank of Nigeria circulars, directives, and guidelines' },
        { workspace_id: wsId, name: 'NDPC & Data Protection', description: 'Nigeria Data Protection Commission rules and enforcement actions' },
        { workspace_id: wsId, name: 'Cybersecurity Threats', description: 'Threat intel relevant to financial services in West Africa' },
      ])
      .select()

    if (wl) {
      // Seed terms for each watchlist
      const termsByName: Record<string, string[]> = {
        'CBN Directives': ['CBN', 'central bank of nigeria', 'monetary policy', 'prudential guideline', 'banking supervision'],
        'NDPC & Data Protection': ['NDPC', 'data protection', 'NDPR', 'privacy regulation', 'data breach notification'],
        'Cybersecurity Threats': ['ransomware', 'phishing', 'APT', 'vulnerability disclosure', 'zero-day'],
      }

      for (const w of wl) {
        const terms = termsByName[w.name] || []
        if (terms.length > 0) {
          await sb.from('watchlist_terms').insert(
            terms.map(t => ({ watchlist_id: w.id, term: t, match_type: 'keyword' }))
          )
        }
      }
      results.watchlists = `Created ${wl.length} watchlists with terms`
    }
  } else {
    results.watchlists = 'Already seeded'
  }

  // 3. Seed control keywords & regulations for existing controls
  const { data: controls } = await sb
    .from('internal_controls')
    .select('id, name, ref')
    .eq('workspace_id', wsId)

  if (controls && controls.length > 0) {
    const { count: kwCount } = await sb
      .from('control_keywords')
      .select('*', { count: 'exact', head: true })

    if (!kwCount || kwCount === 0) {
      const keywordMap: Record<string, string[]> = {
        'AML': ['anti-money laundering', 'KYC', 'suspicious transaction', 'customer due diligence'],
        'INFO-SEC': ['information security', 'cybersecurity', 'data breach', 'access control', 'encryption'],
        'DATA-PROT': ['data protection', 'privacy', 'personal data', 'consent', 'NDPR'],
        'BCP': ['business continuity', 'disaster recovery', 'incident response', 'resilience'],
        'OUTSOURCE': ['outsourcing', 'third party', 'vendor management', 'service provider'],
      }

      for (const ctrl of controls) {
        const keywords = keywordMap[ctrl.ref] || [ctrl.name.toLowerCase()]
        await sb.from('control_keywords').insert(
          keywords.map(k => ({ control_id: ctrl.id, keyword: k }))
        )
      }
      results.control_keywords = `Seeded keywords for ${controls.length} controls`
    } else {
      results.control_keywords = 'Already seeded'
    }
  }

  // 4. Update existing controls with new v2 fields if still default
  if (controls && controls.length > 0) {
    const v2Defaults: Record<string, { type: string; owner_name: string; review_cycle: string; departments: string[] }> = {
      'AML': { type: 'control_process', owner_name: 'Compliance Officer', review_cycle: '6 months', departments: ['compliance', 'operations'] },
      'INFO-SEC': { type: 'policy', owner_name: 'CISO', review_cycle: '12 months', departments: ['IT', 'security'] },
      'DATA-PROT': { type: 'policy', owner_name: 'Data Protection Officer', review_cycle: '12 months', departments: ['legal', 'IT'] },
      'BCP': { type: 'procedure', owner_name: 'COO', review_cycle: '12 months', departments: ['operations', 'IT'] },
      'OUTSOURCE': { type: 'control_process', owner_name: 'Vendor Manager', review_cycle: '12 months', departments: ['procurement', 'legal'] },
    }

    for (const ctrl of controls) {
      const defaults = v2Defaults[ctrl.ref]
      if (defaults) {
        await sb
          .from('internal_controls')
          .update({
            type: defaults.type,
            owner_name: defaults.owner_name,
            review_cycle: defaults.review_cycle,
            departments: defaults.departments,
            updated_at: new Date().toISOString(),
          })
          .eq('id', ctrl.id)
      }
    }
    results.controls_updated = `Updated v2 fields for ${controls.length} controls`
  }

  return NextResponse.json({
    workspace_id: wsId,
    results,
    seeded_at: new Date().toISOString(),
  })
}
