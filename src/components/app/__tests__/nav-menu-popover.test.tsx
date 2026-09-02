import { fireEvent, render } from '@testing-library/react-native';

import { NavMenuPopover } from '@/components/app/nav-menu-popover';

const baseProps = {
  visible: true,
  top: 80,
  onClose: jest.fn(),
  onSaveRoomImage: jest.fn(),
  onOpenCategoryManager: jest.fn(),
};

describe('NavMenuPopover', () => {
  it('exposes the backdrop as a labeled 닫기 button (#550)', async () => {
    const onClose = jest.fn();
    const { getByLabelText } = await render(<NavMenuPopover {...baseProps} onClose={onClose} />);

    const backdrop = getByLabelText('닫기');
    expect(backdrop).toBeTruthy();

    await fireEvent.press(backdrop);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('closes first, then runs the tapped item', async () => {
    const onClose = jest.fn();
    const onOpenCategoryManager = jest.fn();
    const { getByLabelText } = await render(
      <NavMenuPopover
        {...baseProps}
        onClose={onClose}
        onOpenCategoryManager={onOpenCategoryManager}
      />,
    );

    await fireEvent.press(getByLabelText('카테고리 관리'));
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onOpenCategoryManager).toHaveBeenCalledTimes(1);
  });

  it('재화 내역·출석 이벤트는 배선될 때만 항목으로, 미출석이면 라벨에 점 (#1055)', async () => {
    const onOpenWalletHistory = jest.fn();
    const onOpenAttendance = jest.fn();
    const { getByLabelText, queryByLabelText, rerender } = await render(
      <NavMenuPopover {...baseProps} />,
    );
    expect(queryByLabelText('재화 내역')).toBeNull();
    expect(queryByLabelText(/출석 이벤트/)).toBeNull();

    await rerender(
      <NavMenuPopover
        {...baseProps}
        onOpenWalletHistory={onOpenWalletHistory}
        onOpenAttendance={onOpenAttendance}
        attendancePending
      />,
    );
    await fireEvent.press(getByLabelText('재화 내역'));
    expect(onOpenWalletHistory).toHaveBeenCalledTimes(1);
    await fireEvent.press(getByLabelText('출석 이벤트, 오늘 미출석'));
    expect(onOpenAttendance).toHaveBeenCalledTimes(1);
  });

  it('bottom 앵커가 오면 top 대신 그걸로 버튼 위에 연다 (#1055)', async () => {
    const { getByTestId } = await render(<NavMenuPopover {...baseProps} bottom={120} />);
    const style = Object.assign(
      {},
      ...[getByTestId('nav-menu-popover').props.style].flat(Infinity).filter(Boolean),
    );
    expect(style.bottom).toBe(120);
    expect(style.top).toBeUndefined();
  });
});
