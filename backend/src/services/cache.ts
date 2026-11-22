/**
 * Small in-memory TTL cache with in-flight de-duplication, so concurrent
 * requests for the same dashboard dataset share one warehouse query.
 * Failures are never cached.
 */
interface Entry {
  value: unknown
  expires: number
  storedAt: number
}

export interface CacheHit<T> {
  value: T
  cached: boolean
  storedAt: number
}

export class TtlCache {
  private entries = new Map<string, Entry>()
  private inflight = new Map<string, Promise<unknown>>()

  constructor(
    private readonly defaultTtlMs: number,
    private readonly maxEntries = 500,
    private readonly now: () => number = Date.now,
  ) {}

  async getOrLoad<T>(key: string, loader: () => Promise<T>, ttlMs = this.defaultTtlMs): Promise<CacheHit<T>> {
    const hit = this.entries.get(key)
    if (hit && hit.expires > this.now()) return { value: hit.value as T, cached: true, storedAt: hit.storedAt }

    const pending = this.inflight.get(key) as Promise<T> | undefined
    if (pending) return { value: await pending, cached: true, storedAt: this.now() }

    const p = loader()
    this.inflight.set(key, p)
    try {
      const value = await p
      const storedAt = this.now()
      if (ttlMs > 0) {
        if (this.entries.size >= this.maxEntries) this.entries.delete(this.entries.keys().next().value as string)
        this.entries.set(key, { value, expires: storedAt + ttlMs, storedAt })
      }
      return { value, cached: false, storedAt }
    } finally {
      this.inflight.delete(key)
    }
  }

  clear(prefix?: string) {
    if (!prefix) return this.entries.clear()
    for (const k of this.entries.keys()) if (k.startsWith(prefix)) this.entries.delete(k)
  }

  stats() {
    return { entries: this.entries.size, inflight: this.inflight.size }
  }
}
