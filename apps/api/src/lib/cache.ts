/**
 * En liten cache i minnet med tidsgräns.
 *
 * Finns för ett enda ändamål: Sonnet-anrop som tar sekunder och kostar pengar,
 * på data som knappt hinner ändras mellan två anrop. Ingen Redis, inget nytt
 * beroende – en enda instans räcker, och blir det flera senare betyder en miss
 * bara att svaret räknas fram igen.
 */
export class TtlCache<T> {
  private readonly entries = new Map<string, { value: T; expiresAt: number }>();

  constructor(
    private readonly ttlMs: number,
    /** Tak på antalet poster, så en långkörande process inte växer i minnet. */
    private readonly maxEntries = 200,
  ) {}

  get(key: string): T | undefined {
    const entry = this.entries.get(key);
    if (!entry) return undefined;
    if (entry.expiresAt <= Date.now()) {
      this.entries.delete(key);
      return undefined;
    }
    return entry.value;
  }

  set(key: string, value: T): void {
    // Äldsta posten först: Map behåller insättningsordningen.
    if (this.entries.size >= this.maxEntries) {
      const oldest = this.entries.keys().next().value;
      if (oldest !== undefined) this.entries.delete(oldest);
    }
    this.entries.set(key, { value, expiresAt: Date.now() + this.ttlMs });
  }

  /** Efter en ändring som gör det cachade svaret fel. */
  delete(key: string): void {
    this.entries.delete(key);
  }

  clear(): void {
    this.entries.clear();
  }
}
