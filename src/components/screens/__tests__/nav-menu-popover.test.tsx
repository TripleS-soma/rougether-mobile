import { fireEvent, render } from '@testing-library/react-native';

import { NavMenuPopover } from '@/components/screens/nav-menu-popover';

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
});
