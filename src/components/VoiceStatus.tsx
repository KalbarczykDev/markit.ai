import { Spinner } from '@heroui/react'

export type OrbState =
  | 'idle'
  | 'connecting'
  | 'listening'
  | 'thinking'
  | 'searching'
  | 'speaking'
  | 'search-error'
  | 'error'

const STATUS_LABELS: Record<OrbState, string> = {
  idle: 'Tap to talk',
  connecting: 'Connecting',
  listening: 'Listening',
  thinking: 'Checking product data',
  searching: 'Researching products',
  speaking: 'Speaking',
  'search-error': 'Search unavailable',
  error: 'Connection unavailable',
}

export function VoiceStatus({ state }: { state: OrbState }) {
  const isPending = state === 'connecting' || state === 'thinking' || state === 'searching'

  return (
    <div className="agent-status" data-state={state} role="status" aria-live="polite">
      {isPending ? <Spinner size="sm" color="current" /> : <span className="agent-status-dot" />}
      <span>{STATUS_LABELS[state]}</span>
    </div>
  )
}
