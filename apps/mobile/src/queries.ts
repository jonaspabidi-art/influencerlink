import type { Role } from '@pacta/shared';
import { queryOptions, type QueryClient } from '@tanstack/react-query';
import { api } from './api';
import type {
  Campaign,
  Contract,
  ExpertOrder,
  Match,
  OwnBusinessProfile,
  PayoutStatus,
  PendingReview,
} from './types';

/**
 * Frågorna som flikarna vilar på.
 *
 * Samlade här för att kunna hämtas i förväg. Skärmen och förhämtningen måste
 * använda exakt samma nyckel för att träffa varandra – står de på två ställen
 * glider de isär vid första ändringen, och förhämtningen blir tyst bortkastad.
 */

export const contractsQuery = () =>
  queryOptions({
    queryKey: ['contracts'],
    queryFn: () => api.get<Contract[]>('/contracts'),
  });

export const pendingReviewsQuery = () =>
  queryOptions({
    queryKey: ['reviews-pending'],
    queryFn: () => api.get<PendingReview[]>('/reviews/pending'),
  });

export const matchesQuery = () =>
  queryOptions({
    queryKey: ['matches'],
    queryFn: () => api.get<Match[]>('/matches'),
  });

export const myCampaignsQuery = () =>
  queryOptions({
    queryKey: ['campaigns', 'mine'],
    queryFn: () => api.get<Campaign[]>('/campaigns/mine'),
  });

export const ownBusinessQuery = () =>
  queryOptions({
    queryKey: ['own-business'],
    queryFn: () => api.get<OwnBusinessProfile>('/me/business-profile'),
  });

export const expertOrdersQuery = () =>
  queryOptions({
    queryKey: ['expert-orders'],
    queryFn: () => api.get<ExpertOrder[]>('/expert-orders/mine'),
  });

export const payoutsQuery = () =>
  queryOptions({
    queryKey: ['payouts'],
    queryFn: () => api.get<PayoutStatus>('/me/payouts/status'),
  });

/**
 * Vad som hämtas i förväg direkt efter inloggning.
 *
 * Första besöket i varje flik är det enda tillfälle där användaren faktiskt får
 * vänta – sedan ligger allt kvar. Medan hen tittar på startskärmen hämtar vi
 * resten i bakgrunden, så nästa flik är ifylld när hen kommer dit.
 *
 * Bara små listor. Kortleken är med flit inte med: den kan behöva bedöma
 * kreatörer med Sonnet, och det ska inte hända förrän någon faktiskt öppnar den.
 */
export function prefetchTabs(client: QueryClient, role: Role): void {
  // Var och en för sig: prefetchQuery vill ha en exakt typ, inte en union.
  const hämta = {
    contracts: () => void client.prefetchQuery(contractsQuery()),
    reviews: () => void client.prefetchQuery(pendingReviewsQuery()),
    matches: () => void client.prefetchQuery(matchesQuery()),
    campaigns: () => void client.prefetchQuery(myCampaignsQuery()),
    business: () => void client.prefetchQuery(ownBusinessQuery()),
    expert: () => void client.prefetchQuery(expertOrdersQuery()),
    payouts: () => void client.prefetchQuery(payoutsQuery()),
  };

  if (role === 'BUSINESS') {
    hämta.campaigns();
    hämta.matches();
    hämta.contracts();
    hämta.reviews();
    hämta.business();
    hämta.expert();
    return;
  }
  if (role === 'INFLUENCER') {
    hämta.matches();
    hämta.contracts();
    hämta.reviews();
    hämta.payouts();
  }
}
