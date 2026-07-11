export type SavedListing = {
  id: string
  title: string
  url: string
  source: string
  price?: string
  image?: string
  savedAt: string
}

export type SavableListing = Pick<SavedListing, 'title' | 'url' | 'source' | 'price' | 'image'>
