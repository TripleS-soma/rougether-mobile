import { fireEvent, render } from '@testing-library/react-native';

import { NavRail } from '@/components/ui/nav-rail';

describe('NavRail — 왼쪽 세로 탭 줄', () => {
  it('탭을 세로로 늘어놓고, 고른 탭을 selected로 알린다', async () => {
    const ui = await render(<NavRail active="house" onChange={jest.fn()} />);
    for (const name of ['나의 방', '달력', '집', '내 정보']) {
      expect(ui.getByRole('button', { name })).toBeTruthy();
    }
    expect(ui.getByRole('button', { name: '집' }).props.accessibilityState).toEqual({
      selected: true,
    });
    expect(ui.getByRole('button', { name: '달력' }).props.accessibilityState).toEqual({
      selected: false,
    });
  });

  it('탭을 누르면 그 탭으로 바꾼다', async () => {
    const onChange = jest.fn();
    const ui = await render(<NavRail active="myRoom" onChange={onChange} />);
    await fireEvent.press(ui.getByRole('button', { name: '달력' }));
    expect(onChange).toHaveBeenCalledWith('calendar');
  });

  it('미출석 점은 아래 탭 바와 같이 아이콘 위에 뜨고 힌트로 읽힌다', async () => {
    const ui = await render(
      <NavRail active="myRoom" onChange={jest.fn()} badges={{ myPage: true }} />,
    );
    expect(ui.getAllByTestId('bottom-nav-badge')).toHaveLength(1);
    expect(ui.getByRole('button', { name: '내 정보' }).props.accessibilityHint).toBeTruthy();
    expect(ui.getByRole('button', { name: '집' }).props.accessibilityHint).toBeUndefined();
  });
});
