/**
 * Research & previous-work entries shown on the Overview page.
 *
 * These are PLACEHOLDERS. Replace each entry with a real, verified source the
 * team has reviewed. Leave fields `null` rather than guessing — the UI renders
 * missing fields as "To be added".
 */
export interface ResearchEntry {
  id: string
  /** Topic the team intends to cover; shown when `title` is not yet supplied. */
  topic: string
  title: string | null
  author: string | null
  summary: string | null
  publishedDate: string | null
  url: string | null
}

export const RESEARCH_ENTRIES: ResearchEntry[] = [
  { id: 'r1', topic: 'Waterflooding fundamentals & sweep efficiency', title: null, author: null, summary: null, publishedDate: null, url: null },
  { id: 'r2', topic: 'Injector–producer connectivity analysis', title: null, author: null, summary: null, publishedDate: null, url: null },
  { id: 'r3', topic: 'Machine learning for production forecasting', title: null, author: null, summary: null, publishedDate: null, url: null },
  { id: 'r4', topic: 'Heavy-oil operations in western Canada', title: null, author: null, summary: null, publishedDate: null, url: null },
]
