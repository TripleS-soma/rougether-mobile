import { render } from '@testing-library/react-native';
import { Text } from 'react-native';

import { HouseSwitcher } from '@/components/screens/house/house-switcher';

describe('HouseSwitcher', () => {
  it('아이콘·이름 뱃지를 그리고 긴 이름은 한 줄로 접는다 (#994)', async () => {
    const long = '가'.repeat(30);
    const { getByText } = await render(<HouseSwitcher icon={<Text>자물쇠</Text>} title={long} />);
    expect(getByText('자물쇠')).toBeTruthy();
    expect(getByText(long).props.numberOfLines).toBe(1);
  });

  it('전환 화살표는 뱃지 옆에 없다 — 화면 가운데 양쪽으로 옮겼다 (#1575)', async () => {
    const ui = await render(<HouseSwitcher icon={null} title="실집" />);
    expect(ui.queryByLabelText('이전 집')).toBeNull();
    expect(ui.queryByLabelText('다음 집')).toBeNull();
  });
});
