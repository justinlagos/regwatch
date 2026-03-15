/**
 * StatsCard — number + label card used in stat strips.
 */

interface Props {
  label: string
  value: number | string
  color?: string
  bg?: string
}

export default function StatsCard({ label, value, color = 'text-slate-800', bg = 'bg-white border-gray-200' }: Props) {
  return (
    <div className={`rounded-xl border p-4 ${bg}`}>
      <p className="text-xs text-gray-500 leading-tight">{label}</p>
      <p className={`text-2xl font-bold mt-1 ${color}`}>
        {typeof value === 'number' ? value.toLocaleString() : value}
      </p>
    </div>
  )
}
