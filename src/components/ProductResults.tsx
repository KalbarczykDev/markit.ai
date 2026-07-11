import { Card, Drawer, Link, Meter } from '@heroui/react'
import { useEffect, useState } from 'react'

import type { ProductAnalysis, ProductCardData } from '@/product-types'

const RELIABILITY_COLOR = {
  strong: 'accent',
  moderate: 'default',
  limited: 'warning',
} as const

function useIsMobile(): boolean {
  const [isMobile, setIsMobile] = useState(false)

  useEffect(() => {
    const media = window.matchMedia('(max-width: 899px)')
    const update = () => setIsMobile(media.matches)
    update()
    media.addEventListener('change', update)
    return () => media.removeEventListener('change', update)
  }, [])

  return isMobile
}

function AnalysisChecks({ analysis }: { analysis: ProductAnalysis | undefined }) {
  if (!analysis) {
    return (
      <div className="product-analysis" data-state="pending" role="status">
        <span>Independent checks</span>
        <small>Auditing listing…</small>
      </div>
    )
  }

  if (analysis.status === 'failed') {
    return (
      <div className="product-analysis" data-state="failed">
        <span>Independent checks</span>
        <small>Unavailable for this listing</small>
      </div>
    )
  }

  return (
    <div className="product-analysis" data-state="complete" title={analysis.summary}>
      <span>Independent checks</span>
      <ul aria-label={`Independent listing checks by ${analysis.model}`}>
        {analysis.checks.map((check) => (
          <li
            key={check.id}
            data-verdict={check.verdict}
            title={`${check.verdict}: ${check.note}`}
            aria-label={`${check.label} check ${check.verdict}. ${check.note}`}
          >
            {check.label}
          </li>
        ))}
      </ul>
    </div>
  )
}

function ProductCards({
  products,
  analyses,
}: {
  products: ProductCardData[]
  analyses: Record<string, ProductAnalysis>
}) {
  return (
    <div className="product-card-list">
      {products.map((product, index) => (
        <Card className="product-card" key={`${product.url}-${index}`}>
          <div className="product-image product-image-fallback" aria-hidden="true">
            {product.favicon ? (
              <img src={product.favicon} alt="" />
            ) : (
              <span>{product.source.slice(0, 1).toUpperCase()}</span>
            )}
            {product.image ? (
              <img
                className="product-image-photo"
                src={product.image}
                alt=""
                loading="lazy"
                referrerPolicy="no-referrer"
                onError={(event) => {
                  event.currentTarget.hidden = true
                }}
              />
            ) : null}
          </div>
          <div className="product-card-copy">
            <Card.Header className="product-card-header">
              <div className="product-source-row">
                <span>{product.source}</span>
                {product.price ? <strong>{product.price}</strong> : null}
              </div>
              <Card.Title className="product-title">{product.title}</Card.Title>
              {product.highlights[0] ? (
                <Card.Description className="product-description">
                  {product.highlights[0]}
                </Card.Description>
              ) : null}
            </Card.Header>
            <Card.Content className="product-offer-details">
              <div data-verified={Boolean(product.discount)}>
                <span>Discount</span>
                <p>{product.discount || 'No verified discount found'}</p>
              </div>
              <div data-verified={Boolean(product.shipping)}>
                <span>Delivery</span>
                <p>{product.shipping || 'Cost not found in source'}</p>
              </div>
            </Card.Content>
            <AnalysisChecks analysis={analyses[product.url]} />
            <Card.Footer className="product-footer">
              <div
                className="seller-reliability"
                title={product.sellerReliability.basis.join(' • ')}
              >
                <Meter
                  value={product.sellerReliability.score}
                  color={RELIABILITY_COLOR[product.sellerReliability.label]}
                  aria-label="Seller reliability"
                >
                  <div className="seller-reliability-row">
                    <span>Seller reliability</span>
                    <Meter.Output>{product.sellerReliability.score}/100</Meter.Output>
                  </div>
                  <Meter.Track>
                    <Meter.Fill />
                  </Meter.Track>
                  <small>{product.sellerReliability.label} evidence score</small>
                </Meter>
              </div>
              <Link
                href={product.url}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={`View ${product.title} at ${product.source}`}
              >
                View product
                <Link.Icon aria-hidden="true" />
              </Link>
            </Card.Footer>
          </div>
        </Card>
      ))}
    </div>
  )
}

export function ProductResults({
  isOpen,
  heading,
  products,
  analyses,
}: {
  isOpen: boolean
  heading: string
  products: ProductCardData[]
  analyses: Record<string, ProductAnalysis>
}) {
  const isMobile = useIsMobile()
  const hasProducts = isOpen && products.length > 0

  return (
    <>
      <aside className="desktop-product-panel" data-open={hasProducts} aria-hidden={!hasProducts}>
        <div className="product-panel-heading">
          <div>
            <span>Live commerce data</span>
            <h2>{heading}</h2>
          </div>
          <small>{products.length} results</small>
        </div>
        <ProductCards products={products} analyses={analyses} />
      </aside>

      {isMobile ? (
        <Drawer.Backdrop isOpen={hasProducts} isDismissable={false}>
          <Drawer.Content placement="bottom">
            <Drawer.Dialog className="product-drawer">
              <Drawer.Handle />
              <Drawer.Header className="product-drawer-header">
                <span>Live commerce data</span>
                <Drawer.Heading>{heading}</Drawer.Heading>
              </Drawer.Header>
              <Drawer.Body className="product-drawer-body">
                <ProductCards products={products} analyses={analyses} />
              </Drawer.Body>
            </Drawer.Dialog>
          </Drawer.Content>
        </Drawer.Backdrop>
      ) : null}
    </>
  )
}
