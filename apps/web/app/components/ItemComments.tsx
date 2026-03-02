'use client'

import { useEffect, useState } from 'react'

interface Comment { id: string; author: string; body: string; created_at: string }

export default function ItemComments({ itemId }: { itemId: string }) {
  const [comments, setComments] = useState<Comment[]>([])
  const [loading, setLoading] = useState(true)
  const [author, setAuthor] = useState('')
  const [body, setBody] = useState('')
  const [saving, setSaving] = useState(false)

  async function load() {
    const res = await fetch(`/api/comments?item_id=${itemId}`)
    setComments(await res.json())
    setLoading(false)
  }

  useEffect(() => { load() }, [itemId])

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!author.trim() || !body.trim()) return
    setSaving(true)
    await fetch('/api/comments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ item_id: itemId, author, body }),
    })
    setBody('')
    await load()
    setSaving(false)
  }

  async function remove(id: string) {
    await fetch(`/api/comments?id=${id}`, { method: 'DELETE' })
    setComments(c => c.filter(x => x.id !== id))
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
      <h3 className="font-semibold text-slate-800 mb-4">Comments
        {comments.length > 0 && <span className="ml-2 text-xs font-normal text-slate-400">{comments.length}</span>}
      </h3>

      {/* Thread */}
      {loading ? (
        <div className="space-y-3">{[1,2].map(i => <div key={i} className="animate-pulse h-14 bg-gray-100 rounded-lg" />)}</div>
      ) : comments.length === 0 ? (
        <p className="text-sm text-slate-400 mb-4">No comments yet.</p>
      ) : (
        <div className="space-y-3 mb-4">
          {comments.map(c => (
            <div key={c.id} className="flex gap-3 group">
              <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center text-xs font-bold text-slate-600 shrink-0">
                {c.author[0].toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-baseline gap-2">
                  <span className="text-sm font-semibold text-slate-700">{c.author}</span>
                  <span className="text-xs text-slate-400">
                    {new Date(c.created_at).toLocaleDateString('en-GB', { day:'numeric', month:'short', hour:'2-digit', minute:'2-digit' })}
                  </span>
                  <button onClick={() => remove(c.id)}
                    className="ml-auto text-xs text-slate-200 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all">✕</button>
                </div>
                <p className="text-sm text-slate-600 mt-0.5 leading-relaxed">{c.body}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* New comment form */}
      <form onSubmit={submit} className="space-y-2 border-t border-gray-100 pt-4">
        <input value={author} onChange={e => setAuthor(e.target.value)} placeholder="Your name"
          className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 text-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-300 bg-gray-50" />
        <div className="flex gap-2">
          <textarea value={body} onChange={e => setBody(e.target.value)} placeholder="Add a comment…" rows={2}
            className="flex-1 text-sm border border-gray-200 rounded-lg px-3 py-2 text-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-300 bg-gray-50 resize-none" />
          <button type="submit" disabled={saving || !author.trim() || !body.trim()}
            className="px-4 py-2 bg-slate-800 text-white text-sm font-medium rounded-lg hover:bg-slate-700 disabled:opacity-40 transition-colors self-end">
            {saving ? '…' : 'Post'}
          </button>
        </div>
      </form>
    </div>
  )
}
