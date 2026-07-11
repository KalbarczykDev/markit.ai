import { Card, Drawer, Link } from '@heroui/react'
import { useEffect, useState } from 'react'

import type { ProductCardData } from '@/product-types'

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

function ProductCards({ products }: { products: ProductCardData[] }) {
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
            <Card.Footer className="product-footer">
              <div
                className="seller-reliability"
                data-level={product.sellerReliability.label}
                title={product.sellerReliability.basis.join(' • ')}
              >
                <div className="seller-reliability-row">
                  <span>Seller reliability</span>
                  <strong>{product.sellerReliability.score}/100</strong>
                </div>
                <div className="seller-reliability-track" aria-hidden="true">
                  <i style={{ width: `${product.sellerReliability.score}%` }} />
                </div>
                <small>{product.sellerReliability.label} evidence score</small>
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
}: {
  isOpen: boolean
  heading: string
  products: ProductCardData[]
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
        <ProductCards products={products} />
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
                <ProductCards products={products} />
              </Drawer.Body>
            </Drawer.Dialog>
          </Drawer.Content>
        </Drawer.Backdrop>
      ) : null}
    </>
  )
}
