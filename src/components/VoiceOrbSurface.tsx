import { Button } from '@heroui/react'
import type { RefObject } from 'react'

import type {
  ProductAnalysis,
  ProductCardData,
  ProductSortMode,
  ProductViewMode,
} from '@/product-types'

import { MicrophoneMuteButton } from './MicrophoneMuteButton'
import { ProductResults } from './ProductResults'
import type { OrbState } from './VoiceStatus'
import { VoiceStatus } from './VoiceStatus'

type VoiceOrbSurfaceProps = {
  orbRef: RefObject<HTMLButtonElement | null>
  state: OrbState
  isMuted: boolean
  onStart: () => void
  onToggleMute: () => void
  productDisplay: {
    isOpen: boolean
    heading: string
    products: ProductCardData[]
    view: ProductViewMode
    sort: ProductSortMode
  }
  analyses: Record<string, ProductAnalysis>
  savedUrls: ReadonlySet<string>
}

export function VoiceOrbSurface({
  orbRef,
  state,
  isMuted,
  onStart,
  onToggleMute,
  productDisplay,
  analyses,
  savedUrls,
}: VoiceOrbSurfaceProps) {
  const label =
    state === 'idle'
      ? 'Start voice conversation'
      : state === 'error'
        ? 'Voice unavailable. Try again'
        : 'End voice conversation'

  return (
    <div className={`commerce-agent ${productDisplay.isOpen ? 'has-products' : ''}`}>
      <div className="voice-agent">
        <Button
          ref={orbRef}
          type="button"
          isIconOnly
          variant="ghost"
          className="voice-orb"
          data-state={state}
          aria-label={label}
          title={label}
          onPress={onStart}
        >
          <span className="orb-halo" />
          <span className="orb-shell">
            <span className="orb-core" />
            <span className="orb-wave" />
          </span>
        </Button>
        <div className="voice-controls">
          <VoiceStatus state={state} />
          {state !== 'idle' ? (
            <MicrophoneMuteButton isMuted={isMuted} onToggle={onToggleMute} />
          ) : null}
        </div>
      </div>
      <ProductResults
        isOpen={productDisplay.isOpen}
        heading={productDisplay.heading}
        products={productDisplay.products}
        analyses={analyses}
        savedUrls={savedUrls}
        view={productDisplay.view}
        sort={productDisplay.sort}
      />
    </div>
  )
}
