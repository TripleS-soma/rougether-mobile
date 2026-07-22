import { render } from '@testing-library/react-native';

import { CATEGORY_ICON_GEOMETRY, CategoryIcon } from '@/components/ui/category-icon';
import { type PictogramName } from '@/components/ui/pictograms';

const NAMES = Object.keys(CATEGORY_ICON_GEOMETRY) as PictogramName[];

describe('CategoryIcon', () => {
  it('covers all 16 category form choices', () => {
    expect(NAMES).toHaveLength(16);
  });

  it('renders every icon with a category color', async () => {
    const { getByTestId } = await render(
      <>
        {NAMES.map((n) => (
          <CategoryIcon key={n} name={n} color="#C8869C" />
        ))}
      </>,
    );
    for (const n of NAMES) expect(getByTestId(`category-icon-${n}`)).toBeTruthy();
  });

  it('renders in mono mode on colored fills', async () => {
    const { getByTestId } = await render(<CategoryIcon name="heart" color="#D67878" mono="#FFF" />);
    expect(getByTestId('category-icon-heart')).toBeTruthy();
  });

  it('falls back to the flat pictogram for non-category names (집 카테고리 등)', async () => {
    const { queryByTestId, toJSON } = await render(<CategoryIcon name="house" color="#D67878" />);
    // 스티커 지오메트리는 없지만 빈 자리가 아니라 기존 픽토그램이 렌더된다.
    expect(queryByTestId('category-icon-house')).toBeNull();
    expect(toJSON()).not.toBeNull();
  });
});
