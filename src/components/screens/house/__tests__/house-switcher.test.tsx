import { fireEvent, render } from '@testing-library/react-native';
import { Text } from 'react-native';

import { HouseSwitcher } from '@/components/screens/house/house-switcher';

describe('HouseSwitcher', () => {
  it('아이콘·이름 뱃지를 그리고 긴 이름은 한 줄로 접는다 (#994)', async () => {
    const long = '가'.repeat(30);
    const { getByText } = await render(
      <HouseSwitcher
        icon={<Text>자물쇠</Text>}
        title={long}
        showArrows={false}
        onPrev={jest.fn()}
        onNext={jest.fn()}
      />,
    );
    expect(getByText('자물쇠')).toBeTruthy();
    expect(getByText(long).props.numberOfLines).toBe(1);
  });

  it('화살표는 showArrows일 때만 그리고, 이전/다음 집 라벨로 콜백을 부른다', async () => {
    const onPrev = jest.fn();
    const onNext = jest.fn();
    const ui = await render(
      <HouseSwitcher icon={null} title="실집" showArrows onPrev={onPrev} onNext={onNext} />,
    );
    await fireEvent.press(ui.getByLabelText('이전 집'));
    await fireEvent.press(ui.getByLabelText('다음 집'));
    expect(onPrev).toHaveBeenCalledTimes(1);
    expect(onNext).toHaveBeenCalledTimes(1);

    const single = await render(
      <HouseSwitcher icon={null} title="실집" showArrows={false} onPrev={onPrev} onNext={onNext} />,
    );
    expect(single.queryByLabelText('이전 집')).toBeNull();
    expect(single.queryByLabelText('다음 집')).toBeNull();
  });
});
