'use client'

import { useEffect, useState } from 'react'

interface Settings {
  notification_email: string
  slack_webhook_url: string
  slack_notify_l4: boolean
  slack_notify_l3: boolean
}

export default function SettingsPage() {
  const [settings, setSettings] = useState<Settings>({ notification_email:'', slack_webhook_url:'', slack_notify_l4:true, slack_notify_l3:false })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [testing, setTesting] = useState(false)
  const [saved, setSaved] = useState(false)
  const [testResult, setTestResult] = useState<'ok'|'err'|null>(null)

  useEffect(() => {
    fetch('/api/settings').then(r=>r.json()).then(d=>{ setSettings(s=>({...s,...d})); setLoading(false) })
  }, [])

  async function save() {
    setSaving(true); setSaved(false)
    await fetch('/api/settings', { method:'PATCH', headers:{'Content-Type':'application/json'}, body: JSON.stringify(settings) })
    setSaving(false); setSaved(true); setTimeout(()=>setSaved(false), 3000)
  }

  async function testSlack() {
    if (!settings.slack_webhook_url) return
    setTesting(true); setTestResult(null)
    try {
      const res = await fetch(settings.slack_webhook_url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: '✅ RegWatch Slack integration is working!' }),
      })
      setTestResult(res.ok ? 'ok' : 'err')
    } catch { setTestResult('err') }
    setTesting(false)
  }

  if (loading) return (
    <div className="space-y-4 animate-pulse">
      {[1,2,3].map(i=><div key={i} className="h-24 bg-gray-100 rounded-xl"/>)}
    </div>
  )

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-slate-900">Settings</h1>
        <p className="text-slate-500 text-sm mt-1">Notification preferences and integrations</p>
      </div>

      {/* Email */}
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

      {/* Slack */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm space-y-4">
        <div>
          <h2 className="font-semibold text-slate-800">Slack Integration</h2>
          <p className="text-xs text-slate-400 mt-0.5">Post alerts to a Slack channel via incoming webhook</p>
        </div>
        <div>
          <label className="block text-xs font-semibold text-slate-600 mb-1.5">Webhook URL</label>
          <div className="flex gap-2">
            <input type="url" value={settings.slack_webhook_url}
              onChange={e=>setSettings(s=>({...s,slack_webhook_url:e.target.value}))}
              placeholder="https://hooks.slack.com/services/…"
              className="flex-1 text-sm border border-gray-300 rounded-lg px-3 py-2 text-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-400" />
            {settings.slack_webhook_url && (
              <button onClick={testSlack} disabled={testing}
                className="px-3 py-2 border border-gray-300 text-sm text-slate-600 rounded-lg hover:bg-gray-50 disabled:opacity-50 whitespace-nowrap transition-colors">
                {testing ? 'Testing…' : 'Test'}
              </button>
            )}
          </div>
          {testResult === 'ok' && <p className="text-xs text-emerald-600 mt-1.5">✓ Test message sent successfully</p>}
          {testResult === 'err' && <p className="text-xs text-red-500 mt-1.5">✕ Could not reach webhook — check the URL</p>}
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
        <div className="bg-slate-50 rounded-lg p-3 border border-slate-100">
          <p className="text-xs text-slate-500">
            <span className="font-semibold">How to get a webhook URL:</span> In Slack, go to{' '}
            <span className="font-mono">api.slack.com/apps</span> → Create App → Incoming Webhooks → Activate → Add to channel.
          </p>
        </div>
      </div>

      {/* Save */}
      <div className="flex items-center gap-3">
        <button onClick={save} disabled={saving}
          className="px-6 py-2.5 bg-slate-800 text-white text-sm font-medium rounded-lg hover:bg-slate-700 disabled:opacity-50 transition-colors">
          {saving ? 'Saving…' : 'Save Settings'}
        </button>
        {saved && <span className="text-sm text-emerald-600 font-medium">✓ Saved</span>}
      </div>
    </div>
  )
}
