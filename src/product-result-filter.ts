const EDITORIAL_URL_PATTERN =
  /\/(?:blog|blogs|article|articles|news|stories|story|editorial|magazine|guides?|buying-guides?|reviews?|rankings?|comparisons?|category|categories|collections?|catalog|search|tags?)(?:\/|$)/i
const EDITORIAL_TITLE_PATTERN =
  /\b(?:best(?! buy\b)\s+\w+|top\s+\d+|review|guide|how\s+to|versus|vs\.?|comparison|roundup|news|article|ranking|poradnik|recenzj\w*|artykuł|najlepsz\w*|vergleich|ratgeber|testbericht|comparatif|guide\s+d'achat|avis|guía|reseña|comparativa|guida|recensione|confronto)\b/i
const PRODUCT_URL_PATTERN =
  /\/(?:products?|product-page|p|dp|gp\/product|item|items|shop|store)\/(?:[^/?#]+)\/??(?:[?#]|$)/i
const COMMERCE_EVIDENCE_PATTERN =
  /\b(?:add to (?:cart|bag|basket)|buy now|in stock|out of stock|ships? (?:in|from|within)|shipping|delivery|sku|product code|model number|select (?:size|colour|color)|dodaj do koszyka|kup teraz|dostawa|w magazynie|warenkorb|jetzt kaufen|livraison|ajouter au panier|comprar ahora|añadir al carrito|aggiungi al carrello)\b/i

export function isPurchasableProductPage(input: {
  title: string
  url: string
  highlights: string[]
  hasVerifiedPrice: boolean
}): boolean {
  if (!input.hasVerifiedPrice) return false
  let pathname: string
  try {
    pathname = new URL(input.url).pathname
  } catch {
    return false
  }
  if (EDITORIAL_URL_PATTERN.test(pathname) || EDITORIAL_TITLE_PATTERN.test(input.title))
    return false
  return (
    PRODUCT_URL_PATTERN.test(pathname) || COMMERCE_EVIDENCE_PATTERN.test(input.highlights.join(' '))
  )
}
