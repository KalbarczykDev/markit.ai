const COUNTRY_MARKETS: Record<string, { country: string; currency: string }> = {
  AT: { country: 'Austria', currency: 'EUR' },
  AU: { country: 'Australia', currency: 'AUD' },
  BE: { country: 'Belgium', currency: 'EUR' },
  CA: { country: 'Canada', currency: 'CAD' },
  CH: { country: 'Switzerland', currency: 'CHF' },
  CZ: { country: 'Czechia', currency: 'CZK' },
  DE: { country: 'Germany', currency: 'EUR' },
  DK: { country: 'Denmark', currency: 'DKK' },
  ES: { country: 'Spain', currency: 'EUR' },
  FI: { country: 'Finland', currency: 'EUR' },
  FR: { country: 'France', currency: 'EUR' },
  GB: { country: 'United Kingdom', currency: 'GBP' },
  HU: { country: 'Hungary', currency: 'HUF' },
  IE: { country: 'Ireland', currency: 'EUR' },
  IT: { country: 'Italy', currency: 'EUR' },
  JP: { country: 'Japan', currency: 'JPY' },
  NL: { country: 'Netherlands', currency: 'EUR' },
  NO: { country: 'Norway', currency: 'NOK' },
  NZ: { country: 'New Zealand', currency: 'NZD' },
  PL: { country: 'Poland', currency: 'PLN' },
  PT: { country: 'Portugal', currency: 'EUR' },
  RO: { country: 'Romania', currency: 'RON' },
  SE: { country: 'Sweden', currency: 'SEK' },
  SK: { country: 'Slovakia', currency: 'EUR' },
  US: { country: 'United States', currency: 'USD' },
}

const COUNTRY_ALIASES: Record<string, string> = {
  austria: 'AT',
  australia: 'AU',
  belgium: 'BE',
  canada: 'CA',
  switzerland: 'CH',
  czechia: 'CZ',
  'czech republic': 'CZ',
  germany: 'DE',
  denmark: 'DK',
  spain: 'ES',
  finland: 'FI',
  france: 'FR',
  'united kingdom': 'GB',
  uk: 'GB',
  hungary: 'HU',
  ireland: 'IE',
  italy: 'IT',
  japan: 'JP',
  netherlands: 'NL',
  norway: 'NO',
  'new zealand': 'NZ',
  poland: 'PL',
  polska: 'PL',
  portugal: 'PT',
  romania: 'RO',
  sweden: 'SE',
  slovakia: 'SK',
  'united states': 'US',
  usa: 'US',
}

export function resolveCountryMarket(country: string | undefined) {
  if (!country) return undefined
  const normalized = country.trim()
  const code =
    normalized.length === 2
      ? normalized.toUpperCase()
      : COUNTRY_ALIASES[normalized.toLocaleLowerCase('en-US')]
  return code ? COUNTRY_MARKETS[code] : undefined
}
