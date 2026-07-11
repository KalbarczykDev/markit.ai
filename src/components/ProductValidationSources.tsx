import { ArrowUpRightFromSquare } from '@gravity-ui/icons'
import { Link } from '@heroui/react'

import type { ProductAnalysis } from '@/product-types'

const DECISION_LABELS = {
  ask_user: 'Needs information',
  reject: 'Rejected',
  present_match: 'Eligible match',
  wait_and_monitor: 'Wait and monitor',
  propose_alternatives: 'Eligible alternative',
} as const

export function ProductValidationSources({ analysis }: { analysis: ProductAnalysis }) {
  return (
    <div className="product-validation-sources">
      {analysis.decision ? (
        <p data-decision={analysis.decision}>
          <strong>{DECISION_LABELS[analysis.decision]}</strong>
          {analysis.decisionReason ? ` · ${analysis.decisionReason}` : ''}
        </p>
      ) : null}
      {analysis.allInCost?.reliable && analysis.allInCost.value !== null ? (
        <p>
          <strong>Verified all-in cost</strong> · {analysis.allInCost.value}{' '}
          {analysis.allInCost.currency}
        </p>
      ) : null}
      {analysis.sources?.length ? <span>Validation sources</span> : null}
      {analysis.sources?.map((source) => (
        <Link key={source.url} href={source.url} target="_blank" rel="noopener noreferrer">
          {source.title}
          <ArrowUpRightFromSquare aria-hidden="true" />
        </Link>
      ))}
    </div>
  )
}
