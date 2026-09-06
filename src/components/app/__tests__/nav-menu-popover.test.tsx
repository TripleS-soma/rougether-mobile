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

  it('방 작업만 남는다 — 재화 내역·출석 이벤트 항목은 마이페이지로 갔다 (#1055 → #1089)', async () => {
    const { getByLabelText, queryByLabelText } = await render(<NavMenuPopover {...baseProps} />);
    expect(getByLabelText('방 꾸미기')).toBeTruthy();
    expect(getByLabelText('루틴 관리')).toBeTruthy();
    expect(queryByLabelText('재화 내역')).toBeNull();
    expect(queryByLabelText(/출석 이벤트/)).toBeNull();
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
