import { describe, expect, it } from 'vitest';
import {
  EXPERT_ORDER_CAPACITY,
  EXPERT_ORDER_LABELS,
  EXPERT_ORDER_PRICE,
  EXPERT_ORDER_QUESTIONS,
  EXPERT_ORDER_STATUSES,
  hasCapacity,
  occupiesCapacity,
} from '@pacta/shared';

describe('kön till Pacta-experten', () => {
  it('tar emot uppdrag upp till taket', () => {
    expect(hasCapacity(0)).toBe(true);
    expect(hasCapacity(EXPERT_ORDER_CAPACITY - 1)).toBe(true);
  });

  it('stänger vid taket, och håller stängt om något ändå sluppit in', () => {
    expect(hasCapacity(EXPERT_ORDER_CAPACITY)).toBe(false);
    expect(hasCapacity(EXPERT_ORDER_CAPACITY + 3)).toBe(false);
  });

  it('räknar bara uppdrag som faktiskt upptar tid', () => {
    expect(occupiesCapacity('REQUESTED')).toBe(true);
    expect(occupiesCapacity('IN_PROGRESS')).toBe(true);
    // Levererat väntar på företaget, inte på oss – det ska inte blockera kön.
    expect(occupiesCapacity('DELIVERED')).toBe(false);
    expect(occupiesCapacity('APPROVED')).toBe(false);
    expect(occupiesCapacity('CANCELLED')).toBe(false);
  });
});

describe('beställningen', () => {
  it('ställer fyra frågor, varav två obligatoriska', () => {
    expect(EXPERT_ORDER_QUESTIONS).toHaveLength(4);
    expect(EXPERT_ORDER_QUESTIONS.filter((q) => q.required)).toHaveLength(2);
  });

  it('har ett fast pris i hela kronor', () => {
    expect(EXPERT_ORDER_PRICE).toBe(490_000);
    expect(EXPERT_ORDER_PRICE % 100).toBe(0);
  });

  it('har en svensk etikett för varje läge', () => {
    for (const status of EXPERT_ORDER_STATUSES) {
      expect(EXPERT_ORDER_LABELS[status]).toBeTruthy();
    }
  });
});
