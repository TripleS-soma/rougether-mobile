import { apiGetList } from './client';

/** A house summary as returned by the business API (spec: domains/house). */
export type HouseSummary = {
  id: string;
  name: string;
  members: number;
  capacity: number;
  tag: string;
  emoji: string;
  bg: string;
  border: string;
  description: string;
};

/** Recommended houses for the search screen. */
export function fetchRecommendedHouses() {
  return apiGetList<HouseSummary>('/houses/recommended');
}
