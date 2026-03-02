interface Props {
  confidenceScore: number
  hasOverride?: boolean
}

export default function AIDisclaimer({ confidenceScore, hasOverride }: Props) {
  const isLowConfidence = confidenceScore < 65

  if (hasOverride) {
    return (
      <div className="flex items-start gap-3 px-4 py-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-800">
        <span className="text-base shrink-0 mt-0.5">⚠</span>
        <div>
          <span className="font-semibold">Human override applied.</span>
          {' '}The impact level shown reflects a manual classification that supersedes the AI assessment. This override is recorded in the audit trail for compliance purposes.
        </div>
      </div>
    )
  }

  if (isLowConfidence) {
    return (
      <div className="flex items-start gap-3 px-4 py-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-800">
        <span className="text-base shrink-0 mt-0.5">⚠</span>
        <div>
          <span className="font-semibold">Low AI confidence ({confidenceScore}%).</span>
          {' '}This classification may not be reliable. Human review is strongly recommended before taking any compliance action.
          Use the override panel to apply a manual classification.
        </div>
      </div>
    )
  }

  return (
    <div className="flex items-start gap-3 px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-600">
      <span className="text-base shrink-0 mt-0.5">🤖</span>
      <div>
        <span className="font-semibold">AI-generated classification</span>
        {' '}({confidenceScore}% confidence). Produced by GPT-4o-mini and mapped to ISO 27001:2022 and NIST CSF 2.0 frameworks.
        Review and override where necessary. Not a substitute for qualified legal or compliance advice.
      </div>
    </div>
  )
}
