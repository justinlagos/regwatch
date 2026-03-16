'use client'

import { useEffect, useState } from 'react'

type Tab = 'notifications' | 'watchlists'
interface WatchlistTerm { id: string; term: string; match_type: string }
interface Watchlist { id: string; name: string; description: string | null; watchlist_terms: WatchlistTerm[] }
interface Settings { notification_email: string; slack_webhook_url: string; slack_notify_l4: boolean; slack_notify_l3: boolean }

export default function SettingsPage() {
  const [tab, setTab] = useState<Tab>('notifications')
  return (
    <div className="space-y-6 max-w-3xl">
      <div><h1 className="rw-page-title">Settings</h1><p className="rw-page-subtitle">Workspace configuration</p></div>
      <div className="flex gap-1 p-1 rounded-xl" style={{ background: '#eef0f4' }}>
        {(['notifications', 'watchlists'] as Tab[]).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`flex-1 text-[12px] font-semibold py-2.5 px-4 rounded-lg transition-all capitalize ${tab === t ? 'bg-white shadow-sm' : 'hover:bg-white/50'}`}
            style={tab === t ? { color: '#0f1121' } : { color: '#6b7194' }}>
            {t}
          </button>
        ))}
      </div>
      {tab === 'notifications' && <NotificationsTab />}
      {tab === 'watchlists' && <WatchlistsTab />}
    </div>
  )
}

function NotificationsTab() {
  const [settings, setSettings] = useState<Settings>({ notification_email: '', slack_webhook_url: '', slack_notify_l4: true, slack_notify_l3: false })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => { fetch('/api/settings').then(r => r.json()).then(d => { setSettings(s => ({ ...s, ...d })); setLoading(false) }) }, [])

  async function save() { setSaving(true); setSaved(false); await fetch('/api/settings', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(settings) }); setSaving(false); setSaved(true); setTimeout(() => setSaved(false), 3000) }

  if (loading) return <div className="space-y-4 animate-pulse">{[1,2,3].map(i => <div key={i} className="h-24 rounded-xl" style={{ background: '#eef0f4' }} />)}</div>

  return (
    <div className="space-y-4">
      <div className="rw-card p-6 space-y-4">
        <div><h2 className="text-[13px] font-semibold" style={{ color: '#0f1121' }}>Email Notifications</h2><p className="text-[11px] mt-0.5" style={{ color: '#8b90a5' }}>Weekly digest and L4 alerts are sent to this address</p></div>
        <div><label className="rw-label">Notification Email</label><input type="email" value={settings.notification_email} onChange={e => setSettings(s => ({ ...s, notification_email: e.target.value }))} placeholder="you@company.com" className="rw-input" /></div>
      </div>

      <div className="rw-card p-6 space-y-4">
        <div><h2 className="text-[13px] font-semibold" style={{ color: '#0f1121' }}>Slack Integration</h2><p className="text-[11px] mt-0.5" style={{ color: '#8b90a5' }}>Post alerts to a Slack channel via incoming webhook</p></div>
        <div><label className="rw-label">Webhook URL</label><input type="url" value={settings.slack_webhook_url} onChange={e => setSettings(s => ({ ...s, slack_webhook_url: e.target.value }))} placeholder="https://hooks.slack.com/services/…" className="rw-input" /></div>
        <div className="space-y-3">
          <label className="flex items-center gap-3 cursor-pointer">
            <input type="checkbox" checked={settings.slack_notify_l4} onChange={e => setSettings(s => ({ ...s, slack_notify_l4: e.target.checked }))} className="w-4 h-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500" />
            <div><span className="text-[13px] font-medium" style={{ color: '#1a1d2e' }}>Notify on L4 — Critical</span><p className="text-[11px]" style={{ color: '#8b90a5' }}>Send a Slack message for every new critical item</p></div>
          </label>
          <label className="flex items-center gap-3 cursor-pointer">
            <input type="checkbox" checked={settings.slack_notify_l3} onChange={e => setSettings(s => ({ ...s, slack_notify_l3: e.target.checked }))} className="w-4 h-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500" />
            <div><span className="text-[13px] font-medium" style={{ color: '#1a1d2e' }}>Notify on L3 — High</span><p className="text-[11px]" style={{ color: '#8b90a5' }}>Send a Slack message for every new high-impact item</p></div>
          </label>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <button onClick={save} disabled={saving} className="rw-btn-primary px-6 py-2.5">{saving ? 'Saving…' : 'Save Settings'}</button>
        {saved && <span className="text-[12px] text-emerald-600 font-semibold">Saved</span>}
      </div>
    </div>
  )
}

