'use client'

interface Props {
  score: number
  size?: 'sm' | 'md' | 'lg'
  showBar?: boolean
}

function getConfig(score: number) {
  if (score >= 85) return { label: 'High Confidence', color: 'text-emerald-700', bg: 'bg-emerald-50', bar: 'bg-emerald-500', border: 'border-emerald-200', dot: '●' }
  if (score >= 65) return { label: 'Medium Confidence', color: 'text-amber-700', bg: 'bg-amber-50', bar: 'bg-amber-400', border: 'border-amber-200', dot: '◐' }
  return { label: 'Low Confidence', color: 'text-red-700', bg: 'bg-red-50', bar: 'bg-red-400', border: 'border-red-200', dot: '○' }
}

export default function ConfidenceBadge({ score, size = 'md', showBar = false }: Props) {
  const cfg = getConfig(score)

  if (size === 'sm') {
    return (
      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border ${cfg.bg} ${cfg.color} ${cfg.border}`}>
        <span className="text-[10px]">{cfg.dot}</span>
        {score}%
      </span>
    )
  }

  if (size === 'lg' || showBar) {
    return (
      <div className={`rounded-lg border p-3 ${cfg.bg} ${cfg.border}`}>
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <span className={`text-sm font-semibold ${cfg.color}`}>{cfg.label}</span>
          </div>
          <span className={`text-lg font-black ${cfg.color}`}>{score}%</span>
        </div>
        <div className="w-full bg-white rounded-full h-2 overflow-hidden border border-white/50">
          <div
            className={`h-2 rounded-full transition-all duration-700 ${cfg.bar}`}
            style={{ width: `${score}%` }}
          />
        </div>
        <p className={`text-xs mt-1.5 ${cfg.color} opacity-70`}>
          {score >= 85
            ? 'AI classification is highly reliable for this item'
            : score >= 65
            ? 'Review recommended before taking compliance action'
            : 'Human review required — low AI confidence'}
        </p>
      </div>
    )
  }

  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold border ${cfg.bg} ${cfg.color} ${cfg.border}`}>
      <span className="text-[11px]">{cfg.dot}</span>
      {score}% confidence
    </span>
  )
}
