import { fetchRecommendedHouses } from '@/api/house';
import { RECOMMENDED_HOUSES } from '@/mocks/fixtures';

// MSW handles dev runtime; tests mock fetch directly (jest-expo's resolver
// doesn't load msw/node's ESM cleanly).
const realFetch = global.fetch;
beforeEach(() => {
  global.fetch = jest.fn(async () => ({
    ok: true,
    status: 200,
    // The client parses via res.text() → JSON.parse.
    text: async () => JSON.stringify({ items: RECOMMENDED_HOUSES }),
  })) as unknown as typeof fetch;
});
afterEach(() => {
  global.fetch = realFetch;
});

describe('house API', () => {
  it('fetches recommended houses and unwraps the items envelope', async () => {
    const houses = await fetchRecommendedHouses();
    expect(houses.length).toBe(RECOMMENDED_HOUSES.length);
    expect(houses[0]).toEqual(
      expect.objectContaining({ id: expect.any(String), name: expect.any(String) }),
    );
  });

  it('calls the /api/v1 houses endpoint', async () => {
    await fetchRecommendedHouses();
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/v1/houses/recommended'),
      expect.objectContaining({ method: 'GET' }),
    );
  });
});
