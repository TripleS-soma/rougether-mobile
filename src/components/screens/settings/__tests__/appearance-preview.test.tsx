import { render } from '@testing-library/react-native';

import { AppearancePreview } from '@/components/screens/settings/appearance-preview';
import { typographyFor } from '@/constants/theme';

describe('AppearancePreview', () => {
  it('renders the room header, calendar row and CTA samples', async () => {
    const { getByText } = await render(<AppearancePreview />);
    expect(getByText('내 방')).toBeTruthy();
    expect(getByText('9999+')).toBeTruthy();
    expect(getByText('15')).toBeTruthy();
    expect(getByText('달력')).toBeTruthy();
    expect(getByText('오늘 루틴 완료하기')).toBeTruthy();
  });

  it('방 이름은 제목 롤이다 — 주아 혼합처럼 제목만 다른 폰트가 드러나야 한다 (#750)', async () => {
    const { getByText } = await render(<AppearancePreview />);
    // 기본 폰트(나눔) 기준으로 h2 롤의 크기를 그대로 쓰는지 본다. label 롤로
    // 되돌아가면 주아 혼합을 골라도 카드 안에서 아무 변화가 없어진다.
    const { fontSize } = typographyFor('nanum').h2;
    expect(getByText('내 방')).toHaveStyle({ fontSize });
  });
});
