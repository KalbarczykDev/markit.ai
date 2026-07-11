import { Button, Card, Chip, Disclosure, Drawer, Link, Meter } from '@heroui/react'
import { useEffect, useState } from 'react'

import { downloadCsv } from '@/csv'
import type {
  ProductAnalysis,
  ProductCardData,
  ProductSortMode,
  ProductViewMode,
} from '@/product-types'

const RELIABILITY_COLOR = {
  strong: 'accent',
  moderate: 'default',
  limited: 'warning',
} as const

function formatListedDate(published: string | undefined): string | null {
  if (!published) return null
  const date = new Date(published)
  if (Number.isNaN(date.getTime())) return null
  return new Intl.DateTimeFormat('en', { dateStyle: 'medium' }).format(date)
}

function ProductDetails({
  product,
  analysis,
}: {
  product: ProductCardData
  analysis: ProductAnalysis | undefined
}) {
  const listedDate = formatListedDate(product.publishedDate)
  const hasChecks = analysis?.status === 'complete' && analysis.checks.length > 0

  return (
    <Disclosure className="product-details">
      <Disclosure.Heading className="product-details-heading">
        <Disclosure.Trigger className="product-details-trigger">
          View details
          <Disclosure.Indicator />
        </Disclosure.Trigger>
      </Disclosure.Heading>
      <Disclosure.Content>
        <Disclosure.Body className="product-details-body">
          {product.highlights.length > 0 ? (
            <section>
              <span className="product-details-kicker">Highlights</span>
              <ul className="product-highlight-list">
                {product.highlights.map((highlight) => (
                  <li key={highlight}>{highlight}</li>
                ))}
              </ul>
            </section>
          ) : null}

          {hasChecks ? (
            <section>
              <span className="product-details-kicker">Independent checks · {analysis.model}</span>
              {analysis.summary ? (
                <p className="product-details-summary">{analysis.summary}</p>
              ) : null}
              <ul className="product-check-list">
                {analysis.checks.map((check) => (
                  <li key={check.id} data-verdict={check.verdict}>
                    <strong>{check.label}</strong>
                    <span>{check.note}</span>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          {product.sellerReliability.basis.length > 0 ? (
            <section>
              <span className="product-details-kicker">Reliability evidence</span>
              <ul className="product-evidence-list">
                {product.sellerReliability.basis.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </section>
          ) : null}

          {listedDate ? <p className="product-details-meta">Listed {listedDate}</p> : null}
        </Disclosure.Body>
      </Disclosure.Content>
    </Disclosure>
  )
}

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
  savedUrls,
  view,
}: {
  products: ProductCardData[]
  analyses: Record<string, ProductAnalysis>
  savedUrls: ReadonlySet<string>
  view: Exclude<ProductViewMode, 'table'>
}) {
  return (
    <div className="product-card-list" data-view={view}>
      {products.map((product, index) => (
        <Card className="product-card" data-top-pick={index === 0 || undefined} key={product.url}>
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
                <div className="product-source-meta">
                  {index === 0 ? (
                    <Chip color="accent" variant="soft" size="sm" className="product-top-pick">
                      Top pick
                    </Chip>
                  ) : null}
                  {savedUrls.has(product.url) ? (
                    <Chip
                      color="success"
                      variant="soft"
                      size="sm"
                      className="product-saved-indicator"
                    >
                      <span aria-hidden="true">✓</span> Saved
                    </Chip>
                  ) : null}
                </div>
              </div>
              <Card.Title className="product-title">{product.title}</Card.Title>
              {product.price || product.discount ? (
                <div className="product-price-row">
                  {product.price ? (
                    <strong className="product-price">{product.price}</strong>
                  ) : null}
                  {product.discount ? (
                    <Chip
                      size="sm"
                      variant="soft"
                      color="accent"
                      className="product-discount-chip"
                      title={product.discount}
                    >
                      {product.discount}
                    </Chip>
                  ) : null}
                </div>
              ) : null}
              {product.highlights[0] ? (
                <Card.Description className="product-description">
                  {product.highlights[0]}
                </Card.Description>
              ) : null}
            </Card.Header>
            <Card.Content className="product-offer-details">
              <div data-verified={Boolean(product.shipping)}>
                <span>Delivery</span>
                <p>{product.shipping || 'Cost not found in source'}</p>
              </div>
            </Card.Content>
            <AnalysisChecks analysis={analyses[product.url]} />
            <ProductDetails product={product} analysis={analyses[product.url]} />
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

const SORT_LABELS: Record<ProductSortMode, string> = {
  relevance: 'Relevance',
  price_asc: 'Price: low to high',
  price_desc: 'Price: high to low',
  reliability_desc: 'Seller reliability',
}

function saveProductsCsv(products: ProductCardData[]) {
  downloadCsv(
    'markit-listings.csv',
    ['Product', 'Price', 'Currency', 'Delivery', 'Reliability', 'Retailer', 'URL'],
    products.map((product) => [
      product.title,
      product.price,
      product.priceCurrency,
      product.shipping,
      product.sellerReliability.score,
      product.source,
      product.url,
    ]),
  )
}

function ProductTable({
  products,
  savedUrls,
}: {
  products: ProductCardData[]
  savedUrls: ReadonlySet<string>
}) {
  return (
    <div className="product-table-wrap">
      <table className="product-table">
        <thead>
          <tr>
            <th scope="col">Product</th>
            <th scope="col">Price</th>
            <th scope="col">Delivery</th>
            <th scope="col">Reliability</th>
            <th scope="col">Retailer</th>
          </tr>
        </thead>
        <tbody>
          {products.map((product, index) => (
            <tr data-top-pick={index === 0 || undefined} key={product.url}>
              <th scope="row">
                <div className="product-table-name">
                  {product.image ? <img src={product.image} alt="" loading="lazy" /> : null}
                  <span>
                    <strong>{product.title}</strong>
                    {index === 0 ? (
                      <small className="product-top-pick-label">Top pick</small>
                    ) : null}
                    {savedUrls.has(product.url) ? <small>✓ Saved</small> : null}
                  </span>
                </div>
              </th>
              <td>{product.price || 'Not verified'}</td>
              <td>{product.shipping || 'Not verified'}</td>
              <td>
                <strong>{product.sellerReliability.score}/100</strong>
                <small>{product.sellerReliability.label}</small>
              </td>
              <td>
                <Link href={product.url} target="_blank" rel="noopener noreferrer">
                  {product.source}
                  <Link.Icon aria-hidden="true" />
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function ProductPresentation({
  products,
  analyses,
  savedUrls,
  view,
  sort,
  onSaveListings,
  saveState,
}: {
  products: ProductCardData[]
  analyses: Record<string, ProductAnalysis>
  savedUrls: ReadonlySet<string>
  view: ProductViewMode
  sort: ProductSortMode
  onSaveListings: () => void
  saveState: 'idle' | 'saving' | 'saved' | 'error'
}) {
  return (
    <div className="product-arrangement" key={`${view}-${sort}`}>
      {view === 'table' ? (
        <>
          <div className="product-table-actions">
            <span role="status" aria-live="polite">
              {saveState === 'saved'
                ? 'Saved under Account → Saved listings'
                : saveState === 'error'
                  ? 'Could not save listings. Log in and try again.'
                  : ''}
            </span>
            <Button size="sm" variant="ghost" onPress={() => saveProductsCsv(products)}>
              Save CSV
            </Button>
            <Button size="sm" isDisabled={saveState === 'saving'} onPress={onSaveListings}>
              {saveState === 'saving' ? 'Saving…' : 'Save to listings'}
            </Button>
          </div>
          <ProductTable products={products} savedUrls={savedUrls} />
        </>
      ) : (
        <ProductCards products={products} analyses={analyses} savedUrls={savedUrls} view={view} />
      )}
    </div>
  )
}

export function ProductResults({
  isOpen,
  heading,
  products,
  analyses,
  savedUrls,
  view,
  sort,
}: {
  isOpen: boolean
  heading: string
  products: ProductCardData[]
  analyses: Record<string, ProductAnalysis>
  savedUrls: ReadonlySet<string>
  view: ProductViewMode
  sort: ProductSortMode
}) {
  const isMobile = useIsMobile()
  const hasProducts = isOpen && products.length > 0
  const [locallySavedUrls, setLocallySavedUrls] = useState<ReadonlySet<string>>(new Set())
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const allSavedUrls = new Set([...savedUrls, ...locallySavedUrls])

  useEffect(() => setSaveState('idle'), [products])

  const saveToListings = async () => {
    setSaveState('saving')
    try {
      const response = await fetch('/api/listings', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ products }),
      })
      if (!response.ok) throw new Error('Unable to save listings')
      const body = (await response.json()) as { listings: Array<{ url: string }> }
      setLocallySavedUrls((current) => {
        const updated = new Set(current)
        for (const listing of body.listings) updated.add(listing.url)
        return updated
      })
      setSaveState('saved')
    } catch {
      setSaveState('error')
    }
  }

  return (
    <>
      <aside className="desktop-product-panel" data-open={hasProducts} aria-hidden={!hasProducts}>
        <div className="product-panel-heading">
          <div>
            <span>Live commerce data</span>
            <h2>{heading}</h2>
          </div>
          <small>
            {view} · {SORT_LABELS[sort]} · {products.length} results
          </small>
        </div>
        <ProductPresentation
          products={products}
          analyses={analyses}
          savedUrls={allSavedUrls}
          view={view}
          sort={sort}
          onSaveListings={() => void saveToListings()}
          saveState={saveState}
        />
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
                <ProductPresentation
                  products={products}
                  analyses={analyses}
                  savedUrls={allSavedUrls}
                  view={view}
                  sort={sort}
                  onSaveListings={() => void saveToListings()}
                  saveState={saveState}
                />
              </Drawer.Body>
            </Drawer.Dialog>
          </Drawer.Content>
        </Drawer.Backdrop>
      ) : null}
    </>
  )
}