function WatchlistsTab() {
  const [watchlists, setWatchlists] = useState<Watchlist[]>([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [newName, setNewName] = useState('')
  const [newDesc, setNewDesc] = useState('')
  const [newTerms, setNewTerms] = useState('')
  const [addingTermTo, setAddingTermTo] = useState<string | null>(null)
  const [termInput, setTermInput] = useState('')

  useEffect(() => { loadWatchlists() }, [])

  async function loadWatchlists() { const res = await fetch('/api/watchlists'); setWatchlists(await res.json()); setLoading(false) }

  async function createWatchlist(e: React.FormEvent) {
    e.preventDefault(); if (!newName.trim()) return; setCreating(true)
    const terms = newTerms.split(',').map(t => t.trim()).filter(Boolean)
    await fetch('/api/watchlists', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: newName.trim(), description: newDesc.trim() || null, terms }) })
    setNewName(''); setNewDesc(''); setNewTerms(''); setCreating(false); loadWatchlists()
  }

  async function deleteWatchlist(id: string) { await fetch(`/api/watchlists?id=${id}`, { method: 'DELETE' }); loadWatchlists() }
  async function addTerm(watchlistId: string) { if (!termInput.trim()) return; await fetch('/api/watchlists/terms', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ watchlist_id: watchlistId, term: termInput.trim() }) }); setTermInput(''); setAddingTermTo(null); loadWatchlists() }
  async function deleteTerm(termId: string) { await fetch(`/api/watchlists/terms?id=${termId}`, { method: 'DELETE' }); loadWatchlists() }

  if (loading) return <div className="space-y-4 animate-pulse">{[1,2,3].map(i => <div key={i} className="h-20 rounded-xl" style={{ background: '#eef0f4' }} />)}</div>

  return (
    <div className="space-y-4">
      <form onSubmit={createWatchlist} className="rw-card p-6 space-y-4">
        <h2 className="text-[13px] font-semibold" style={{ color: '#0f1121' }}>Create Watchlist</h2>
        <div className="grid sm:grid-cols-2 gap-3">
          <div><label className="rw-label">Name</label><input type="text" value={newName} onChange={e => setNewName(e.target.value)} placeholder="e.g. CBN Directives" className="rw-input" /></div>
          <div><label className="rw-label">Description</label><input type="text" value={newDesc} onChange={e => setNewDesc(e.target.value)} placeholder="What this watchlist tracks" className="rw-input" /></div>
        </div>
        <div><label className="rw-label">Initial Terms (comma-separated)</label><input type="text" value={newTerms} onChange={e => setNewTerms(e.target.value)} placeholder="CBN, central bank, monetary policy" className="rw-input" /></div>
        <button type="submit" disabled={creating || !newName.trim()} className="rw-btn-primary">{creating ? 'Creating…' : 'Create Watchlist'}</button>
      </form>

      {watchlists.length === 0 && <div className="text-center py-14 text-[13px]" style={{ color: '#8b90a5' }}>No watchlists yet. Create one above.</div>}

      {watchlists.map(wl => (
        <div key={wl.id} className="rw-card overflow-hidden">
          <div className="rw-card-header">
            <div>
              <h3 className="text-[13px] font-semibold" style={{ color: '#0f1121' }}>{wl.name}</h3>
              {wl.description && <p className="text-[11px] mt-0.5" style={{ color: '#8b90a5' }}>{wl.description}</p>}
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[11px]" style={{ color: '#8b90a5' }}>{wl.watchlist_terms.length} terms</span>
              <button onClick={() => deleteWatchlist(wl.id)} className="text-[11px] text-red-500 hover:text-red-700 font-semibold">Delete</button>
            </div>
          </div>
          <div className="px-5 py-3.5">
            <div className="flex flex-wrap gap-1.5">
              {wl.watchlist_terms.map(t => (
                <span key={t.id} className="inline-flex items-center gap-1 text-[11px] font-medium px-2.5 py-1 rounded-full" style={{ background: '#f4f6fa', color: '#3a3f56' }}>
                  {t.term}
                  <button onClick={() => deleteTerm(t.id)} className="hover:text-red-500 ml-0.5" style={{ color: '#8b90a5' }}>&times;</button>
                </span>
              ))}
              {addingTermTo === wl.id ? (
                <span className="inline-flex items-center gap-1">
                  <input type="text" value={termInput} onChange={e => setTermInput(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addTerm(wl.id) } if (e.key === 'Escape') setAddingTermTo(null) }}
                    autoFocus placeholder="New term…" className="rw-input w-28 text-[11px] py-1 px-2" />
                  <button onClick={() => addTerm(wl.id)} className="text-[11px] text-indigo-600 font-semibold">Add</button>
                  <button onClick={() => setAddingTermTo(null)} className="text-[11px]" style={{ color: '#8b90a5' }}>Cancel</button>
                </span>
              ) : (
                <button onClick={() => { setAddingTermTo(wl.id); setTermInput('') }} className="text-[11px] text-indigo-600 hover:text-indigo-800 font-semibold px-2.5 py-1">+ Add term</button>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}
