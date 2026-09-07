import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TtlCache } from '../lib/cache.js';

describe('TtlCache', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('lämnar tillbaka det som lagts in', () => {
    const cache = new TtlCache<number>(1000);
    cache.set('a', 1);
    expect(cache.get('a')).toBe(1);
  });

  it('vet inte om nycklar som aldrig lagts in', () => {
    expect(new TtlCache<number>(1000).get('saknas')).toBeUndefined();
  });

  it('släpper posten när tiden gått ut', () => {
    const cache = new TtlCache<string>(10_000);
    cache.set('a', 'värde');
    vi.advanceTimersByTime(9_999);
    expect(cache.get('a')).toBe('värde');
    vi.advanceTimersByTime(2);
    expect(cache.get('a')).toBeUndefined();
  });

  it('kastar ut den äldsta när taket nås, så minnet inte växer', () => {
    const cache = new TtlCache<number>(60_000, 3);
    cache.set('a', 1);
    cache.set('b', 2);
    cache.set('c', 3);
    cache.set('d', 4);
    expect(cache.get('a')).toBeUndefined();
    expect(cache.get('d')).toBe(4);
    expect(cache.get('b')).toBe(2);
  });

  it('går att tömma på en enskild post och på allt', () => {
    const cache = new TtlCache<number>(60_000);
    cache.set('a', 1);
    cache.set('b', 2);
    cache.delete('a');
    expect(cache.get('a')).toBeUndefined();
    expect(cache.get('b')).toBe(2);
    cache.clear();
    expect(cache.get('b')).toBeUndefined();
  });
});
