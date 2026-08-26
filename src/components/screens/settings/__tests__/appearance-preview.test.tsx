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

  it('넘겨준 닉네임과 캐릭터를 그린다 (#899)', async () => {
    const { getByText, getByLabelText } = await render(
      <AppearancePreview userName="루티" characterId="otter" />,
    );
    // 남의 이름이 아니라 내 이름이 뜬다.
    expect(getByText('루티의 방')).toBeTruthy();
    expect(getByLabelText('수달')).toBeTruthy();
  });

  it('닉네임이 없으면 이름 없이 떨어진다 — 로딩 구간에 남의 이름을 쓰지 않는다', async () => {
    const { getByText, queryByText } = await render(<AppearancePreview />);
    expect(getByText('내 방')).toBeTruthy();
    expect(queryByText('의 방')).toBeNull();
  });

  it('긴 닉네임이 코인 필을 밀어내지 않는다 (320px)', async () => {
    const { getByText } = await render(
      <AppearancePreview userName={'가'.repeat(12)} characterId="cat" />,
    );
    const name = getByText(`${'가'.repeat(12)}의 방`);
    // flexShrink 없이 한 줄로 두면 이름이 필을 카드 밖으로 밀어낸다.
    expect(name).toHaveStyle({ flexShrink: 1 });
    expect(name.props.numberOfLines).toBe(1);
    // 코인 필은 살아 있어야 한다.
    expect(getByText('9999+')).toBeTruthy();
  });
});
