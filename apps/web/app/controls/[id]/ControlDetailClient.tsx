'use client'

import { useState } from 'react'

interface Keyword { id: string; keyword: string }
interface Regulation { id: string; regulation_name: string; section_ref: string | null }

interface Props {
  controlId: string
  initialKeywords: Keyword[]
  initialRegulations: Regulation[]
}

export default function ControlDetailClient({ controlId, initialKeywords, initialRegulations }: Props) {
  const [keywords, setKeywords] = useState<Keyword[]>(initialKeywords)
  const [regulations, setRegulations] = useState<Regulation[]>(initialRegulations)
  const [newKw, setNewKw] = useState('')
  const [newRegName, setNewRegName] = useState('')
  const [newRegRef, setNewRegRef] = useState('')

  async function addKeyword() {
    if (!newKw.trim()) return
    const res = await fetch('/api/controls/keywords', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ control_id: controlId, keyword: newKw.trim() }),
    })
    if (res.ok) {
      const data = await res.json()
      setKeywords([...keywords, data])
      setNewKw('')
    }
  }

  async function deleteKeyword(id: string) {
    await fetch(`/api/controls/keywords?id=${id}`, { method: 'DELETE' })
    setKeywords(keywords.filter(k => k.id !== id))
  }

  async function addRegulation() {
    if (!newRegName.trim()) return
    const res = await fetch('/api/controls/regulations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ control_id: controlId, regulation_name: newRegName.trim(), section_ref: newRegRef.trim() || null }),
    })
    if (res.ok) {
      const data = await res.json()
      setRegulations([...regulations, data])
      setNewRegName(''); setNewRegRef('')
    }
  }

  async function deleteRegulation(id: string) {
    await fetch(`/api/controls/regulations?id=${id}`, { method: 'DELETE' })
    setRegulations(regulations.filter(r => r.id !== id))
  }

  return (
    <div className="grid sm:grid-cols-2 gap-4">
      {/* Keywords panel */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100">
          <h2 className="font-semibold text-slate-800">Keywords</h2>
          <p className="text-xs text-slate-400 mt-0.5">Used for automatic signal matching</p>
        </div>
        <div className="px-6 py-4 space-y-3">
          <div className="flex flex-wrap gap-2">
            {keywords.map(k => (
              <span key={k.id} className="inline-flex items-center gap-1 bg-blue-50 text-blue-700 text-xs font-medium px-2.5 py-1 rounded-full">
                {k.keyword}
                <button onClick={() => deleteKeyword(k.id)} className="text-blue-400 hover:text-red-500 ml-0.5">&times;</button>
              </span>
            ))}
            {keywords.length === 0 && <p className="text-xs text-slate-400">No keywords yet</p>}
          </div>
          <div className="flex gap-2 pt-2 border-t border-gray-100">
            <input type="text" value={newKw} onChange={e => setNewKw(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addKeyword() } }}
              placeholder="Add keyword…"
              className="flex-1 text-xs border border-gray-300 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-slate-400" />
            <button onClick={addKeyword} disabled={!newKw.trim()}
              className="text-xs bg-slate-800 text-white px-3 py-1.5 rounded-lg hover:bg-slate-700 disabled:opacity-50 transition-colors">
              Add
            </button>
          </div>
        </div>
      </div>

      {/* Regulations panel */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100">
          <h2 className="font-semibold text-slate-800">Regulations</h2>
          <p className="text-xs text-slate-400 mt-0.5">Regulatory references this control addresses</p>
        </div>
        <div className="px-6 py-4 space-y-3">
          {regulations.length === 0 ? (
            <p className="text-xs text-slate-400">No regulations linked yet</p>
          ) : (
            <div className="space-y-2">
              {regulations.map(r => (
                <div key={r.id} className="flex items-center justify-between bg-gray-50 rounded-lg px-3 py-2">
                  <div>
                    <p className="text-xs font-medium text-slate-700">{r.regulation_name}</p>
                    {r.section_ref && <p className="text-[10px] text-slate-400">{r.section_ref}</p>}
                  </div>
                  <button onClick={() => deleteRegulation(r.id)} className="text-xs text-red-400 hover:text-red-600">&times;</button>
                </div>
              ))}
            </div>
          )}
          <div className="flex gap-2 pt-2 border-t border-gray-100">
            <input type="text" value={newRegName} onChange={e => setNewRegName(e.target.value)}
              placeholder="Regulation name"
              className="flex-1 text-xs border border-gray-300 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-slate-400" />
            <input type="text" value={newRegRef} onChange={e => setNewRegRef(e.target.value)}
              placeholder="Section ref"
              className="w-24 text-xs border border-gray-300 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-slate-400" />
            <button onClick={addRegulation} disabled={!newRegName.trim()}
              className="text-xs bg-slate-800 text-white px-3 py-1.5 rounded-lg hover:bg-slate-700 disabled:opacity-50 transition-colors">
              Add
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
