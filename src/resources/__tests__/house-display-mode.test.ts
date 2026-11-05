import { houseDisplayMode } from '@/resources/house-display-mode';
import { houseDioramaTheme, FOREST_CANOPY_COVER_KEY } from '@/resources/house-diorama';
import { DEFAULT_HOUSE_COVER_KEY, resolveHouseFrame } from '@/resources/house-frame';
import { toHouse, toHousePreviewDetail, toSearchHouse } from '@/api/adapters/house';

it.each([undefined, null, 'FUTURE'])(
  'defaults an absent or unknown mode %s to the redesigned house',
  (value) => {
    expect(houseDisplayMode(value)).toBe('DIORAMA');
  },
);
it('uses the shared server setting in the member screen, browse card and preview', () => {
  expect(toHouse({ displayMode: 'CLASSIC' }, []).displayMode).toBe('CLASSIC');
  expect(toHousePreviewDetail({ displayMode: 'CLASSIC' }).displayMode).toBe('CLASSIC');
  expect(toSearchHouse({ displayMode: 'CLASSIC' }).displayMode).toBe('CLASSIC');
  expect(toHouse({}, []).displayMode).toBe('DIORAMA');
});
it('selects the classic renderer per house and uses a transparent frame for illustration-only covers', () => {
  expect(houseDioramaTheme(FOREST_CANOPY_COVER_KEY, true, 'CLASSIC')).toBeUndefined();
  const frame = resolveHouseFrame(FOREST_CANOPY_COVER_KEY, { displayMode: 'CLASSIC' });
  expect(frame.canonicalKey).toBe(DEFAULT_HOUSE_COVER_KEY);
  expect(frame.assetKey).not.toBe(FOREST_CANOPY_COVER_KEY);
  expect(houseDioramaTheme(FOREST_CANOPY_COVER_KEY)?.id).toBe('forest-canopy');
});
