'use client'

import { useEffect, useState } from 'react'

// ─── Tab type ─────────────────────────────────────────────
type Tab = 'notifications' | 'watchlists'

// ─── Watchlist types ──────────────────────────────────────
interface WatchlistTerm { id: string; term: string; match_type: string }
interface Watchlist { id: string; name: string; description: string | null; watchlist_terms: WatchlistTerm[] }

// ─── Notifications types ──────────────────────────────────
interface Settings {
  notification_email: string
  slack_webhook_url: string
  slack_notify_l4: boolean
  slack_notify_l3: boolean
}

export default function SettingsPage() {
  const [tab, setTab] = useState<Tab>('notifications')

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-slate-900">Settings</h1>
        <p className="text-slate-500 text-sm mt-1">Workspace configuration</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 rounded-lg p-0.5">
        {(['notifications', 'watchlists'] as Tab[]).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`flex-1 text-sm font-medium py-2 px-4 rounded-md transition-colors capitalize ${
              tab === t ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
            }`}>
            {t}
          </button>
        ))}
      </div>

      {tab === 'notifications' && <NotificationsTab />}
      {tab === 'watchlists' && <WatchlistsTab />}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════
// Notifications Tab (ported from v1)
// ═══════════════════════════════════════════════════════════
function NotificationsTab() {
  const [settings, setSettings] = useState<Settings>({ notification_email:'', slack_webhook_url:'', slack_notify_l4:true, slack_notify_l3:false })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    fetch('/api/settings').then(r=>r.json()).then(d=>{ setSettings(s=>({...s,...d})); setLoading(false) })
  }, [])

  async function save() {
    setSaving(true); setSaved(false)
    await fetch('/api/settings', { method:'PATCH', headers:{'Content-Type':'application/json'}, body: JSON.stringify(settings) })
    setSaving(false); setSaved(true); setTimeout(()=>setSaved(false), 3000)
  }

  if (loading) return <div className="space-y-4 animate-pulse">{[1,2,3].map(i=><div key={i} className="h-24 bg-gray-100 rounded-xl"/>)}</div>

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm space-y-4">
        <div>
          <h2 className="font-semibold text-slate-800">Email Notifications</h2>
          <p className="text-xs text-slate-400 mt-0.5">Weekly digest and L4 alerts are sent to this address</p>
        </div>
        <div>
          <label className="block text-xs font-semibold text-slate-600 mb-1.5">Notification Email</label>
          <input type="email" value={settings.notification_email}
            onChange={e=>setSettings(s=>({...s,notification_email:e.target.value}))}
            placeholder="you@company.com"
            className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 text-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-400" />
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm space-y-4">
        <div>
          <h2 className="font-semibold text-slate-800">Slack Integration</h2>
          <p className="text-xs text-slate-400 mt-0.5">Post alerts to a Slack channel via incoming webhook</p>
        </div>
        <div>
          <label className="block text-xs font-semibold text-slate-600 mb-1.5">Webhook URL</label>
          <input type="url" value={settings.slack_webhook_url}
            onChange={e=>setSettings(s=>({...s,slack_webhook_url:e.target.value}))}
            placeholder="https://hooks.slack.com/services/…"
            className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 text-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-400" />
        </div>
        <div className="space-y-2">
          <label className="flex items-center gap-3 cursor-pointer">
            <input type="checkbox" checked={settings.slack_notify_l4}
              onChange={e=>setSettings(s=>({...s,slack_notify_l4:e.target.checked}))}
              className="w-4 h-4 rounded border-gray-300 text-slate-800 focus:ring-slate-400" />
            <div>
              <span className="text-sm font-medium text-slate-700">Notify on L4 — Critical</span>
              <p className="text-xs text-slate-400">Send a Slack message for every new critical item</p>
            </div>
          </label>
          <label className="flex items-center gap-3 cursor-pointer">
            <input type="checkbox" checked={settings.slack_notify_l3}
              onChange={e=>setSettings(s=>({...s,slack_notify_l3:e.target.checked}))}
              className="w-4 h-4 rounded border-gray-300 text-slate-800 focus:ring-slate-400" />
            <div>
              <span className="text-sm font-medium text-slate-700">Notify on L3 — High</span>
              <p className="text-xs text-slate-400">Send a Slack message for every new high-impact item</p>
            </div>
          </label>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <button onClick={save} disabled={saving}
          className="px-6 py-2.5 bg-slate-800 text-white text-sm font-medium rounded-lg hover:bg-slate-700 disabled:opacity-50 transition-colors">
          {saving ? 'Saving…' : 'Save Settings'}
        </button>
        {saved && <span className="text-sm text-emerald-600 font-medium">Saved</span>}
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════
// Watchlists Tab — CRUD for watchlists + terms
// ═══════════════════════════════════════════════════════════
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

  async function loadWatchlists() {
    const res = await fetch('/api/watchlists')
    const data = await res.json()
    setWatchlists(data)
    setLoading(false)
  }

  async function createWatchlist(e: React.FormEvent) {
    e.preventDefault()
    if (!newName.trim()) return
    setCreating(true)
    const terms = newTerms.split(',').map(t => t.trim()).filter(Boolean)
    await fetch('/api/watchlists', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: newName.trim(), description: newDesc.trim() || null, terms }),
    })
    setNewName(''); setNewDesc(''); setNewTerms(''); setCreating(false)
    loadWatchlists()
  }

  async function deleteWatchlist(id: string) {
    await fetch(`/api/watchlists?id=${id}`, { method: 'DELETE' })
    loadWatchlists()
  }

  async function addTerm(watchlistId: string) {
    if (!termInput.trim()) return
    await fetch('/api/watchlists/terms', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ watchlist_id: watchlistId, term: termInput.trim() }),
    })
    setTermInput(''); setAddingTermTo(null)
    loadWatchlists()
  }

  async function deleteTerm(termId: string) {
    await fetch(`/api/watchlists/terms?id=${termId}`, { method: 'DELETE' })
    loadWatchlists()
  }

  if (loading) return <div className="space-y-4 animate-pulse">{[1,2,3].map(i=><div key={i} className="h-20 bg-gray-100 rounded-xl"/>)}</div>

  return (
    <div className="space-y-6">
      {/* Create form */}
      <form onSubmit={createWatchlist} className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm space-y-4">
        <h2 className="font-semibold text-slate-800">Create Watchlist</h2>
        <div className="grid sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">Name</label>
            <input type="text" value={newName} onChange={e => setNewName(e.target.value)}
              placeholder="e.g. CBN Directives"
              className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 text-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-400" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">Description</label>
            <input type="text" value={newDesc} onChange={e => setNewDesc(e.target.value)}
              placeholder="What this watchlist tracks"
              className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 text-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-400" />
          </div>
        </div>
        <div>
          <label className="block text-xs font-semibold text-slate-600 mb-1">Initial Terms (comma-separated)</label>
          <input type="text" value={newTerms} onChange={e => setNewTerms(e.target.value)}
            placeholder="CBN, central bank, monetary policy"
            className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 text-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-400" />
        </div>
        <button type="submit" disabled={creating || !newName.trim()}
          className="px-5 py-2 bg-slate-800 text-white text-sm font-medium rounded-lg hover:bg-slate-700 disabled:opacity-50 transition-colors">
          {creating ? 'Creating…' : 'Create Watchlist'}
        </button>
      </form>

      {watchlists.length === 0 && (
        <div className="text-center py-12 text-gray-400 text-sm">No watchlists yet. Create one above.</div>
      )}

      {watchlists.map(wl => (
        <div key={wl.id} className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
            <div>
              <h3 className="font-semibold text-slate-800">{wl.name}</h3>
              {wl.description && <p className="text-xs text-slate-400 mt-0.5">{wl.description}</p>}
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-400">{wl.watchlist_terms.length} terms</span>
              <button onClick={() => deleteWatchlist(wl.id)}
                className="text-xs text-red-500 hover:text-red-700 font-medium">Delete</button>
            </div>
          </div>
          <div className="px-6 py-3">
            <div className="flex flex-wrap gap-2">
              {wl.watchlist_terms.map(t => (
                <span key={t.id} className="inline-flex items-center gap-1 bg-slate-100 text-slate-700 text-xs font-medium px-2.5 py-1 rounded-full">
                  {t.term}
                  <button onClick={() => deleteTerm(t.id)} className="text-slate-400 hover:text-red-500 ml-0.5">&times;</button>
                </span>
              ))}
              {addingTermTo === wl.id ? (
                <span className="inline-flex items-center gap-1">
                  <input type="text" value={termInput} onChange={e => setTermInput(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addTerm(wl.id) } if (e.key === 'Escape') setAddingTermTo(null) }}
                    autoFocus placeholder="New term…"
                    className="text-xs border border-gray-300 rounded-lg px-2 py-1 w-32 focus:outline-none focus:ring-2 focus:ring-slate-400" />
                  <button onClick={() => addTerm(wl.id)} className="text-xs text-blue-600 font-medium">Add</button>
                  <button onClick={() => setAddingTermTo(null)} className="text-xs text-slate-400">Cancel</button>
                </span>
              ) : (
                <button onClick={() => { setAddingTermTo(wl.id); setTermInput('') }}
                  className="text-xs text-blue-600 hover:text-blue-800 font-medium px-2 py-1">+ Add term</button>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}
