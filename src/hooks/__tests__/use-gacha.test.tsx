import { renderHook, waitFor } from '@testing-library/react-native';

import { useGacha } from '@/hooks/use-gacha';

const res = (body: unknown) => ({
  ok: true,
  status: 200,
  text: async () => JSON.stringify(body),
});

const realFetch = global.fetch;
afterEach(() => {
  global.fetch = realFetch;
  jest.clearAllMocks();
});

describe('useGacha', () => {
  it('loads each machine reward preview together with the machine list', async () => {
    const urls: string[] = [];
    global.fetch = jest.fn(async (url: string) => {
      urls.push(url);
      if (url.endsWith('/gacha')) {
        return res({
          items: [
            {
              gachaId: 1,
              name: '꾸미기 뽑기',
              themeId: 10,
              costCurrencyType: 'COIN',
              costAmount: 25,
              drawCount: 1,
            },
            {
              gachaId: 2,
              name: '캐릭터 뽑기',
              themeId: null,
              costCurrencyType: 'COIN',
              costAmount: 500,
              drawCount: 1,
            },
          ],
        });
      }
      if (url.endsWith('/gacha/1/rewards')) {
        return res({
          items: [
            {
              rewardType: 'ITEM',
              itemId: 100,
              name: '분홍 하트 선글라스',
              assetKey:
                'items/character-accessories/eyewear/cat-pink-heart-sunglasses/thumbnail.png',
              rarity: '희귀',
              owned: true,
              placementType: 'character',
              characterSlotType: 'eyewear',
            },
          ],
        });
      }
      if (url.endsWith('/gacha/2/rewards')) {
        return res({
          items: [
            {
              rewardType: 'CHARACTER',
              characterId: 5,
              name: '고양이',
              assetKey: 'characters/cat/thumbnail.png',
              owned: false,
            },
          ],
        });
      }
      return res({ items: [] });
    }) as unknown as typeof fetch;

    const { result } = await renderHook(() => useGacha(jest.fn()));

    await waitFor(() => expect(result.current.loading).toBe(false));
    await waitFor(() => expect(result.current.rewardsLoading).toBe(false));

    expect(result.current.gachas).toHaveLength(2);
    expect(result.current.rewardsByGachaId[1]?.[0]).toMatchObject({
      name: '분홍 하트 선글라스',
      placementType: 'character',
      characterSlotType: 'eyewear',
    });
    expect(result.current.rewardsByGachaId[2]?.[0]).toMatchObject({
      name: '고양이',
      rewardType: 'CHARACTER',
    });
    expect(urls.filter((url) => url.includes('/rewards'))).toHaveLength(2);
  });
});
